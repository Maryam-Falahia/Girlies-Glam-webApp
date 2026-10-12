import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();
if (!process.env.NETLIFY) {
  app.use(pinoHttp({ logger, serializers: { req(req) { return { id: req.id, method: req.method, url: req.url?.split("?")[0] }; }, res(res) { return { statusCode: res.statusCode }; } } }));
}
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "8mb" }));
app.use(express.urlencoded({ extended: true }));
app.use((req, _res, next) => {
  if (Buffer.isBuffer(req.body)) {
    const text = req.body.toString("utf8");
    try { req.body = JSON.parse(text); } catch { req.body = text; }
  } else if (typeof req.body === "string" && req.body) {
    try { req.body = JSON.parse(req.body); } catch { /* keep original body */ }
  }
  next();
});
app.use(cookieParser(process.env.SESSION_SECRET || "girlies-glam-dev-secret"));
app.use("/api", router);
app.use("/.netlify/functions/api", router);
app.use("/", router);
export default app;
