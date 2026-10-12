import { afterAll, describe, expect, it } from "vitest";
import { pool } from "@workspace/db";

describe("PostgreSQL order reference concurrency", () => {
  afterAll(async () => {
    await pool.end();
  });

  it("assigns a distinct GG reference to every concurrent insert", async () => {
    const insertCount = 12;
    const client = await pool.connect();

    try {
      // Temporary objects keep this release check isolated from development
      // orders and sequences, even when it uses the shared PostgreSQL server.
      await client.query(`
        CREATE TEMP SEQUENCE test_order_ref_sequence START WITH 100000;
        CREATE TEMP TABLE test_orders (
          order_ref text NOT NULL DEFAULT 'GG-' || nextval('test_order_ref_sequence')::text
        );
      `);
      const rows = await Promise.all(
        Array.from({ length: insertCount }, (_, index) =>
          client.query<{ order_ref: string }>(
            "INSERT INTO test_orders DEFAULT VALUES RETURNING order_ref",
          ).then((result) => result.rows),
        ),
      );

      const references = rows.flat().map((row) => row.order_ref);
      expect(references).toHaveLength(insertCount);
      expect(new Set(references)).toHaveLength(insertCount);
      expect(references.every((reference) => /^GG-\d{5,}$/.test(reference))).toBe(true);
    } finally {
      client.release();
    }
  });

  it("preserves the complete sequence value across a digit-length boundary", async () => {
    const client = await pool.connect();

    try {
      await client.query(`
        CREATE TEMP SEQUENCE test_boundary_sequence START WITH 999999;
        CREATE TEMP TABLE test_boundary_orders (
          order_ref text NOT NULL DEFAULT 'GG-' || nextval('test_boundary_sequence')::text
        );
      `);
      const referencesResult = await client.query<{ order_ref: string }>(`
        INSERT INTO test_boundary_orders (order_ref)
        VALUES (DEFAULT), (DEFAULT)
        RETURNING order_ref
      `);
      const references = referencesResult.rows.map((row) => row.order_ref);

      expect(references).toEqual(["GG-999999", "GG-1000000"]);
      expect(new Set(references).size).toBe(2);
    } finally {
      client.release();
    }
  });
});