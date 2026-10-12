import React from "react";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { AdminOrderCard, OrderCard, OrderReceipt } from "./App";

const baseOrder = {
  date: "Sep 17, 2026",
  items: [{ name: "Dress", size: "M", qty: 1, price: 12 }],
  total: 12,
  status: "Submitted",
  shippingName: "Customer",
  shippingAddress: "Muscat",
  phone: "+968 70000000",
  governorate: "Muscat",
  customerName: "Customer",
  customerEmail: "customer@example.test",
};

describe("order reference display", () => {
  it.each(["GG-44766", "GG-1000000"])(
    "renders the complete %s reference in customer confirmation, customer orders, and admin orders",
    (id) => {
     const order = { ...baseOrder, id };
      const customerConfirmation = renderToStaticMarkup(
        <OrderReceipt order={order} onBack={vi.fn()} showSuccess />,
      );
      const customerOrder = renderToStaticMarkup(
        <OrderCard o={order} viewBill={vi.fn()} />,
      );
      const adminOrder = renderToStaticMarkup(
        <AdminOrderCard o={order} changeStatus={vi.fn()} setViewingOrder={vi.fn()} />,
      );

      expect(customerConfirmation).toContain(id);
      expect(customerOrder).toContain(id);
      expect(adminOrder).toContain(id);
    },
  );

  it.each([
    ["customer", (order: typeof baseOrder & { id: string }) =>
      renderToStaticMarkup(<OrderCard o={order} viewBill={vi.fn()} />)],
    ["admin", (order: typeof baseOrder & { id: string }) =>
      renderToStaticMarkup(
        <AdminOrderCard o={order} changeStatus={vi.fn()} setViewingOrder={vi.fn()} />,
      )],
  ])("keeps the full long reference from the %s bill entry point into the printable receipt", (_, renderEntryPoint) => {
    const order = { ...baseOrder, id: "GG-1000000" };
    const entryPoint = renderEntryPoint(order);
    const printableReceipt = renderToStaticMarkup(
      <OrderReceipt order={order} onBack={vi.fn()} />,
    );

    expect(entryPoint).toContain("GG-1000000");
    expect(printableReceipt).toMatch(
      /class="gg-print-area"[\s\S]*class="gg-order-reference">GG-1000000<\/span>/,
    );
  });

  it("keeps print styles from clipping or hiding the order reference", () => {
    const css = readFileSync(new URL("./index.css", import.meta.url), "utf8");
    const printRules = css.match(/@media print\s*\{[\s\S]*\}\s*$/)?.[0] ?? "";
    const referenceRules = printRules.match(
      /\.gg-print-area \.gg-order-reference\s*\{([^}]*)\}/,
    )?.[1] ?? "";

    expect(referenceRules).toContain("overflow: visible");
    expect(referenceRules).toContain("text-overflow: clip");
    expect(referenceRules).toContain("white-space: nowrap");
    expect(referenceRules).not.toMatch(/display:\s*none/);
  });
});

describe("printed receipt pagination", () => {
  const longOrder = {
    ...baseOrder,
    id: "GG-1000000",
    shippingName: "A very long customer name that must remain visible on the printed bill",
    shippingAddress: "Building 123, an especially long street and neighbourhood description, Muscat, Sultanate of Oman",
    items: Array.from({ length: 48 }, (_, index) => ({
      name: `Detailed item name ${index + 1} that remains readable at a printed page boundary`,
      size: "M",
      qty: 1,
      price: 12,
    })),
    total: 576,
  };

  it("renders long shipping details, every item, and the total in the shared receipt", () => {
    const receipt = renderToStaticMarkup(
      <OrderReceipt order={longOrder} onBack={vi.fn()} />,
    );

    expect(receipt).toContain("A very long customer name");
    expect(receipt).toContain("Detailed item name 1");
    expect(receipt).toContain("Detailed item name 48");
    expect(receipt).toContain("OMR 576.000");
  });

  it("keeps Arabic address runs wrapped and directional in print styles", () => {
    const css = readFileSync(new URL("./index.css", import.meta.url), "utf8");
    const printRules = css.match(/@media print\s*\{[\s\S]*\}\s*$/)?.[0] ?? "";

    expect(printRules).toMatch(
      /\.gg-receipt-header,[\s\S]*\.gg-receipt-total\s*\{[\s\S]*break-inside:\s*avoid;[\s\S]*page-break-inside:\s*avoid;/,
    );
    expect(printRules).toMatch(
      /\.gg-receipt-items-title\s*\{[\s\S]*break-after:\s*avoid;[\s\S]*page-break-after:\s*avoid;/,
    );
    expect(printRules).toMatch(
      /\.gg-receipt-address,[\s\S]*overflow-wrap:\s*anywhere;/,
    );

    const printAreaRules = printRules.match(
      /\.gg-print-area\s*\{([^}]*)\}/,
    )?.[1] ?? "";
    expect(printAreaRules).not.toMatch(/(?:break|page-break)-inside:\s*avoid/);
  });
});

describe("Arabic shipping details in printed receipts", () => {
  const arabicOrder = {
    ...baseOrder,
    id: "GG-1000000",
    customerName: "سارة Al Balushi",
    customerEmail: "sara@example.test",
    shippingName: "سارة بنت خالد البلوشية",
    shippingAddress: "مبنى ١٢٣، شارع السلطان قابوس، الخوير، مسقط، سلطنة عُمان مع تفاصيل إضافية طويلة للتوصيل",
    governorate: "مسقط Muscat",
    phone: "+968 91234567",
  };

  it("isolates mixed-direction shipping details, phone numbers, and order references", () => {
    const receipt = renderToStaticMarkup(
      <OrderReceipt order={{ ...arabicOrder, language: "ar" }} onBack={vi.fn()} />,
    );

    expect(receipt).toContain('class="gg-print-area gg-receipt-ar" dir="rtl" lang="ar"');
    expect(receipt).toContain("رقم الطلب");
    expect(receipt).toContain("التوصيل إلى");
    expect(receipt).toContain("الإجمالي");
    expect(receipt).toContain('<span class="gg-receipt-phone" dir="ltr">+968 91234567</span>');
  });

  it("keeps Arabic address runs wrapped and directional in print styles", () => {
    const css = readFileSync(new URL("./index.css", import.meta.url), "utf8");
    const printRules = css.match(/@media print\s*\{[\s\S]*\}\s*$/)?.[0] ?? "";

    expect(printRules).toMatch(
      /\.gg-receipt-bidi\s*\{[\s\S]*display:\s*block;[\s\S]*max-width:\s*100%;[\s\S]*overflow-wrap:\s*anywhere;[\s\S]*unicode-bidi:\s*isolate;/,
    );
    expect(printRules).toMatch(
      /\.gg-receipt-phone\s*\{[\s\S]*direction:\s*ltr;[\s\S]*unicode-bidi:\s*isolate;[\s\S]*white-space:\s*nowrap;/,
    );
    expect(printRules).toMatch(
      /\.gg-print-area \.gg-order-reference\s*\{[\s\S]*direction:\s*ltr;[\s\S]*unicode-bidi:\s*isolate;/,
    );
  });
});

describe("Arabic delivery details in admin order cards", () => {
  const arabicOrder = {
    ...baseOrder,
    id: "GG-1000000",
    customerName: "سارة Al Balushi",
    customerEmail: "sara@example.test",
    shippingName: "سارة بنت خالد البلوشية",
    shippingAddress: "مبنى ١٢٣، شارع السلطان قابوس، الخوير، مسقط، سلطنة عُمان مع تفاصيل إضافية طويلة للتوصيل",
    governorate: "مسقط Muscat",
    phone: "+968 91234567",
  };

  it("isolates customer, address, email, and phone runs in the order list", () => {
    const adminCard = renderToStaticMarkup(
      <AdminOrderCard o={arabicOrder} changeStatus={vi.fn()} setViewingOrder={vi.fn()} />,
    );

    expect(adminCard).toContain('<span class="gg-admin-bidi" dir="auto">سارة Al Balushi</span>');
    expect(adminCard).toContain('<span class="gg-admin-contact" dir="ltr">sara@example.test</span>');
    expect(adminCard).toContain('<span class="gg-admin-bidi" dir="auto">سارة بنت خالد البلوشية</span>');
    expect(adminCard).toContain(
      '<span class="gg-admin-bidi" dir="auto">مبنى ١٢٣، شارع السلطان قابوس، الخوير، مسقط، سلطنة عُمان مع تفاصيل إضافية طويلة للتوصيل</span>',
    );
    expect(adminCard).toContain('<span class="gg-admin-bidi" dir="auto">مسقط Muscat</span>');
    expect(adminCard).toContain('<span class="gg-admin-contact gg-admin-phone" dir="ltr">+968 91234567</span>');
    expect(adminCard).toContain("View / Print Bill");
  });

  it("wraps long mixed-direction delivery details without clipping", () => {
    const css = readFileSync(new URL("./index.css", import.meta.url), "utf8");
    const bidiRules = css.match(/\.gg-admin-bidi\s*\{([^}]*)\}/)?.[1] ?? "";
    const deliveryRules = [...css.matchAll(/\.gg-admin-delivery\s*\{([^}]*)\}/g)].at(-1)?.[1] ?? "";
    const phoneRules = css.match(/\.gg-admin-phone\s*\{([^}]*)\}/)?.[1] ?? "";

    expect(bidiRules).toContain("overflow-wrap: anywhere");
    expect(bidiRules).toContain("unicode-bidi: isolate");
    expect(deliveryRules).toContain("max-width: 100%");
    expect(deliveryRules).toContain("overflow: visible");
    expect(deliveryRules).not.toMatch(/overflow:\s*hidden/);
    expect(phoneRules).toContain("white-space: nowrap");
  });
});
