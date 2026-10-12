import React from "react";
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { OrderReceipt } from "./App";

type PdfWord = {
  text: string;
  xMin: number;
  yMin: number;
  xMax: number;
  yMax: number;
};

type PdfPage = {
  width: number;
  height: number;
  words: PdfWord[];
};

const chromiumCandidates = [
  process.env.CHROMIUM_PATH,
  "/repl/tools/bin/chromium",
  "chromium",
  "chromium-browser",
  "google-chrome",
].filter((candidate): candidate is string => Boolean(candidate));

function findExecutable(candidates: string[], description: string) {
  const executable = candidates.find((candidate) => {
    if (candidate.includes("/")) return existsSync(candidate);
    try {
      execFileSync("sh", ["-c", `command -v ${candidate}`], {
        stdio: "ignore",
      });
      return true;
    } catch {
      return false;
    }
  });

  if (!executable) {
    throw new Error(
      `${description} is required for the browser PDF regression test.`,
    );
  }

  return executable;
}

function parsePdfWords(bboxOutput: string): PdfPage[] {
  return [...bboxOutput.matchAll(/<page [^>]*width="([^"]+)" height="([^"]+)"[^>]*>([\s\S]*?)<\/page>/g)].map(
    ([, width, height, pageMarkup]) => ({
      width: Number(width),
      height: Number(height),
      words: [
        ...pageMarkup.matchAll(
          /<word xMin="([^"]+)" yMin="([^"]+)" xMax="([^"]+)" yMax="([^"]+)"[^>]*>([\s\S]*?)<\/word>/g,
        ),
      ].map(([, xMin, yMin, xMax, yMax, text]) => ({
        text: text.replace(/&amp;/g, "&").trim(),
        xMin: Number(xMin),
        yMin: Number(yMin),
        xMax: Number(xMax),
        yMax: Number(yMax),
      })),
    }),
  );
}

function findItemRow(pages: PdfPage[], itemLabel: string) {
  const itemWords = itemLabel.split(" ");

  for (const [pageIndex, page] of pages.entries()) {
    for (let wordIndex = 0; wordIndex <= page.words.length - itemWords.length; wordIndex += 1) {
      const words = page.words.slice(wordIndex, wordIndex + itemWords.length);
      if (words.map((word) => word.text).join(" ") !== itemLabel) continue;

      const yMin = Math.min(...words.map((word) => word.yMin));
      const yMax = Math.max(...words.map((word) => word.yMax));
      const amount = page.words.find(
        (word) =>
          word.text === "OMR" &&
          Math.abs(word.yMin - yMin) < 2 &&
          word.xMin > Math.max(...words.map((itemWord) => itemWord.xMax)),
      );

      return { pageIndex, page, yMin, yMax, amount };
    }
  }

  return undefined;
}

function normalizePdfText(text: string) {
  return text.replace(/[\u061c\u200e\u200f\u202a-\u202e]/g, "");
}

describe("browser-generated receipt PDFs", () => {
  it(
    "keeps a multi-page receipt complete and rows intact at page boundaries",
    () => {
      const chromium = findExecutable(
        chromiumCandidates,
        "A Chromium-compatible browser",
      );
      const pdftotext = findExecutable(
        ["pdftotext"],
        "pdftotext",
      );
      const css = readFileSync(
        fileURLToPath(new URL("./index.css", import.meta.url)),
        "utf8",
      );
      const items = Array.from({ length: 40 }, (_, index) => ({
        name: `Boundary item ${String(index + 1).padStart(2, "0")} page marker`,
        size: "M",
        qty: 1,
        price: index + 1,
      }));
      const longOrder = {
        id: "GG-1000000",
        date: "Sep 17, 2026",
        items,
        total: items.reduce((sum, item) => sum + item.price, 0),
        status: "Submitted",
        shippingName: "A very long customer name for PDF boundary coverage",
        shippingAddress:
          "Building 123, Sultan Qaboos Street, Al Khuwair, Muscat, Sultanate of Oman",
        phone: "+968 91234567",
        governorate: "Muscat",
      };
      const receiptMarkup = renderToStaticMarkup(
        React.createElement(OrderReceipt, {
          order: longOrder,
          onBack: () => undefined,
        }),
      );
      const temporaryDirectory = mkdtempSync(join(tmpdir(), "girlies-glam-pdf-"));
      const htmlPath = join(temporaryDirectory, "receipt.html");
      const pdfPath = join(temporaryDirectory, "receipt.pdf");
      const bboxPath = join(temporaryDirectory, "receipt-bbox.html");

      try {
        writeFileSync(
          htmlPath,
          `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body><div id="app">${receiptMarkup}</div></body></html>`,
        );
        execFileSync(
          chromium,
          [
            "--headless",
            "--no-sandbox",
            "--disable-dev-shm-usage",
            "--disable-gpu",
            "--no-pdf-header-footer",
            "--run-all-compositor-stages-before-draw",
            `--print-to-pdf=${pdfPath}`,
            `file://${htmlPath}`,
          ],
          { stdio: "pipe", timeout: 30_000 },
        );
        const pdfText = normalizePdfText(execFileSync(pdftotext, [pdfPath, "-"], {
          encoding: "utf8",
          timeout: 10_000,
        }));
        execFileSync(pdftotext, ["-bbox-layout", pdfPath, bboxPath], {
          timeout: 10_000,
        });
        const pages = parsePdfWords(readFileSync(bboxPath, "utf8"));

        expect(pages.length).toBeGreaterThanOrEqual(2);
        expect(pages.every((page) => page.words.length > 0)).toBe(true);
        expect(pdfText).toContain(items[0].name);
        expect(pdfText).toContain(items.at(-1)?.name);
        expect(pdfText).toContain(longOrder.shippingName);
        expect(pdfText).toContain(longOrder.shippingAddress);
        expect(pdfText).toContain("OMR 820.000");

        const rows = items.map((item) => findItemRow(pages, item.name));
        expect(rows.every(Boolean)).toBe(true);

        for (const row of rows) {
          expect(row).toBeDefined();
          expect(row?.amount).toBeDefined();
          expect(row?.yMin).toBeGreaterThan(0);
          expect(row?.yMax).toBeLessThan(row?.page.height);
          expect(row?.amount?.yMin).toBeCloseTo(row?.yMin, 0);
          expect(row?.amount?.yMax).toBeLessThan(row?.page.height);
        }

        for (let index = 1; index < rows.length; index += 1) {
          const previous = rows[index - 1];
          const current = rows[index];
          if (!previous || !current || previous.pageIndex !== current.pageIndex) {
            continue;
          }

          expect(current.yMin).toBeGreaterThanOrEqual(previous.yMax);
        }
      } finally {
        rmSync(temporaryDirectory, { recursive: true, force: true });
      }
    },
    45_000,
  );

  it(
    "keeps Arabic receipt labels and delivery text selectable in the browser PDF",
    () => {
      const chromium = findExecutable(
        chromiumCandidates,
        "A Chromium-compatible browser",
      );
      const pdftotext = findExecutable(["pdftotext"], "pdftotext");
      const css = readFileSync(
        fileURLToPath(new URL("./index.css", import.meta.url)),
        "utf8",
      );
      const arabicOrder = {
        id: "GG-1000001",
        date: "Sep 22, 2026",
        items: [{ name: "عباية مخور مطرزة", size: "Free Size", qty: 1, price: 25 }],
        total: 27,
        status: "Submitted",
        language: "ar",
        shippingName: "سارة بنت خالد البلوشية",
        shippingAddress: "مبنى ١٢٣، شارع السلطان قابوس، الخوير، مسقط",
        wilayat: "بوشر",
        governorate: "مسقط",
        postalCode: "100",
        phone: "+968 91234567",
      };
      const receiptMarkup = renderToStaticMarkup(
        React.createElement(OrderReceipt, {
          order: arabicOrder,
          onBack: () => undefined,
          initialLanguage: "ar",
        }),
      );
      const temporaryDirectory = mkdtempSync(join(tmpdir(), "girlies-glam-arabic-pdf-"));
      const htmlPath = join(temporaryDirectory, "receipt.html");
      const pdfPath = join(temporaryDirectory, "receipt.pdf");

      try {
        writeFileSync(
          htmlPath,
          `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body><div id="app">${receiptMarkup}</div></body></html>`,
        );
        execFileSync(
          chromium,
          [
            "--headless",
            "--no-sandbox",
            "--disable-dev-shm-usage",
            "--disable-gpu",
            "--no-pdf-header-footer",
            "--run-all-compositor-stages-before-draw",
            `--print-to-pdf=${pdfPath}`,
            `file://${htmlPath}`,
          ],
          { stdio: "pipe", timeout: 30_000 },
        );
        const pdfText = normalizePdfText(execFileSync(pdftotext, [pdfPath, "-"], {
          encoding: "utf8",
          timeout: 10_000,
        }));

        expect(pdfText).toContain("التوصيل إلى");
        expect(pdfText).toContain("سارة بنت خالد البلوشية");
        expect(pdfText).toContain("مسقط");
        expect(pdfText).toMatch(/ا?(?:الإجمالي|اإلجمالي)/);
        expect(pdfText).toContain("OMR 27.000");
      } finally {
        rmSync(temporaryDirectory, { recursive: true, force: true });
      }
    },
    45_000,
  );
});