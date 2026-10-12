import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type Language = "en" | "ar";
export type ThemePreference = "auto" | "light" | "dark";

type PreferencesContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  theme: ThemePreference;
  setTheme: (theme: ThemePreference) => void;
  isArabic: boolean;
  t: (key: string, fallback?: string) => string;
};

const STORAGE_KEYS = {
  language: "girlies-glam-language",
  theme: "girlies-glam-theme",
} as const;

const messages: Record<Language, Record<string, string>> = {
  en: {
    "language.label": "Language",
    "language.english": "English",
    "language.arabic": "العربية",
    "theme.label": "Theme",
    "theme.auto": "Auto",
    "theme.light": "Light",
    "theme.dark": "Dark",
    "preferences.title": "Preferences",
    "preferences.subtitle": "Choose how Girlies Glam looks and reads for you.",
    "preferences.saved": "Your preferences are saved on this device.",
    "nav.home": "Home",
    "nav.shop": "Shop All",
    "nav.jewellery": "Jewellery",
    "nav.admin": "Admin",
    "nav.search": "Search",
    "nav.wishlist": "Wishlist",
    "nav.cart": "Cart",
    "nav.account": "My account",
    "footer.shop": "Shop",
    "footer.help": "Help",
    "footer.account": "Account",
    "footer.orders": "My Orders",
    "footer.signOut": "Sign Out",
    "footer.tagline": "Feminine fashion for everyday sparkle. New drops weekly, made to be photographed.",
    "footer.location": "Girlies Glam — Muscat, Oman · Made with love, glitter & good taste",
    "home.newSeason": "New Season Drop",
    "home.heroTitle": "Dress up your everyday sparkle",
    "home.heroCopy": "Feminine fits, buttery-soft fabrics, and just the right amount of glam — curated for the girlies who like their outfits camera-ready.",
    "home.shopCollection": "Shop the Collection",
    "home.shopCategory": "Shop by Category",
    "home.findFavorite": "Find your next favorite fit",
    "home.shopJewellery": "Shop Jewellery",
    "home.finishingTouches": "Finishing touches for every look",
    "home.bestsellers": "Bestsellers",
    "home.lovedBy": "Loved by the Girlies Glam community",
    "home.newArrivals": "New Arrivals",
    "home.freshOffRack": "Fresh off the rack this week",
    "home.viewAll": "View all →",
    "home.freeShipping": "Shipping",
    "home.freeShippingDetail": "Shipping on orders OMR 2.000",
    "home.easyReturns": "Returns",
    "home.easyReturnsDetail": "Returns is NOT acceptable",
    "home.secureCheckout": "Secure Checkout",
    "home.secureCheckoutDetail": "Your payments, protected",
    "shop.category": "Category",
    "shop.allItems": "All Items",
    "shop.items": "items",
    "shop.sortFeatured": "Sort: Featured",
    "shop.sortLow": "Price: Low to High",
    "shop.sortHigh": "Price: High to Low",
    "shop.sortRating": "Top Rated",
    "product.back": "← Back to shop",
    "product.selectSize": "Select Size",
    "product.addToBag": "Add to Bag",
    "product.freeShipping": "Shipping on orders OMR 2.000",
    "product.returns": "Returns is NOT acceptable",
    "product.reviews": "reviews",
    "cart.title": "Your Bag",
    "cart.empty": "Your bag is feeling light. Go find something sparkly!",
    "cart.subtotal": "Subtotal",
    "cart.shippingTaxes": "Shipping & taxes calculated at checkout",
    "cart.checkout": "Checkout",
    "cart.size": "Size",
    "checkout.back": "← Back to shop",
    "checkout.title": "Checkout",
    "checkout.notice": "Online card and Apple Pay checkout is not connected for Oman yet. You can still submit your order and we’ll follow up with payment instructions.",
    "checkout.shippingAddress": "Shipping Address",
    "checkout.fullName": "Full Name",
    "checkout.address": "Address",
    "checkout.city": "City",
    "checkout.postalCode": "Postal Code",
    "checkout.phone": "Phone Number",
    "checkout.phonePlaceholder": "8-digit number",
    "checkout.governorate": "Governorate",
    "checkout.selectGovernorate": "Select Governorate",
    "checkout.saving": "Saving order...",
    "checkout.submit": "Submit Order",
    "checkout.noCharge": "No payment is charged until an Oman-supported gateway is connected.",
    "checkout.summary": "Order Summary",
    "checkout.shipping": "Shipping",
    "checkout.free": "Free",
    "receipt.orderReceived": "Order received!",
    "receipt.followUp": "Our team will follow up with payment instructions for Oman.",
    "receipt.backOrders": "← Back to My Orders",
    "receipt.orderNumber": "Order Number",
    "receipt.date": "Date",
    "receipt.shippingTo": "Shipping To",
    "receipt.items": "Items",
    "receipt.total": "Total",
    "receipt.print": "Print / Save as PDF",
    "receipt.continueShopping": "Continue Shopping",
    "account.myOrders": "My Orders",
    "account.wishlist": "Wishlist",
    "account.profile": "Profile",
    "account.noActiveOrders": "No active orders right now.",
    "account.orderFinished": "Order Finished",
    "account.noOrders": "No orders yet — your next favorite fit is waiting.",
    "account.nothingSaved": "Nothing saved yet — tap the heart on anything you love.",
    "account.fullName": "Full Name",
    "account.email": "Email",
    "account.viewBill": "View Bill",
    "account.signOut": "Sign Out",
    "status.submitted": "Submitted",
    "status.inProcess": "In Process",
    "status.packed": "Packed",
    "status.inDelivery": "In Delivery",
    "status.received": "Received",
    "common.loading": "Loading your glam...",
    "common.loadingShort": "Loading...",
    "common.new": "New",
    "common.bestseller": "Bestseller",
    "common.sale": "Sale",
    "common.size": "Size",
    "common.qty": "Qty",
  },
  ar: {
    "language.label": "اللغة",
    "language.english": "English",
    "language.arabic": "العربية",
    "theme.label": "المظهر",
    "theme.auto": "تلقائي",
    "theme.light": "فاتح",
    "theme.dark": "داكن",
    "preferences.title": "التفضيلات",
    "preferences.subtitle": "اختاري طريقة عرض وقراءة Girlies Glam المناسبة لك.",
    "preferences.saved": "يتم حفظ تفضيلاتك على هذا الجهاز.",
    "nav.home": "الرئيسية",
    "nav.shop": "كل المنتجات",
    "nav.jewellery": "المجوهرات",
    "nav.admin": "الإدارة",
    "nav.search": "بحث",
    "nav.wishlist": "المفضلة",
    "nav.cart": "السلة",
    "nav.account": "حسابي",
    "footer.shop": "تسوقي",
    "footer.help": "المساعدة",
    "footer.account": "الحساب",
    "footer.orders": "طلباتي",
    "footer.signOut": "تسجيل الخروج",
    "footer.tagline": "أزياء أنثوية لتتألقي كل يوم. تشكيلات جديدة كل أسبوع، مصممة لتظهري بأجمل إطلالة.",
    "footer.location": "Girlies Glam — مسقط، عُمان · صُنع بحب ولمعة وذوق رفيع",
    "home.newSeason": "تشكيلة الموسم الجديدة",
    "home.heroTitle": "زيّني أيامك بتألّقك",
    "home.heroCopy": "إطلالات أنثوية، أقمشة ناعمة، ولمسة من الأناقة — مختارة للفتيات اللواتي يحببن إطلالة جاهزة للتصوير.",
    "home.shopCollection": "تسوّقي التشكيلة",
    "home.shopCategory": "تسوّقي حسب الفئة",
    "home.findFavorite": "اختاري إطلالتك المفضلة",
    "home.shopJewellery": "تسوّقي المجوهرات",
    "home.finishingTouches": "لمسات تكمل كل إطلالة",
    "home.bestsellers": "الأكثر مبيعاً",
    "home.lovedBy": "محبوبة من مجتمع Girlies Glam",
    "home.newArrivals": "وصل حديثاً",
    "home.freshOffRack": "تشكيلات جديدة هذا الأسبوع",
    "home.viewAll": "عرض الكل ←",
    "home.freeShipping": "الشحن",
    "home.freeShippingDetail": "الشحن على الطلبات بقيمة 2.000 ر.ع",
    "home.easyReturns": "الإرجاع",
    "home.easyReturnsDetail": "الإرجاع غير مقبول",
    "home.secureCheckout": "دفع آمن",
    "home.secureCheckoutDetail": "مدفوعاتك محمية",
    "shop.category": "الفئة",
    "shop.allItems": "كل المنتجات",
    "shop.items": "منتجات",
    "shop.sortFeatured": "ترتيب: مميز",
    "shop.sortLow": "السعر: من الأقل للأعلى",
    "shop.sortHigh": "السعر: من الأعلى للأقل",
    "shop.sortRating": "الأعلى تقييماً",
    "product.back": "← العودة للتسوق",
    "product.selectSize": "اختاري المقاس",
    "product.addToBag": "أضيفي إلى السلة",
    "product.freeShipping": "الشحن على الطلبات بقيمة 2.000 ر.ع",
    "product.returns": "الإرجاع غير مقبول",
    "product.reviews": "تقييمات",
    "cart.title": "سلتك",
    "cart.empty": "سلتك فارغة حالياً. اكتشفي شيئاً لامعاً!",
    "cart.subtotal": "المجموع الفرعي",
    "cart.shippingTaxes": "يُحسب الشحن والضرائب عند الدفع",
    "cart.checkout": "إتمام الطلب",
    "cart.size": "المقاس",
    "checkout.back": "← العودة للتسوق",
    "checkout.title": "إتمام الطلب",
    "checkout.notice": "الدفع بالبطاقة وApple Pay غير متاحين في عُمان حالياً. يمكنك إرسال طلبك وسنتواصل معك بتعليمات الدفع.",
    "checkout.shippingAddress": "عنوان التوصيل",
    "checkout.fullName": "الاسم الكامل",
    "checkout.address": "العنوان",
    "checkout.city": "المدينة",
    "checkout.postalCode": "الرمز البريدي",
    "checkout.phone": "رقم الهاتف",
    "checkout.phonePlaceholder": "رقم من 8 أرقام",
    "checkout.governorate": "المحافظة",
    "checkout.selectGovernorate": "اختاري المحافظة",
    "checkout.saving": "جارٍ حفظ الطلب...",
    "checkout.submit": "إرسال الطلب",
    "checkout.noCharge": "لن يتم تحصيل أي مبلغ حتى يتم ربط بوابة دفع مدعومة في عُمان.",
    "checkout.summary": "ملخص الطلب",
    "checkout.shipping": "الشحن",
    "checkout.free": "مجاني",
    "receipt.orderReceived": "تم استلام الطلب!",
    "receipt.followUp": "سيتواصل معك فريقنا بتعليمات الدفع الخاصة بعُمان.",
    "receipt.backOrders": "← العودة إلى طلباتي",
    "receipt.orderNumber": "رقم الطلب",
    "receipt.date": "التاريخ",
    "receipt.shippingTo": "التوصيل إلى",
    "receipt.items": "المنتجات",
    "receipt.total": "الإجمالي",
    "receipt.print": "طباعة / حفظ كملف PDF",
    "receipt.continueShopping": "متابعة التسوق",
    "account.myOrders": "طلباتي",
    "account.wishlist": "المفضلة",
    "account.profile": "الملف الشخصي",
    "account.noActiveOrders": "لا توجد طلبات حالية.",
    "account.orderFinished": "الطلبات المكتملة",
    "account.noOrders": "لا توجد طلبات بعد — قطعتك المفضلة القادمة بانتظارك.",
    "account.nothingSaved": "لم تحفظي شيئاً بعد — اضغطي على القلب لأي قطعة تحبينها.",
    "account.fullName": "الاسم الكامل",
    "account.email": "البريد الإلكتروني",
    "account.viewBill": "عرض الفاتورة",
    "account.signOut": "تسجيل الخروج",
    "status.submitted": "تم الإرسال",
    "status.inProcess": "قيد التجهيز",
    "status.packed": "تم التغليف",
    "status.inDelivery": "قيد التوصيل",
    "status.received": "تم الاستلام",
    "common.loading": "جارٍ تحميل أناقتك...",
    "common.loadingShort": "جارٍ التحميل...",
    "common.new": "جديد",
    "common.bestseller": "الأكثر مبيعاً",
    "common.sale": "تخفيض",
    "common.size": "المقاس",
    "common.qty": "الكمية",
  },
};

const defaultPreferences: PreferencesContextValue = {
  language: "en",
  setLanguage: () => {},
  theme: "auto",
  setTheme: () => {},
  isArabic: false,
  t: (key, fallback) => fallback ?? messages.en[key] ?? key,
};
const PreferencesContext = createContext<PreferencesContextValue>(defaultPreferences);

function readStored<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  if (typeof window === "undefined") return fallback;
  const stored = window.localStorage.getItem(key);
  return stored && allowed.includes(stored as T) ? stored as T : fallback;
}

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => readStored(STORAGE_KEYS.language, ["en", "ar"], "en"));
  const [theme, setThemeState] = useState<ThemePreference>(() => readStored(STORAGE_KEYS.theme, ["auto", "light", "dark"], "auto"));

  const setLanguage = (next: Language) => {
    setLanguageState(next);
    window.localStorage.setItem(STORAGE_KEYS.language, next);
  };
  const setTheme = (next: ThemePreference) => {
    setThemeState(next);
    window.localStorage.setItem(STORAGE_KEYS.theme, next);
  };

  useEffect(() => {
    const root = document.documentElement;
    root.lang = language;
    root.dir = language === "ar" ? "rtl" : "ltr";
    root.dataset.theme = theme;
  }, [language, theme]);

  const value = useMemo<PreferencesContextValue>(() => ({
    language,
    setLanguage,
    theme,
    setTheme,
    isArabic: language === "ar",
    t: (key, fallback) => messages[language][key] ?? fallback ?? messages.en[key] ?? key,
  }), [language, theme]);

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences() {
  return useContext(PreferencesContext);
}