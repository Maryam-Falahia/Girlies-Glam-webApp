import serverless from "serverless-http";
import app from "./app";

const handle = serverless(app, {
  binary: ["image/*", "application/pdf", "application/octet-stream"],
});

export const handler = async (event: any, context: any) => {
  if (event?.isBase64Encoded && typeof event.body === "string") {
    event.body = Buffer.from(event.body, "base64").toString("utf8");
    event.isBase64Encoded = false;
  }
  if (typeof event?.body === "string") {
    event.headers = event.headers || {};
    const hasLength = event.headers["content-length"] || event.headers["Content-Length"];
    if (!hasLength) {
      event.headers["content-length"] = String(Buffer.byteLength(event.body));
    }
  }
  return handle(event, context);
};
