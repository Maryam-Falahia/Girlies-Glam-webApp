import { describe, expect, it } from "vitest";
import { buildOrderBillHtml, buildOrderBillText } from "./order-bill";

const order = {
  id: 10,
  orderRef: "GG-12345",
  userId: 7,
  status: "Submitted",
  total: 24.5,
  shippingName: "سارة Al Balushi",
  shippingAddress: "مبنى ١٢٣، شارع السلطان قابوس",
  phone: "+968 79162199",
  governorate: "مسقط Muscat",
  city: "مسقط",
  postalCode: "100",
  language: "ar",
  paymentIntentId: "payment-1",
  items: [{ name: "Embroidered <Makhwar>", size: "Free Size", qty: 2, price: 12.25 }],
  createdAt: new Date("2026-09-17T00:00:00Z"),
};

describe("order bill notifications", () => {
  it("uses the order language and includes every bill detail in WhatsApp text", () => {
    const text = buildOrderBillText(order as never);

    expect(text).toContain("طلب جديد: GG-12345");
    expect(text).toContain("التوصيل إلى:");
    expect(text).toContain("المحافظة: مسقط Muscat");
    expect(text).toContain("الكمية: 2");
    expect(text).toContain("الإجمالي: OMR 24.500");
    expect(text).not.toContain("otherwise");
  });

  it("keeps an English order bill in English when the order language is English", () => {
    const englishOrder = { ...order, language: "en" };
    const text = buildOrderBillText(englishOrder as never);
    const html = buildOrderBillHtml(englishOrder as never);

    expect(text).toContain("New order: GG-12345");
    expect(text).toContain("Shipping To:");
    expect(text).toContain("Total: OMR 24.500");
    expect(text).not.toContain("طلب جديد");
    expect(html).toContain('<html lang="en" dir="ltr">');
    expect(html).toContain("Thank you for shopping with Girlies Glam.");
  });

  it("escapes user-provided values in the attached HTML bill", () => {
    const html = buildOrderBillHtml(order as never);

    expect(html).toContain('<html lang="ar" dir="rtl">');
    expect(html).toContain("Embroidered &lt;Makhwar&gt;");
    expect(html).not.toContain("Embroidered <Makhwar>");
    expect(html).toContain("سارة Al Balushi");
    expect(html).toContain("OMR 24.500");
  });
});