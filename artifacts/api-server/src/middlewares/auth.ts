import type { Request, Response, NextFunction } from "express";
import { getUserId } from "../lib/auth";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
export function requireAuth(req: Request, res: Response, next: NextFunction): void { if (!getUserId(req)) { res.status(401).json({ error: "Not authenticated" }); return; } next(); }
export async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  const userId = getUserId(req);
  if (!userId) { res.status(401).json({ error: "Not authenticated" }); return; }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user || !user.isAdmin) { res.status(403).json({ error: "Admin access required" }); return; }
  next();
}
