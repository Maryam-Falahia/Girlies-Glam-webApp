import { describe, expect, it } from "vitest";
import { receiptTextLooksLikePaymentReceipt } from "./receipt-content-validation";

describe("receipt content validation", () => {
  it("rejects a product photo with no payment evidence", () => {
    expect(receiptTextLooksLikePaymentReceipt("Girlies Glam summer dress collection")).toBe(false);
  });

  it("accepts an English bank transfer receipt", () => {
    expect(receiptTextLooksLikePaymentReceipt("Bank transfer successful Amount OMR 12.500 Reference 12345")).toBe(true);
  });

  it("accepts an Arabic transfer receipt", () => {
    expect(receiptTextLooksLikePaymentReceipt("تمت عملية تحويل المبلغ 12.500 ريال مرجع 12345")).toBe(true);
  });
});