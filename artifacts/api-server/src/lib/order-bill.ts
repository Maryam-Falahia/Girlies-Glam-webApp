import type { ordersTable } from "@workspace/db";

type Order = typeof ordersTable.$inferSelect;
type BillLanguage = "en" | "ar";

const labels = {
  en: {
    title: "Girlies Glam Order Bill",
    orderNumber: "Order Number",
    date: "Date",
    shippingTo: "Shipping To",
    items: "Items",
    total: "Total",
    phone: "Phone",
    governorate: "Governorate",
    city: "City",
    postalCode: "Postal Code",
    quantity: "Qty",
    size: "Size",
    thankYou: "Thank you for shopping with Girlies Glam.",
    newOrder: "New order",
  },
  ar: {
    title: "فاتورة طلب Girlies Glam",
    orderNumber: "رقم الطلب",
    date: "التاريخ",
    shippingTo: "التوصيل إلى",
    items: "المنتجات",
    total: "الإجمالي",
    phone: "الهاتف",
    governorate: "المحافظة",
    city: "المدينة",
    postalCode: "الرمز البريدي",
    quantity: "الكمية",
    size: "المقاس",
    thankYou: "شكراً لتسوقك من Girlies Glam.",
    newOrder: "طلب جديد",
  },
} as const;

function languageFor(order: Order): BillLanguage {
  return order.language === "ar" ? "ar" : "en";
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function money(value: number): string {
  return `OMR ${Number(value).toFixed(3)}`;
}

function dateText(order: Order): string {
  return new Date(order.createdAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function detailRow(label: string, value: unknown, direction = "auto"): string {
  if (!value) return "";
  return `<div class="detail"><span class="label">${escapeHtml(label)}</span><span dir="${direction}">${escapeHtml(value)}</span></div>`;
}

export function buildOrderBillText(order: Order): string {
  const copy = labels[languageFor(order)];
  const lines = (order.items ?? []).map((item) =>
    `• ${item.name} | ${copy.size}: ${item.size} | ${copy.quantity}: ${item.qty} | ${money(item.price * item.qty)}`,
  );

  return [
    `${copy.newOrder}: ${order.orderRef}`,
    `${copy.orderNumber}: ${order.orderRef}`,
    `${copy.date}: ${dateText(order)}`,
    "",
    `${copy.shippingTo}:`,
    order.shippingName,
    order.wilayat || order.city || order.shippingAddress,
    order.city ? `${copy.city}: ${order.city}` : "",
    order.governorate ? `${copy.governorate}: ${order.governorate}` : "",
    order.postalCode ? `${copy.postalCode}: ${order.postalCode}` : "",
    order.phone ? `${copy.phone}: ${order.phone}` : "",
    "",
    `${copy.items}:`,
    ...lines,
    "",
    `${copy.total}: ${money(order.total)}`,
    copy.thankYou,
  ].filter(Boolean).join("\n");
}

export function buildOrderBillHtml(order: Order): string {
  const language = languageFor(order);
  const copy = labels[language];
  const items = (order.items ?? []).map((item) => `
    <tr>
      <td dir="auto">${escapeHtml(item.name)}</td>
      <td>${escapeHtml(item.size)}</td>
      <td>${item.qty}</td>
      <td>${money(item.price * item.qty)}</td>
    </tr>`).join("");

  return `<!doctype html>
<html lang="${language}" dir="${language === "ar" ? "rtl" : "ltr"}">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(copy.title)} ${escapeHtml(order.orderRef)}</title>
  <style>
    body { margin: 0; padding: 32px; background: #fffaf3; color: #4a1942; font: 14px Arial, sans-serif; }
    .bill { max-width: 680px; margin: 0 auto; padding: 28px; background: #fff; border: 1px solid #f0dbe8; border-radius: 18px; }
    header { display: flex; justify-content: space-between; gap: 24px; padding-bottom: 18px; border-bottom: 1px solid #f0dbe8; }
    h1 { margin: 0 0 18px; color: #d9548a; font-size: 24px; }
    .meta { color: #8a6d86; line-height: 1.7; }
    h2 { margin: 24px 0 10px; color: #4a1942; font-size: 14px; text-transform: uppercase; letter-spacing: .04em; }
    .details { line-height: 1.8; color: #8a6d86; }
    .detail { display: flex; gap: 8px; flex-wrap: wrap; }
    .label { font-weight: 700; color: #4a1942; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th, td { padding: 10px 6px; border-bottom: 1px solid #f0dbe8; text-align: start; }
    th { color: #8a6d86; font-size: 12px; }
    .total { display: flex; justify-content: space-between; margin-top: 18px; color: #d9548a; font-size: 18px; font-weight: 700; }
    footer { margin-top: 24px; color: #8a6d86; font-size: 12px; }
  </style>
</head>
<body>
  <main class="bill">
    <header>
      <div><h1>Girlies Glam</h1><div class="meta">${escapeHtml(copy.title)}</div></div>
      <div class="meta"><strong>${escapeHtml(copy.orderNumber)}</strong><br><span dir="ltr">${escapeHtml(order.orderRef)}</span><br>${escapeHtml(copy.date)}: ${escapeHtml(dateText(order))}</div>
    </header>
    <h2>${escapeHtml(copy.shippingTo)}</h2>
    <div class="details">
      ${detailRow("", order.shippingName)}
      ${detailRow("", order.wilayat || order.city || order.shippingAddress)}
      ${detailRow(copy.city, order.city)}
      ${detailRow(copy.governorate, order.governorate)}
      ${detailRow(copy.postalCode, order.postalCode)}
      ${detailRow(copy.phone, order.phone, "ltr")}
    </div>
    <h2>${escapeHtml(copy.items)}</h2>
    <table>
      <thead><tr><th>${escapeHtml(copy.items)}</th><th>${escapeHtml(copy.size)}</th><th>${escapeHtml(copy.quantity)}</th><th>${escapeHtml(copy.total)}</th></tr></thead>
      <tbody>${items}</tbody>
    </table>
    <div class="total"><span>${escapeHtml(copy.total)}</span><span dir="ltr">${money(order.total)}</span></div>
    <footer>${escapeHtml(copy.thankYou)}</footer>
  </main>
</body>
</html>`;
}