import { useEffect, useMemo, useState } from "react";
import { Heart, Search, ShoppingBag, User as UserIcon, X, Minus, Plus, Trash2, Star, Sparkles, Truck, RotateCcw, ShieldCheck, Lock, LogOut, Package, CheckCircle2, Printer, Ruler, Eye, EyeOff, Tag, CalendarClock } from "lucide-react";
import { BackgroundCanvas } from "@/components/BackgroundCanvas";
import { OrderReference } from "@/components/OrderReference";
import { DeliveryPromise, ProductReviews, SizeGuide, WhatsAppSupport } from "@/components/StoreFeatures";
import { usePreferences } from "@/lib/preferences";
import { PRODUCTS, USERS } from "@/lib/data";

type ProductVariant = { colorway:string; swatch:string; imageUrl?:string|null };
type Product = { id:string; name:string; category:string; price:number; compareAt?:number|null; colorway:string; swatch:string; sizes:string[]; isNew:boolean; isBestseller:boolean; isVisible:boolean; rating:number; reviews:number; description:string; imageUrl?:string|null; variants?:ProductVariant[]|null };
type User = { id:string; name:string; email:string; initials:string; isAdmin?:boolean };
type Line = { productId:string; size:string; qty:number; colorway?:string };
type Order = { id:string; date:string; items:{name:string;size:string;qty:number;price:number;colorway?:string}[]; total:number; status:string; language?:"en"|"ar"; shippingName?:string; shippingAddress?:string; phone?:string; governorate?:string; wilayat?:string; postalCode?:string; transferReceiptAvailable?:boolean; customerName?:string; customerEmail?:string; promoCode?:string|null; discountAmount?:number };
type ReviewModerationStatus = "visible" | "hidden" | "pending";
type DiscountStatus = "Scheduled" | "Active" | "Expired" | "Disabled";
type Discount = { id:number; code:string; percentage:number; categories:string[]; startsAt:string; endsAt:string; isEnabled:boolean; status:DiscountStatus; createdAt:string };
type AdminReview = { id:number; productId:string; productName:string; userId:number; customerName:string; customerEmail:string; rating:number; title:string; body:string; moderationStatus:ReviewModerationStatus; createdAt:string };

type CheckoutLanguage = "en" | "ar";
const ORDER_STATUSES = ["Submitted","In Process","Packed","In Delivery","Received"];
const OMAN_GOVERNORATES = ["Muscat","Dhofar","North Al Batinah","South Al Batinah","Al Dakhiliyah","North Al Sharqiyah","South Al Sharqiyah","Al Wusta","Al Dhahirah","Musandam","Al Buraimi"];
const OMAN_WILAYATS:Record<string,string[]> = {
  Muscat:["Muscat","Muttrah","Bawshar","Seeb","Al Amerat","Qurayyat"],
  Dhofar:["Salalah","Taqah","Mirbat","Thumrait","Muqshin","Shalim and the Hallaniyat Islands","Sadah","Rakhyut","Dhalkut","Al Mazyunah","Maqshan"],
  "North Al Batinah":["Sohar","Shinas","Liwa","Saham","Al Khaburah","Al Suwaiq"],
  "South Al Batinah":["Rustaq","Al Awabi","Nakhal","Wadi Al Maawil","Al Musannah","Barka"],
  "Al Dakhiliyah":["Nizwa","Bahla","Manah","Al Hamra","Adam","Izki","Samail","Bidbid"],
  "North Al Sharqiyah":["Ibra","Al Mudaybi","Bidiyah","Al Qabil","Wadi Bani Khalid","Dima Wa'tayeen","Sinaw"],
  "South Al Sharqiyah":["Sur","Jalan Bani Bu Ali","Jalan Bani Bu Hassan","Al Kamil Wal Wafi","Masirah"],
  "Al Wusta":["Haima","Mahout","Duqm","Al Jazir"],
  "Al Dhahirah":["Ibri","Yanqul","Dhank"],
  Musandam:["Khasab","Bukha","Dibba","Madha"],
  "Al Buraimi":["Al Buraimi","Mahdah","Al Sunaynah"],
};
const clothingCategories = ["Cotton Makhwar","Italy Silk Makhwar","Digital Cotton Liberty","Cotton Amoudi Makhwar","Makhwar Scarfs"];
const jewelryCategories = ["Earrings","Full Sets","Necklace","Bracelet","Rings"];
const categories = [...clothingCategories, ...jewelryCategories];
const categoryEmoji:Record<string,string> = { "Cotton Makhwar":"🧵", "Italy Silk Makhwar":"✨", "Digital Cotton Liberty":"🌸", "Cotton Amoudi Makhwar":"♡", "Makhwar Scarfs":"🧣", Earrings:"💎", "Full Sets":"👑", Necklace:"📿", Bracelet:"⭐", Rings:"💍" };
const categoryBlurb:Record<string,string> = {
  "Cotton Makhwar": "Soft, breathable comfort",
  "Italy Silk Makhwar": "Luxe silk finish",
  "Digital Cotton Liberty": "Prints made to bloom",
  "Cotton Amoudi Makhwar": "Lightweight everyday glam",
  "Makhwar Scarfs": "Embroidered color for every look",
  Earrings: "Statement studs and hoops",
  "Full Sets": "Matching sets, effortless glam",
  Necklace: "Layer-worthy pieces",
  Bracelet: "Delicate arm candy",
  Rings: "Little details that shine",
};
const JEWELLERY_COLORS = ["Silver","Gold","Golden Rose"];
const PRODUCT_SIZE_OPTIONS = ["One Size","Small","Medium","Large","X Large"];
const SHIPPING_FEE = 2;

async function api<T>(path:string, init?:RequestInit):Promise<T> {
  let response: Response;
  try {
    response = await fetch("/api" + path, { ...init, credentials:"include", headers:{"Content-Type":"application/json", ...(init?.headers || {})} });
  } catch {
    throw new Error("API unavailable");
  }
  const contentType = response.headers.get("content-type") || "";
  const text = await response.text();
  if (contentType.includes("text/html") || text.trimStart().startsWith("<")) {
    throw new Error("API unavailable");
  }
  let body: any;
  if (text) {
    try { body = JSON.parse(text); }
    catch { throw new Error("API unavailable"); }
  }
  if (!response.ok) throw new Error(body?.error || body?.message || response.statusText);
  return (response.status === 204 ? undefined : body) as T;
}
function isBackendUnavailable(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  return /not found|failed to fetch|networkerror|load failed|api unavailable|unexpected token|not valid json|doctype/i.test(message);
}
function catalogFallback(): Product[] {
  return PRODUCTS.map((product) => ({
    ...product,
    isNew: Boolean(product.isNew),
    isBestseller: Boolean(product.isBestseller),
    isVisible: true,
  }));
}
function demoUserFromCredentials(email: string, password: string): User | null {
  const match = USERS.find((user) => user.email.toLowerCase() === email.trim().toLowerCase() && user.pass === password);
  if (!match) return null;
  return { id: "demo", name: match.name, email: match.email, initials: match.initials, isAdmin: true };
}
function money(value:number) { return `OMR ${value.toFixed(3)}`; }

const checkoutCopy = {
  en: {
    language:"Language", english:"English", arabic:"العربية", backShop:"← Back to shop", checkout:"Checkout",
    paymentNotice:"Online card and Apple Pay checkout is not connected for Oman yet. You can still submit your order and we’ll follow up with payment instructions.",
    shippingAddress:"Delivery Details", fullName:"First Name", address:"Address", city:"City", postalCode:"Postal Code",
    phone:"Phone Number", phonePlaceholder:"8-digit number", governorate:"Governorate", selectGovernorate:"Select Governorate", wilayat:"Wilayat", selectWilayat:"Select Wilayat",
     transferPayment:"Bank / Phone Transfer Details", transferNotConfigured:"Transfer details will be added by the store soon.", transferReceipt:"Transfer Receipt", transferReceiptRequired:"Upload your transfer receipt before placing the order.", invalidReceipt:"Upload a JPG, PNG, WEBP image or PDF smaller than 5 MB that clearly shows the bank or phone-transfer receipt.",
    saving:"Saving order...", submit:"Make Payment", noCharge:"All transactions are secure and encrypted.",
    paymentReceipt:"Payment Receipt",
    paymentReceiptRequired:"To confirm the order, please upload the payment receipt here.",
    summary:"Order Summary", subtotal:"Subtotal", shipping:"Shipping", free:"Free", total:"Total",
    invalidPhone:"Enter a valid Oman phone number with exactly 8 digits.", failedOrder:"Unable to place order",
    received:"Order received!", followUp:"Our team will follow up with payment instructions for Oman.",
    backOrders:"← Back to My Orders", orderNumber:"Order Number", date:"Date", shippingTo:"Shipping To", items:"Items",
     print:"Print / Save as PDF", continueShopping:"Continue Shopping", backToOrders:"Back to My Orders",
     promoCode:"Promo code", promoPlaceholder:"Enter your code", applyPromo:"Apply code", applyingPromo:"Checking...", discount:"Discount", promoApplied:"Code applied", promoHint:"Savings apply to eligible items only.",
  },
  ar: {
    language:"اللغة", english:"English", arabic:"العربية", backShop:"العودة إلى المتجر ←", checkout:"إتمام الطلب",
    paymentNotice:"الدفع الإلكتروني بالبطاقة وApple Pay غير متصل بعد في عُمان. يمكنك إرسال طلبك وسنتواصل معك بتعليمات الدفع.",
    shippingAddress:"بيانات التوصيل", fullName:"الاسم الأول", address:"العنوان", city:"المدينة", postalCode:"الرمز البريدي",
    phone:"رقم الهاتف", phonePlaceholder:"رقم من 8 أرقام", governorate:"المحافظة", selectGovernorate:"اختر المحافظة", wilayat:"الولاية", selectWilayat:"اختر الولاية",
     transferPayment:"تفاصيل التحويل البنكي / عبر الهاتف", transferNotConfigured:"ستتم إضافة تفاصيل التحويل من المتجر قريباً.", transferReceipt:"إيصال التحويل", transferReceiptRequired:"يرجى رفع إيصال التحويل قبل إرسال الطلب.", invalidReceipt:"ارفع صورة JPG أو PNG أو WEBP أو ملف PDF بحجم أقل من 5 ميجابايت ويظهر فيه بوضوح إيصال التحويل البنكي أو عبر الهاتف.",
    saving:"جارٍ حفظ الطلب...", submit:"إجراء الدفع", noCharge:"جميع المعاملات آمنة ومشفرة.",
    paymentReceipt:"إيصال الدفع",
    paymentReceiptRequired:"لتأكيد الطلب، يرجى رفع إيصال الدفع هنا.",
    summary:"ملخص الطلب", subtotal:"المجموع الفرعي", shipping:"التوصيل", free:"مجاني", total:"الإجمالي",
    invalidPhone:"أدخل رقم هاتف عُمانيًا صحيحًا مكونًا من 8 أرقام.", failedOrder:"تعذر إرسال الطلب",
    received:"تم استلام طلبك!", followUp:"سيتواصل فريقنا معك لإرسال تعليمات الدفع في عُمان.",
    backOrders:"العودة إلى طلباتي ←", orderNumber:"رقم الطلب", date:"التاريخ", shippingTo:"التوصيل إلى", items:"المنتجات",
     print:"طباعة / حفظ بصيغة PDF", continueShopping:"متابعة التسوق", backToOrders:"العودة إلى طلباتي",
     promoCode:"رمز الخصم", promoPlaceholder:"أدخل الرمز", applyPromo:"تطبيق الرمز", applyingPromo:"جارٍ التحقق...", discount:"الخصم", promoApplied:"تم تطبيق الرمز", promoHint:"يُطبق الخصم على المنتجات المؤهلة فقط.",
  },
} as const;
function BrandMark({ variant, dark=false }: {variant:"auth"|"nav"|"footer"; dark?:boolean}) {
  return <span className={`gg-logo gg-logo-${variant}${dark?" gg-logo-dark":""}`} aria-label="Girlies Glam" role="img"><span className="gg-logo-sparkle gg-logo-sparkle-left" aria-hidden="true"><Sparkles/></span><span className="gg-logo-words"><span className="gg-logo-script">Girlies</span><span className="sub">Glam</span></span><span className="gg-logo-sparkle gg-logo-sparkle-right" aria-hidden="true"><Sparkles/></span></span>;
}

function ProductImage({ product, large=false, imageUrl, swatch }: {product:Product;large?:boolean;imageUrl?:string|null;swatch?:string}) {
  const src = imageUrl !== undefined ? imageUrl : product.imageUrl;
  const bg = swatch || product.swatch;
  if (src) {
    return <div className={large ? "gg-pd-image" : "gg-card-img"} style={{overflow:"hidden",padding:0}}><img src={src} alt={product.name} style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}}/></div>;
  }
  return <div className={large ? "gg-pd-image" : "gg-card-img"} style={{background:`linear-gradient(155deg, ${bg} 0%, #fff 130%)`,display:"flex",alignItems:"center",justifyContent:"center"}}><span style={{fontSize:large?140:72}}>{categoryEmoji[product.category] || "✦"}</span></div>;
}
function ProductCard({ product, wished, onOpen, onWish }: {product:Product; wished:boolean; onOpen:()=>void; onWish:()=>void}) {
  return <div className="gg-card fade-in" onClick={onOpen}><ProductImage product={product}/>{(product.isNew || product.isBestseller || product.compareAt) && <span className={`gg-card-tag ${product.isNew?"gg-tag-new":product.isBestseller?"gg-tag-best":"gg-tag-sale"}`}>{product.isNew?"New":product.isBestseller?"Bestseller":"Sale"}</span>}<button className="gg-wish-btn" onClick={e=>{e.stopPropagation();onWish()}} aria-label="Wishlist"><Heart size={15} fill={wished?"currentColor":"none"}/></button><div className="gg-card-body"><div className="gg-card-cat">{product.category} · {product.colorway}</div><div className="gg-card-name">{product.name}</div><div className="gg-card-price-row"><span className="gg-price">{money(product.price)}</span>{product.compareAt && <span className="gg-price-compare">{money(product.compareAt)}</span>}</div><div className="gg-rating"><Star size={11} style={{display:"inline",marginBottom:2,color:"#e8b04b"}} fill="#e8b04b"/> {product.rating} ({product.reviews})</div></div></div>;
}
function Auth({ onUser, onGuest }: {onUser:(u:User)=>void; onGuest:()=>void}) {
  const [mode,setMode]=useState<"login"|"signup">("login");
  const [name,setName]=useState("");
  const [email,setEmail]=useState("demo@girliesglam.com");
  const [password,setPassword]=useState("glam123");
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [busy,setBusy]=useState(false);
  const [showPassword,setShowPassword]=useState(false);
  const submit=async(e:React.FormEvent)=>{
    e.preventDefault();
    setError("");
    setNotice("");
    setBusy(true);
    try{
      const data:any=await api(mode==="login"?"/auth/login":"/auth/register",{method:"POST",body:JSON.stringify(mode==="login"?{email,password}:{name,email,password})});
      onUser(data.user);
    }catch(err){
      if(isBackendUnavailable(err)){
        if(mode==="login"){
          const demo=demoUserFromCredentials(email,password);
          if(demo){onUser(demo);return;}
          setError("We couldn't sign you in. Check your email and password and try again.");
          return;
        }
        const initials=name.trim().split(" ").map((part)=>part[0]).join("").slice(0,2).toUpperCase()||"GG";
        onUser({id:"local",name:name.trim(),email:email.trim().toLowerCase(),initials,isAdmin:false});
        return;
      }
      const message=err instanceof Error?err.message:"";
      if(message==="Invalid email or password") setError("We couldn't sign you in. Check your email and password and try again.");
      else if(message==="Email already in use") setError("That email is already registered. Try signing in instead.");
      else if(message.toLowerCase().includes("password")) setError("Use a password with at least 6 characters.");
      else if(message) setError(message);
      else setError(mode==="login"?"We couldn't sign you in right now. Please try again.":"We couldn't create your account right now. Please try again.");
    }finally{setBusy(false)}
  };
  const switchMode=(nextMode:"login"|"signup")=>{
    setMode(nextMode);
    setError("");
    setNotice("");
    setShowPassword(false);
  };
  return <div id="gg-auth"><div className="gg-auth-box">
    <div style={{textAlign:"center",marginBottom:28}}><BrandMark variant="auth"/><div style={{fontSize:12.5,color:"var(--text2)",marginTop:18,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}><Sparkles size={13}/> Feminine fashion, made to sparkle</div></div>
    {error&&<div className="gg-error-msg" role="alert">{error}</div>}
    {notice&&<div className="gg-auth-notice" role="status">{notice}</div>}
    <form onSubmit={submit}>
      {mode==="signup"&&<><label className="gg-field-label" htmlFor="auth-name">Full Name</label><input id="auth-name" className="gg-inp" autoComplete="name" value={name} onChange={e=>setName(e.target.value)} placeholder="Your name" required/></>}
      <label className="gg-field-label" htmlFor="auth-email">Email Address</label>
      <input id="auth-email" className="gg-inp" type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" required/>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12}}>
        <label className="gg-field-label" htmlFor="auth-password">Password</label>
        {mode==="login"&&<button type="button" className="gg-auth-link" onClick={()=>{setError("");setNotice("Password reset is not available yet. Please contact Girlies Glam support to reset your account.")}}>Forgot password?</button>}
      </div>
      <div className="gg-password-field">
        <input id="auth-password" className="gg-inp" type={showPassword?"text":"password"} autoComplete={mode==="login"?"current-password":"new-password"} value={password} onChange={e=>setPassword(e.target.value)} placeholder={mode==="login"?"••••••••":"Create a password"} required minLength={6} />
        <button type="button" className="gg-password-toggle" onClick={()=>setShowPassword(value=>!value)} aria-label={showPassword?"Hide password":"Show password"}>{showPassword?<EyeOff size={17}/>:<Eye size={17}/>}</button>
      </div>
      <button type="submit" className="gg-btn" style={{width:"100%",marginTop:4}} disabled={busy}>{busy?(mode==="login"?"Signing in...":"Creating account..."):(mode==="login"?"Sign In":"Create Account")}</button>
      <div className="gg-auth-switch">{mode==="login"?"New here?":"Already glam?"} <button type="button" className="gg-auth-link" onClick={()=>switchMode(mode==="login"?"signup":"login")}>{mode==="login"?"Create an account":"Sign in"}</button></div>
      {mode==="login"&&<>
        <button type="button" className="gg-btn-outline gg-guest-btn" onClick={onGuest}>Continue as guest</button>
        <div style={{textAlign:"center",fontSize:11.5,color:"var(--text3)",marginTop:10}}>Browse the collection without an account. Sign in when you’re ready to save favorites or checkout.</div>
      </>}
    </form>
  </div></div>;
}
function Header({ user, page, count, wishCount, go, openCart, logout }:any) {
 const { t } = usePreferences();
 return <nav id="gg-nav"><div style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer"}} onClick={()=>go("home")}><BrandMark variant="nav"/></div><div className="gg-nav-links"><span className={`gg-nav-link ${page==="home"?"active":""}`} onClick={()=>go("home")}>{t("nav.home")}</span><span className={`gg-nav-link ${page==="shop"?"active":""}`} onClick={()=>go("shop")}>{t("nav.shop")}</span>{clothingCategories.map(c=><span key={c} className="gg-nav-link" onClick={()=>go("shop",c)}>{c}</span>)}<span className="gg-nav-dropdown"><span className="gg-nav-link">{t("nav.jewellery")} ▾</span><div className="gg-nav-dropdown-menu"><div className="gg-nav-dropdown-menu-inner">{jewelryCategories.map(c=><span key={c} onClick={()=>go("shop",c)}>{categoryEmoji[c]} {c}</span>)}</div></div></span>{user.isAdmin&&<span className={`gg-nav-link ${page==="admin"?"active":""}`} onClick={()=>go("admin")} style={{fontWeight:700,color:"var(--pink-deep)"}}>{t("nav.admin")}</span>}</div><div className="gg-nav-icons"><button className="gg-icon-btn" title={t("nav.search")} onClick={()=>go("shop")}><Search size={19}/></button><button className="gg-icon-btn" title={t("nav.wishlist")} onClick={()=>go("account","wishlist")}><Heart size={19}/>{wishCount>0&&<span className="gg-cart-count">{wishCount}</span>}</button><button className="gg-icon-btn" title={t("nav.cart")} onClick={openCart}><ShoppingBag size={19}/>{count>0&&<span className="gg-cart-count">{count}</span>}</button><button className="gg-icon-btn" title={user.name} onClick={()=>go("account")}><UserIcon size={19}/></button></div></nav>;
}
function Footer({go,logout}:any){return <footer id="gg-footer"><div className="gg-footer-grid gg-container"><div><BrandMark variant="footer" dark/><p style={{fontSize:13,color:"#d9b8ce",marginTop:16,maxWidth:260,lineHeight:1.6}}>Feminine fashion for everyday sparkle. New drops weekly, made to be photographed.</p></div><div><div className="gg-footer-title">Shop</div>{categories.map(c=><span key={c} className="gg-footer-link" style={{cursor:"pointer"}} onClick={()=>go("shop",c)}>{c}</span>)}</div><div><div className="gg-footer-title">Help</div><span className="gg-footer-link">Shipping & Returns</span><span className="gg-footer-link">Size Guide</span><span className="gg-footer-link">Contact Us</span></div><div><div className="gg-footer-title">Account</div><span className="gg-footer-link" style={{cursor:"pointer"}} onClick={()=>go("account")}>My Account</span><span className="gg-footer-link" style={{cursor:"pointer"}} onClick={logout}>Sign Out</span></div></div><div className="gg-footer-bottom">Girlies Glam — Muscat, Oman · Made with love, glitter & good taste</div></footer>}
  function Home({products,go,wished,toggleWish,open}:any){const best=products.filter((p:Product)=>p.isBestseller).slice(0,4);const newer=products.filter((p:Product)=>p.isNew).slice(0,4);return <div><section className="gg-hero"><div><div className="gg-hero-eyebrow"><Sparkles size={13}/> New Season Drop</div><h1 className="gg-hero-title">Dress up your <em>everyday</em> sparkle</h1><p className="gg-hero-copy">Feminine fits, buttery-soft fabrics, and just the right amount of glam — curated for the girlies who like their outfits camera-ready.</p><div style={{display:"flex",gap:14,flexWrap:"wrap"}}><button className="gg-btn" onClick={()=>go("shop")}>Shop the Collection</button></div></div><div className="gg-visual"><img className="gg-visual-image" src="/girlies-glam-editorial-hero.jpg" alt="Girlies Glam editorial fashion" /><Sparkles className="spark" size={28} style={{top:"14%",left:"18%"}}/><Sparkles className="spark" size={40} style={{top:"55%",left:"65%",animationDelay:"1s"}}/></div></section><section className="gg-section gg-container"><div className="gg-section-head"><div><div className="gg-section-title">Shop by Category</div><div className="gg-section-sub">Find your next favorite fit</div></div></div><div className="gg-cat-grid">{clothingCategories.map(c=><div key={c} className="gg-cat-tile" onClick={()=>go("shop",c)}><div className="gg-cat-name">{c}</div><div className="gg-cat-blurb">{categoryBlurb[c]}</div></div>)}</div></section><section className="gg-section gg-container"><div className="gg-section-head"><div><div className="gg-section-title">Shop Jewellery</div><div className="gg-section-sub">Finishing touches for every look</div></div></div><div className="gg-cat-grid">{jewelryCategories.map(c=><div key={c} className="gg-cat-tile" onClick={()=>go("shop",c)}><div className="gg-cat-name">{c}</div><div className="gg-cat-blurb">{categoryBlurb[c]}</div></div>)}</div></section>{[["Bestsellers","Loved by the Girlies Glam community",best],["New Arrivals","Fresh off the rack this week",newer]].map(([title,sub,list]:any)=><section key={title} className="gg-section gg-container"><div className="gg-section-head"><div><div className="gg-section-title">{title}</div><div className="gg-section-sub">{sub}</div></div><span className="gg-nav-link" style={{cursor:"pointer"}} onClick={()=>go("shop")}>View all →</span></div><div className="gg-grid">{list.map((p:Product)=><ProductCard key={p.id} product={p} wished={wished.has(p.id)} onOpen={()=>open(p)} onWish={()=>toggleWish(p)}/>)}</div></section>)}<section className="gg-section gg-container" style={{paddingTop:0}}><div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:20}}>{[[<Truck size={20}/>,"Shipping","Shipping on orders OMR 2.000"],[<RotateCcw size={20}/>,"Returns","Returns is NOT acceptable"],[<ShieldCheck size={20}/>,"Secure Checkout","Your payments, protected"]].map(([icon,t,b]:any)=><div key={t} style={{background:"#fff",border:"1px solid var(--border)",borderRadius:16,padding:20,display:"flex",gap:14,alignItems:"center"}}><div style={{color:"var(--pink)"}}>{icon}</div><div><div style={{fontWeight:700,fontSize:13.5,color:"var(--plum)"}}>{t}</div><div style={{fontSize:12,color:"var(--text2)"}}>{b}</div></div></div>)}</div></section></div>}
  function Shop({products,go,wished,toggleWish,open,initial}:any){
    const [cat,setCat]=useState(initial||"All");
    const [sort,setSort]=useState("featured");
    const [query,setQuery]=useState("");
    useEffect(()=>{setCat(initial||"All");setQuery("")},[initial]);
    const normalizedQuery=query.trim().toLowerCase();
    const list=useMemo(()=>{
      let x=products.filter((p:Product)=>cat==="All"||p.category===cat);
      if(normalizedQuery){
        x=x.filter((p:Product)=>[p.name,p.category,p.colorway,p.description].some(value=>value.toLowerCase().includes(normalizedQuery)));
      }
      if(sort==="price_asc")x=[...x].sort((a,b)=>a.price-b.price);
      if(sort==="price_desc")x=[...x].sort((a,b)=>b.price-a.price);
      if(sort==="rating")x=[...x].sort((a,b)=>b.rating-a.rating);
      return x;
    },[products,cat,sort,normalizedQuery]);
    return <div className="gg-container gg-section" style={{display:"grid",gridTemplateColumns:"220px 1fr",gap:36,alignItems:"start"}}>
      <aside style={{position:"sticky",top:90}}>
        <div className="gg-filter-title">Category</div>
        <div className={`gg-filter-item ${cat==="All"?"active":""}`} onClick={()=>setCat("All")}>All Items</div>
        {clothingCategories.map(c=><div key={c} className={`gg-filter-item ${cat===c?"active":""}`} onClick={()=>setCat(c)}>{c}</div>)}
        <div className="gg-filter-title" style={{marginTop:22}}>Jewellery</div>
        {jewelryCategories.map(c=><div key={c} className={`gg-filter-item ${cat===c?"active":""}`} onClick={()=>setCat(c)}>{categoryEmoji[c]} {c}</div>)}
      </aside>
      <div>
        <div className="gg-section-head" style={{marginBottom:20}}>
          <div>
            <div className="gg-section-title" style={{fontSize:24}}>{cat==="All"?"Shop All":cat}</div>
            <div className="gg-section-sub">{list.length} {list.length===1?"item":"items"}{normalizedQuery?` matching “${query.trim()}”`:""}</div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:10,flex:"1 1 420px",justifyContent:"flex-end"}}>
            <label className="gg-search-shell" aria-label="Search products">
              <Search size={17} aria-hidden="true"/>
              <input className="gg-search-input" type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search products, categories, or colors" aria-label="Search products, categories, or colors"/>
              {query&&<button type="button" className="gg-search-clear" onClick={()=>setQuery("")} aria-label="Clear product search"><X size={16}/></button>}
            </label>
            <select className="gg-inp" style={{width:"auto",margin:0}} value={sort} onChange={e=>setSort(e.target.value)} aria-label="Sort products">
              <option value="featured">Sort: Featured</option>
              <option value="price_asc">Price: Low to High</option>
              <option value="price_desc">Price: High to Low</option>
              <option value="rating">Top Rated</option>
            </select>
          </div>
        </div>
        {list.length>0
          ? <div className="gg-grid">{list.map((p:Product)=><ProductCard key={p.id} product={p} wished={wished.has(p.id)} onOpen={()=>open(p)} onWish={()=>toggleWish(p)}/>)}</div>
          : <div className="gg-empty"><div>No products found{normalizedQuery?` for “${query.trim()}”`:""}.</div>{normalizedQuery&&<button type="button" className="gg-btn-outline" style={{marginTop:16}} onClick={()=>setQuery("")}>Clear search</button>}</div>}
      </div>
    </div>;
  }
 /*
 function ProductDetail({product,add,toggle,wished,back}:any){
   const [size,setSize]=useState("");
   const [showSizeGuide,setShowSizeGuide]=useState(false);
  const allOptions:ProductVariant[] = [{colorway:product.colorway,swatch:product.swatch,imageUrl:product.imageUrl}, ...(product.variants||[])];
  const [variantIdx,setVariantIdx]=useState(0);
  const active = allOptions[variantIdx] || allOptions[0];
  return <div className="gg-container gg-section"><span className="gg-nav-link" style={{cursor:"pointer",marginBottom:20,display:"inline-block"}} onClick={back}>← Back to shop</span><div className="gg-pd-grid"><ProductImage product={product} large imageUrl={active.imageUrl} swatch={active.swatch}/><div><div className="gg-card-cat">{product.category} · {active.colorway}</div><h1 style={{fontFamily:"Playfair Display, serif",fontSize:30,fontWeight:700,color:"var(--plum)",margin:"6px 0 10px"}}>{product.name}</h1><div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}><Star size={15} fill="#e8b04b" color="#e8b04b"/><span style={{fontWeight:600}}>{product.rating}</span><span style={{color:"var(--text2)",fontSize:13}}>({product.reviews} reviews)</span></div><div style={{display:"flex",gap:10,marginBottom:20}}><span style={{fontSize:24,fontWeight:700,color:"var(--pink-deep)"}}>{money(product.price)}</span>{product.compareAt&&<span className="gg-price-compare" style={{fontSize:16}}>{money(product.compareAt)}</span>}</div><p style={{fontSize:14.5,color:"var(--text2)",lineHeight:1.7,marginBottom:24}}>{product.description}</p>{allOptions.length>1&&<div style={{marginBottom:24}}><div className="gg-filter-title">Color: {active.colorway}</div><div style={{display:"flex",gap:10,flexWrap:"wrap"}}>{allOptions.map((v,i)=><button key={i} onClick={()=>setVariantIdx(i)} title={v.colorway} style={{width:34,height:34,borderRadius:"50%",background:v.swatch,border:variantIdx===i?"3px solid var(--pink-deep)":"1.5px solid var(--border)",cursor:"pointer",padding:0}}/>)}</div></div>}<div style={{marginBottom:24}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}><div className="gg-filter-title">Select Size</div><button className="gg-nav-link" type="button" onClick={()=>setShowSizeGuide(true)} style={{display:"flex",alignItems:"center",gap:5,fontSize:12}}><Ruler size={14}/> Size guide</button></div><div style={{display:"flex",gap:10,flexWrap:"wrap"}}>{product.sizes.map((s:string)=><button key={s} className={`gg-size-chip ${size===s?"selected":""}`} onClick={()=>setSize(s)}>{s}</button>)}</div></div><div style={{display:"flex",gap:12,marginBottom:24}}><button className="gg-btn" style={{flex:1}} onClick={()=>size?add({...product,colorway:active.colorway,imageUrl:active.imageUrl},size,active.colorway):alert("Please pick a size first")}>Add to Bag</button><button className="gg-icon-btn" style={{border:"1.5px solid var(--border)",width:48,height:48}} onClick={()=>toggle(product)}><Heart size={19} fill={wished?"currentColor":"none"} color="var(--pink-deep)"/></button></div><div style={{borderTop:"1px solid var(--border)",paddingTop:16,display:"flex",flexDirection:"column",gap:10,fontSize:13,color:"var(--text2)"}}><DeliveryPromise/><div style={{display:"flex",gap:10,alignItems:"center"}}><RotateCcw size={16}/> Returns are not accepted</div></div></div></div></div>{showSizeGuide&&<SizeGuide sizes={product.sizes} onClose={()=>setShowSizeGuide(false)}/>}</div>}
 */
 function ProductDetail({ product, add, toggle, wished, back }: any) {
   const [size, setSize] = useState("");
   const [showSizeGuide, setShowSizeGuide] = useState(false);
   const [variantIdx, setVariantIdx] = useState(0);
   const allOptions: ProductVariant[] = [{ colorway: product.colorway, swatch: product.swatch, imageUrl: product.imageUrl }, ...(product.variants || [])];
   const active = allOptions[variantIdx] || allOptions[0];
   return <div className="gg-container gg-section">
     <span className="gg-nav-link" style={{ cursor: "pointer", marginBottom: 20, display: "inline-block" }} onClick={back}>← Back to shop</span>
     <div className="gg-pd-grid">
       <ProductImage product={product} large imageUrl={active.imageUrl} swatch={active.swatch} />
       <div>
         <div className="gg-card-cat">{product.category} · {active.colorway}</div>
         <h1 style={{ fontFamily: "Playfair Display, serif", fontSize: 30, fontWeight: 700, color: "var(--plum)", margin: "6px 0 10px" }}>{product.name}</h1>
         <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}><Star size={15} fill="#e8b04b" color="#e8b04b" /><span style={{ fontWeight: 600 }}>{product.rating}</span><span style={{ color: "var(--text2)", fontSize: 13 }}>({product.reviews} reviews)</span></div>
         <div style={{ display: "flex", gap: 10, marginBottom: 20 }}><span style={{ fontSize: 24, fontWeight: 700, color: "var(--pink-deep)" }}>{money(product.price)}</span>{product.compareAt && <span className="gg-price-compare" style={{ fontSize: 16 }}>{money(product.compareAt)}</span>}</div>
         <p style={{ fontSize: 14.5, color: "var(--text2)", lineHeight: 1.7, marginBottom: 24 }}>{product.description}</p>
         {allOptions.length > 1 && <div style={{ marginBottom: 24 }}><div className="gg-filter-title">Color: {active.colorway}</div><div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>{allOptions.map((variant, index) => <button key={index} onClick={() => setVariantIdx(index)} title={variant.colorway} style={{ width: 34, height: 34, borderRadius: "50%", background: variant.swatch, border: variantIdx === index ? "3px solid var(--pink-deep)" : "1.5px solid var(--border)", cursor: "pointer", padding: 0 }} />)}</div></div>}
         <div style={{ marginBottom: 24 }}>
           <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}><div className="gg-filter-title">Select Size</div><button className="gg-nav-link" type="button" onClick={() => setShowSizeGuide(true)} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12 }}><Ruler size={14} /> Size guide</button></div>
           <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>{product.sizes.map((s: string) => <button key={s} className={`gg-size-chip ${size === s ? "selected" : ""}`} onClick={() => setSize(s)}>{s}</button>)}</div>
         </div>
         <div style={{ display: "flex", gap: 12, marginBottom: 24 }}><button className="gg-btn" style={{ flex: 1 }} onClick={() => size ? add({ ...product, colorway: active.colorway, imageUrl: active.imageUrl }, size, active.colorway) : alert("Please pick a size first")}>Add to Bag</button><button className="gg-icon-btn" style={{ border: "1.5px solid var(--border)", width: 48, height: 48 }} onClick={() => toggle(product)}><Heart size={19} fill={wished ? "currentColor" : "none"} color="var(--pink-deep)" /></button></div>
         <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16, display: "flex", flexDirection: "column", gap: 10, fontSize: 13, color: "var(--text2)" }}><DeliveryPromise /><div style={{ display: "flex", gap: 10, alignItems: "center" }}><RotateCcw size={16} /> Returns are not accepted</div></div>
       </div>
     </div>
     <ProductReviews productId={product.id} />
     {showSizeGuide && <SizeGuide sizes={product.sizes} onClose={() => setShowSizeGuide(false)} />}
   </div>;
 }
 function Cart({open,close,lines,products,update,remove,checkout}:any){if(!open)return null;const detail=lines.map((l:Line)=>({l,p:products.find((p:Product)=>p.id===l.productId)})).filter((x:any)=>x.p);const sub=detail.reduce((s:number,x:any)=>s+x.p.price*x.l.qty,0);return <><div className="gg-cart-overlay" onClick={close}/><div className="gg-cart-drawer"><div style={{padding:"20px 22px",borderBottom:"1px solid var(--border)",display:"flex",justifyContent:"space-between",alignItems:"center"}}><div style={{fontFamily:"Playfair Display, serif",fontWeight:700,fontSize:19,color:"var(--plum)"}}>Your Bag ({detail.length})</div><button className="gg-icon-btn" onClick={close}><X size={20}/></button></div><div style={{flex:1,overflowY:"auto",padding:"0 22px"}}>{!detail.length&&<div className="gg-empty"><ShoppingBag size={30} color="var(--pink)" style={{marginBottom:10}}/>Your bag is feeling light. Go find something sparkly!</div>}{detail.map(({l,p}:any)=><div className="gg-cart-line" key={p.id+l.size+l.colorway}><ProductImage product={p}/><div style={{flex:1}}><div style={{fontWeight:600,fontSize:13.5,color:"var(--plum)"}}>{p.name}</div><div style={{fontSize:12,color:"var(--text2)",marginTop:2}}>Color {l.colorway||p.colorway} · Size {l.size}</div><div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginTop:8}}><div style={{display:"flex",alignItems:"center",gap:10,border:"1px solid var(--border)",borderRadius:8,padding:"3px 8px"}}><button onClick={()=>update(p.id,l.size,Math.max(1,l.qty-1),l.colorway)}><Minus size={12}/></button><span style={{fontSize:13,fontWeight:600}}>{l.qty}</span><button onClick={()=>update(p.id,l.size,l.qty+1,l.colorway)}><Plus size={12}/></button></div><span style={{fontWeight:700,color:"var(--pink-deep)",fontSize:13.5}}>{money(p.price*l.qty)}</span></div></div><button onClick={()=>remove(p.id,l.size,l.colorway)} style={{color:"var(--text3)",alignSelf:"flex-start"}}><Trash2 size={15}/></button></div>)}</div>{detail.length>0&&<div style={{padding:"18px 22px",borderTop:"1px solid var(--border)"}}><div style={{display:"flex",justifyContent:"space-between",fontSize:14,marginBottom:6,color:"var(--text2)"}}><span>Subtotal</span><span>{money(sub)}</span></div><div style={{fontSize:12,color:"var(--text3)",marginBottom:14}}>Shipping & taxes calculated at checkout</div><button className="gg-btn" style={{width:"100%"}} onClick={checkout}>Checkout</button></div>}</div></>}
 export function OrderReceipt({order,onBack,showSuccess,initialLanguage}:any){
   const {language:preferenceLanguage}=usePreferences();
   const [language,setLanguage]=useState<CheckoutLanguage>(initialLanguage ?? order.language ?? preferenceLanguage);
   const t=checkoutCopy[language];
   const isArabic=language==="ar";
   return <div className="gg-container gg-section" style={{maxWidth:560}}>
     <LanguageSwitch language={language} onChange={setLanguage}/>
     {showSuccess?<div className="gg-print-hide" dir={isArabic?"rtl":"ltr"} style={{textAlign:"center",marginBottom:28}}><CheckCircle2 size={54} color="var(--pink)" style={{marginBottom:16}}/><h1 style={{fontFamily:"Playfair Display, serif",fontSize:28,color:"var(--plum)",marginBottom:10}}>{t.received}</h1><p style={{color:"var(--text2)"}}>{t.followUp}</p></div>
     :<span className="gg-nav-link gg-print-hide" dir={isArabic?"rtl":"ltr"} style={{cursor:"pointer",marginBottom:16,display:"inline-block"}} onClick={onBack}>{t.backOrders}</span>}
     <div className={isArabic?"gg-print-area gg-receipt-ar":"gg-print-area"} dir={isArabic?"rtl":"ltr"} lang={language} style={{background:"#fff",border:"1px solid var(--border)",borderRadius:18,padding:24,marginBottom:24}}>
      <div className="gg-receipt-header" style={{display:"flex",justifyContent:"space-between",marginBottom:16,paddingBottom:16,borderBottom:"1px solid var(--border)"}}>
         <div><div style={{fontSize:11,color:"var(--text3)",textTransform:isArabic?"none":"uppercase",letterSpacing:isArabic?0:0.5}}>{t.orderNumber}</div><div dir="ltr" style={{fontWeight:700,color:"var(--plum)",fontSize:16}}><OrderReference value={order.id}/></div></div>
         <div style={{textAlign:isArabic?"left":"right"}}><div style={{fontSize:11,color:"var(--text3)",textTransform:isArabic?"none":"uppercase",letterSpacing:isArabic?0:0.5}}>{t.date}</div><div dir="ltr" style={{fontWeight:600,color:"var(--plum)",fontSize:14}}>{order.date}</div></div>
      </div>
      <div className="gg-print-hide"><OrderTracker status={order.status}/></div>
       <div className="gg-receipt-shipping">
          <div className="gg-filter-title">{t.shippingTo}</div>
         <div className="gg-receipt-address" style={{fontSize:13.5,color:"var(--text2)",lineHeight:1.6,marginBottom:18}}>
           <span className="gg-receipt-bidi" dir="auto">{order.shippingName}</span>
            <span className="gg-receipt-bidi" dir="auto">{order.wilayat || order.shippingAddress}</span>
           {order.governorate&&<span className="gg-receipt-bidi" dir="auto">{order.governorate}</span>}
            {order.postalCode&&<span className="gg-receipt-bidi" dir="ltr">{order.postalCode}</span>}
           {order.phone&&<span className="gg-receipt-phone" dir="ltr">{order.phone}</span>}
         </div>
       </div>
       <div className="gg-receipt-items-title gg-filter-title">{t.items}</div>
      <div className="gg-receipt-items">
         {order.items.map((it:any,i:number)=><div className="gg-receipt-item" key={i} style={{display:"flex",justifyContent:"space-between",fontSize:13.5,padding:"8px 0",borderBottom:"1px solid var(--border)"}}><span dir="auto" style={{color:"var(--plum)"}}>{it.name} × {it.qty} <span style={{color:"var(--text3)"}}>({it.size})</span></span><span dir="ltr" style={{fontWeight:600}}>{money(it.price*it.qty)}</span></div>)}
      </div>
       {(order.promoCode || Number(order.discountAmount||0)>0) && <div style={{borderTop:"1px solid var(--border)",marginTop:8,paddingTop:10,fontSize:13}}>
         {order.promoCode && <div style={{display:"flex",justifyContent:"space-between",gap:12,color:"var(--text2)"}}><span>{t.promoCode}</span><strong dir="ltr" style={{color:"var(--plum)",letterSpacing:".04em"}}>{order.promoCode}</strong></div>}
         {Number(order.discountAmount||0)>0 && <div style={{display:"flex",justifyContent:"space-between",gap:12,color:"#3f8a61",marginTop:6}}><span>{t.discount}</span><span dir="ltr">−{money(Number(order.discountAmount||0))}</span></div>}
       </div>}
       <div className="gg-receipt-total" style={{display:"flex",justifyContent:"space-between",fontSize:16,fontWeight:700,color:"var(--pink-deep)",paddingTop:14,marginTop:6}}><span>{t.total}</span><span dir="ltr">{money(order.total)}</span></div>
    </div>
    <div className="gg-print-hide" style={{display:"flex",gap:12}}>
       <button className="gg-btn-outline" style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:8}} onClick={()=>window.print()}><Printer size={16}/> {t.print}</button>
       <button className="gg-btn" style={{flex:1}} onClick={onBack}>{showSuccess?t.continueShopping:t.backToOrders}</button>
    </div>
  </div>;
 }
 function Checkout({lines,products,onDone}:any){
   const [language,setLanguage]=useState<CheckoutLanguage>("en");
   const t=checkoutCopy[language];
   const isArabic=language==="ar";
   const [busy,setBusy]=useState(false);
   const [placedOrder,setPlacedOrder]=useState<any>(null);
    const [orderError,setOrderError]=useState("");
   const [transferDetails,setTransferDetails]=useState("");
   const [transferReceipt,setTransferReceipt]=useState("");
   const [receiptName,setReceiptName]=useState("");
   const [paymentIntentId]=useState(()=>`pending-oman-${crypto.randomUUID()}`);
    const [form,setForm]=useState({shippingName:"",phone:"",governorate:"",wilayat:"",postalCode:""});
    const [shippingQuote,setShippingQuote]=useState({fee:SHIPPING_FEE,etaMinDays:1,etaMaxDays:5});
     const [promoCode,setPromoCode]=useState("");
     const [promoPreview,setPromoPreview]=useState<{valid:boolean;message:string;code?:string;percentage?:number;eligibleSubtotal?:number;discountAmount?:number;cartKey?:string}|null>(null);
     const [promoBusy,setPromoBusy]=useState(false);
     const [promoError,setPromoError]=useState("");
   const detail=lines.map((l:Line)=>({l,p:products.find((p:Product)=>p.id===l.productId)})).filter((x:any)=>x.p);
   const sub=detail.reduce((s:number,x:any)=>s+x.p.price*x.l.qty,0);
      const cartKey=JSON.stringify(lines.map((line:Line)=>({productId:line.productId,qty:line.qty})));
      const promoApplied=Boolean(promoPreview?.valid&&promoPreview.code===promoCode.trim().toUpperCase()&&promoPreview.cartKey===cartKey);
      const promoDiscount=promoApplied?Math.min(sub,Math.max(0,Number(promoPreview?.discountAmount||0))):0;
     const total=Math.max(0,sub-promoDiscount+shippingQuote.fee);
     useEffect(()=>{
       setPromoPreview(null);
       setPromoError("");
     },[promoCode,lines]);
    useEffect(()=>{api<any>("/settings/payment").then(data=>setTransferDetails(data.transferDetails||"")).catch(()=>{})},[]);
    useEffect(()=>{
      if(!form.governorate||!form.wilayat){setShippingQuote({fee:SHIPPING_FEE,etaMinDays:1,etaMaxDays:5});return}
      api<any>("/settings/shipping/quote",{method:"POST",body:JSON.stringify({governorate:form.governorate,wilayat:form.wilayat,subtotal:sub})})
        .then(data=>setShippingQuote({fee:Number(data.fee),etaMinDays:Number(data.etaMinDays),etaMaxDays:Number(data.etaMaxDays)}))
        .catch(()=>setShippingQuote({fee:SHIPPING_FEE,etaMinDays:1,etaMaxDays:5}));
    },[form.governorate,form.wilayat,sub]);
    const readReceipt=async(file:File|null)=>{
     if(!file)return;
      const detectedMime=detectReceiptMime(new Uint8Array(await file.arrayBuffer()));
      if(!detectedMime||detectedMime!==file.type||file.size>5*1024*1024){setTransferReceipt("");setReceiptName("");alert(t.invalidReceipt);return}
     const reader=new FileReader();
     reader.onload=()=>{setTransferReceipt(String(reader.result||""));setReceiptName(file.name)};
     reader.readAsDataURL(file);
   };
    const validatePromo=async()=>{
      const code=promoCode.trim().toUpperCase();
      if(!code){setPromoPreview(null);setPromoError("Enter a promo code first.");return}
      if(!detail.length){setPromoPreview(null);setPromoError("Add an item to your bag before applying a code.");return}
      setPromoBusy(true);
      setPromoError("");
      setPromoPreview(null);
      try{
        const result=await api<{valid:boolean;message:string;code?:string;percentage?:number;eligibleSubtotal?:number;discountAmount?:number}>("/discounts/validate",{
          method:"POST",
          body:JSON.stringify({code,lines:lines.map((line:Line)=>({productId:line.productId,qty:line.qty}))}),
        });
        if(!result.valid){
          setPromoError(result.message || "This promo code cannot be applied.");
          return;
        }
         setPromoPreview({...result,cartKey});
      }catch(err){
        setPromoError(err instanceof Error ? err.message : "Unable to validate this promo code.");
      }finally{setPromoBusy(false)}
    };
   const submit=async(e:React.FormEvent)=>{
     e.preventDefault();
     if(busy)return;
     if(!/^\d{8}$/.test(form.phone)){alert(t.invalidPhone);return}
     if(!transferReceipt){alert(t.transferReceiptRequired);return}
       if(promoCode.trim() && !promoApplied){
        setPromoError("Apply a valid promo code before placing your order.");
        return;
      }
     setBusy(true);
      setOrderError("");
     try{
         const order=await api<any>("/orders",{method:"POST",body:JSON.stringify({lines,shippingName:form.shippingName,phone:`+968 ${form.phone}`,governorate:form.governorate,wilayat:form.wilayat,postalCode:form.postalCode,language,paymentIntentId,transferReceipt,promoCode:promoApplied?promoPreview?.code:undefined})});
       setPlacedOrder(order);
      }catch(err){
        const message=err instanceof Error?err.message:t.failedOrder;
        setOrderError(message);
        if(promoCode.trim()) {
          setPromoPreview(null);
          setPromoError(message);
        }
      }finally{setBusy(false)}
   };
   if(placedOrder)return <OrderReceipt order={placedOrder} onBack={onDone} showSuccess initialLanguage={language}/>;
   const wilayats=OMAN_WILAYATS[form.governorate]||[];
   return <div className={`gg-container gg-section gg-checkout ${isArabic?"gg-checkout-ar":""}`} dir={isArabic?"rtl":"ltr"} lang={language} style={{display:"grid",gridTemplateColumns:"1.3fr 1fr",gap:40,alignItems:"start"}}>
     <div>
       <LanguageSwitch language={language} onChange={setLanguage}/>
       <span className="gg-nav-link" style={{cursor:"pointer",marginBottom:16,display:"inline-block"}} onClick={onDone}>{t.backShop}</span>
       <h1 style={{fontFamily:"Playfair Display, serif",fontSize:26,color:"var(--plum)",marginBottom:20}}>{t.checkout}</h1>
       <div className="gg-error-msg" style={{background:"var(--lavender-light)",color:"var(--plum)"}}>{t.paymentNotice}</div>
       <form onSubmit={submit}>
          {orderError&&<div className="gg-error-msg" role="alert" style={{marginBottom:16}}>{orderError}</div>}
         <div className="gg-filter-title">{t.shippingAddress}</div>
         <label className="gg-field-label" htmlFor="gg-name">{t.fullName}</label>
         <input id="gg-name" className="gg-inp" dir="auto" placeholder={t.fullName} required value={form.shippingName} onChange={e=>setForm({...form,shippingName:e.target.value})}/>
         <label className="gg-field-label" htmlFor="gg-phone">{t.phone}</label>
         <div className="gg-phone-field"><span dir="ltr">+968</span><input id="gg-phone" className="gg-inp" dir="ltr" type="tel" inputMode="numeric" autoComplete="tel-national" placeholder={t.phonePlaceholder} required minLength={8} maxLength={8} pattern="[0-9]{8}" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value.replace(/\D/g,"").slice(0,8)})}/></div>
         <label className="gg-field-label" htmlFor="gg-governorate">{t.governorate}</label>
         <select id="gg-governorate" className="gg-inp" required value={form.governorate} onChange={e=>setForm({...form,governorate:e.target.value,wilayat:""})}><option value="" disabled>{t.selectGovernorate}</option>{OMAN_GOVERNORATES.map(g=><option key={g} value={g}>{g}</option>)}</select>
         <label className="gg-field-label" htmlFor="gg-wilayat">{t.wilayat}</label>
         <select id="gg-wilayat" className="gg-inp" required disabled={!form.governorate} value={form.wilayat} onChange={e=>setForm({...form,wilayat:e.target.value})}><option value="" disabled>{t.selectWilayat}</option>{wilayats.map(w=><option key={w} value={w}>{w}</option>)}</select>
         <label className="gg-field-label" htmlFor="gg-postal">{t.postalCode}</label>
         <input id="gg-postal" className="gg-inp" dir="ltr" inputMode="numeric" placeholder={t.postalCode} required value={form.postalCode} onChange={e=>setForm({...form,postalCode:e.target.value})}/>
          <div style={{marginTop:22,background:"#fff5aa",border:"2px solid #e7c94b",borderRadius:14,padding:"16px 18px",color:"#5d4810"}}>
           <div style={{fontWeight:800,marginBottom:8}}>{t.transferPayment}</div>
           <div style={{whiteSpace:"pre-wrap",lineHeight:1.7,fontSize:13}}>{transferDetails||t.transferNotConfigured}</div>
         </div>
         <label className="gg-field-label" htmlFor="gg-transfer-receipt" style={{marginTop:18}}>{t.paymentReceipt} <span style={{color:"var(--pink-deep)"}}>*</span></label>
         <div style={{background:"#fff",border:"1px dashed var(--pink)",borderRadius:12,padding:14}}>
           <input id="gg-transfer-receipt" type="file" required accept="image/jpeg,image/png,image/webp,application/pdf" onChange={e=>readReceipt(e.target.files?.[0]||null)}/>
           {receiptName&&<div style={{fontSize:12,color:"var(--text2)",marginTop:8}}>{receiptName}</div>}
            <div style={{fontSize:11.5,color:"var(--text3)",marginTop:6}}>{t.paymentReceiptRequired}</div>
         </div>
          <div style={{marginTop:14,padding:"12px 14px",background:"var(--lavender-light)",borderRadius:12,color:"var(--plum)",fontSize:12.5}}><DeliveryPromise governorate={form.governorate}/><div style={{marginTop:4}}>Shipping for this address: <bdi dir="ltr">{money(shippingQuote.fee)}</bdi></div></div>
            <button type="submit" className="gg-btn" style={{width:"100%",marginTop:16}} disabled={busy||!detail.length||!transferReceipt||(Boolean(promoCode.trim())&&!promoApplied)}><Lock size={14}/> {busy?t.saving:<>{t.submit} · <bdi dir="ltr">{money(total)}</bdi></>}</button>
         <div style={{fontSize:11.5,color:"var(--text3)",textAlign:"center",marginTop:10}}>{t.noCharge}</div>
       </form>
     </div>
     <div style={{background:"#fff",border:"1px solid var(--border)",borderRadius:18,padding:22}}>
       <div className="gg-filter-title">{t.summary}</div>
       {detail.map(({l,p}:any)=><div key={p.id+l.size} style={{display:"flex",justifyContent:"space-between",fontSize:13.5,padding:"8px 0",borderBottom:"1px solid var(--border)",gap:12}}><span dir="auto" style={{color:"var(--plum)"}}>{p.name} × {l.qty} <span style={{color:"var(--text3)"}}>({l.size})</span></span><span dir="ltr" style={{fontWeight:600,whiteSpace:"nowrap"}}>{money(p.price*l.qty)}</span></div>)}
        <div style={{marginTop:16,paddingTop:14,borderTop:"1px solid var(--border)"}}>
          <label className="gg-field-label" htmlFor="gg-promo-code" style={{display:"flex",alignItems:"center",gap:6}}><Tag size={14}/>{t.promoCode}</label>
          <div style={{display:"flex",gap:8}}>
            <input id="gg-promo-code" className="gg-inp" style={{margin:0,minWidth:0}} value={promoCode} onChange={e=>{setPromoCode(e.target.value.toUpperCase());setOrderError("")}} placeholder={t.promoPlaceholder} autoCapitalize="characters" aria-describedby="gg-promo-hint"/>
            <button type="button" className="gg-btn-outline" style={{whiteSpace:"nowrap",padding:"8px 12px"}} onClick={validatePromo} disabled={promoBusy}>{promoBusy?t.applyingPromo:t.applyPromo}</button>
          </div>
          <div id="gg-promo-hint" style={{fontSize:11.5,color:"var(--text3)",marginTop:6}}>{t.promoHint}</div>
          {promoError&&<div role="alert" style={{fontSize:12.5,color:"#b04b6b",marginTop:8}}>{promoError}</div>}
          {promoApplied&&<div role="status" style={{background:"#eef8f1",color:"#31754b",borderRadius:10,padding:"9px 10px",fontSize:12.5,marginTop:8}}>{t.promoApplied}{promoPreview?.percentage ? ` · ${promoPreview.percentage}%` : ""}{promoPreview?.eligibleSubtotal !== undefined ? ` · Eligible items ${money(Number(promoPreview.eligibleSubtotal))}` : ""}</div>}
        </div>
       <div style={{display:"flex",justifyContent:"space-between",fontSize:13.5,padding:"12px 0 6px",color:"var(--text2)"}}><span>{t.subtotal}</span><span dir="ltr">{money(sub)}</span></div>
        {promoDiscount>0&&<div style={{display:"flex",justifyContent:"space-between",fontSize:13.5,paddingBottom:6,color:"#3f8a61"}}><span>{t.discount}{promoPreview?.code ? ` (${promoPreview.code})` : ""}</span><span dir="ltr">−{money(promoDiscount)}</span></div>}
        <div style={{display:"flex",justifyContent:"space-between",fontSize:13.5,paddingBottom:12,color:"var(--text2)"}}><span>{t.shipping}</span><span dir="ltr">{money(shippingQuote.fee)}</span></div>
       <div style={{display:"flex",justifyContent:"space-between",fontSize:16,fontWeight:700,color:"var(--plum)",borderTop:"1px solid var(--border)",paddingTop:12}}><span>{t.total}</span><span dir="ltr">{money(total)}</span></div>
     </div>
   </div>;
 }
function OrderTracker({status}:{status:string}){
   const { t } = usePreferences();
  const idx = Math.max(0, ORDER_STATUSES.indexOf(status));
  return <div style={{display:"flex",alignItems:"flex-start",margin:"14px 0 18px"}}>
    {ORDER_STATUSES.map((s,i)=>(
      <div key={s} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",position:"relative"}}>
        {i>0&&<div style={{position:"absolute",top:11,right:"50%",width:"100%",height:2,background:i<=idx?"var(--pink-deep)":"var(--border)",zIndex:0}}/>}
        <div style={{width:24,height:24,borderRadius:"50%",background:i<=idx?"var(--pink-deep)":"#fff",border:i<=idx?"none":"2px solid var(--border)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1,color:"#fff"}}>{i<idx?<CheckCircle2 size={15}/>:i===idx?<div style={{width:8,height:8,borderRadius:"50%",background:"#fff"}}/>:null}</div>
         <div style={{fontSize:10.5,marginTop:6,textAlign:"center",color:i<=idx?"var(--plum)":"var(--text2)",fontWeight:i===idx?700:500,maxWidth:70}}>{t(`status.${s==="In Process"?"inProcess":s==="In Delivery"?"inDelivery":s.toLowerCase()}`)}</div>
      </div>
    ))}
  </div>;
}
type ProductEditorValues = {
  name:string;
  category:string;
  price:string;
  colors:string;
  sizes:string[];
  description:string;
  imageUrl:string;
  isNew:boolean;
  isBestseller:boolean;
};
function editorValues(product?:Product):ProductEditorValues {
  const colors = product ? [product.colorway, ...(product.variants||[]).map(v=>v.colorway)] : [];
  return {
    name:product?.name||"",
    category:product?.category||"Makhwar Scarfs",
    price:product ? String(product.price) : "5.000",
    colors:colors.join(", "),
    sizes:product?.sizes||["One Size"],
    description:product?.description||"",
    imageUrl:product?.imageUrl||"",
    isNew:product?.isNew||false,
    isBestseller:product?.isBestseller||false,
  };
}
function AdminProductEditor({products,onSaved}:{products:Product[];onSaved:(product:Product)=>void}){
  const [editingId,setEditingId]=useState("");
  const [form,setForm]=useState<ProductEditorValues>(()=>editorValues());
  const [saving,setSaving]=useState(false);
  const [message,setMessage]=useState("");
  const isRing=form.category==="Rings";
  const isJewellery=jewelryCategories.includes(form.category);
  const sizeOptions=isRing?["6","7","8","9"]:PRODUCT_SIZE_OPTIONS;
  const colors=form.colors.split(",").map(color=>color.trim()).filter(Boolean);
  const reset=()=>{setEditingId("");setForm(editorValues());setMessage("")};
  const chooseProduct=(product:Product)=>{setEditingId(product.id);setForm(editorValues(product));setMessage("")};
  const updateCategory=(category:string)=>{
    setForm(current=>({...current,category,sizes:category==="Rings"?["6"]:["One Size"],colors:jewelryCategories.includes(category)?"Silver, Gold, Golden Rose":current.colors}));
  };
  const toggleSize=(size:string)=>setForm(current=>({...current,sizes:current.sizes.includes(size)?current.sizes.filter(item=>item!==size):[...current.sizes,size]}));
  const toggleJewelleryColor=(color:string)=>setForm(current=>{
    const selected=current.colors.split(",").map(item=>item.trim()).filter(Boolean);
    const next=selected.includes(color)?selected.filter(item=>item!==color):[...selected,color];
    return {...current,colors:next.join(", ")};
  });
  const readImage=(file:File|null)=>{
    if(!file)return;
    if(!["image/jpeg","image/png","image/webp"].includes(file.type)||file.size>4*1024*1024){setMessage("Upload a JPG, PNG, or WEBP image smaller than 4 MB.");return}
    const reader=new FileReader();
    reader.onload=()=>setForm(current=>({...current,imageUrl:String(reader.result||"")}));
    reader.readAsDataURL(file);
  };
  const save=async(e:React.FormEvent)=>{
    e.preventDefault();setMessage("");
    if(!form.name.trim()||!form.description.trim()){setMessage("Add a product name and description.");return}
    if(!Number.isFinite(Number(form.price))||Number(form.price)<0){setMessage("Enter a valid price.");return}
    if(!colors.length){setMessage("Choose at least one color.");return}
    if(!form.sizes.length){setMessage("Choose at least one size.");return}
    if(isJewellery&&colors.some(color=>!JEWELLERY_COLORS.includes(color))){setMessage("Jewellery colors must be Silver, Gold, or Golden Rose.");return}
    setSaving(true);
    try{
      const payload={name:form.name.trim(),category:form.category,price:Number(form.price),colors,sizes:form.sizes,description:form.description.trim(),imageUrl:form.imageUrl||null,isNew:form.isNew,isBestseller:form.isBestseller};
      const saved=await api<Product>(editingId?`/admin/products/${editingId}`:"/admin/products",{method:editingId?"PATCH":"POST",body:JSON.stringify(payload)});
      onSaved(saved);setMessage(editingId?"Product updated.":"Product added.");if(!editingId)setForm(editorValues());
    }catch(err){
      if(isBackendUnavailable(err)){
        const local:Product={
          id:editingId||`PRD-LOCAL-${Date.now()}`,
          name:form.name.trim(),
          category:form.category,
          price:Number(form.price),
          colorway:colors[0]||"Blush",
          swatch:"#F6A6C8",
          sizes:form.sizes,
          isNew:form.isNew,
          isBestseller:form.isBestseller,
          isVisible:true,
          rating:5,
          reviews:0,
          description:form.description.trim(),
          imageUrl:form.imageUrl||null,
          variants:colors.map(color=>({colorway:color,swatch:"#F6A6C8",imageUrl:form.imageUrl||null})),
        };
        onSaved(local);setMessage(editingId?"Product updated.":"Product added.");if(!editingId)setForm(editorValues());
      } else setMessage(err instanceof Error?err.message:"Unable to save product");
    }finally{setSaving(false)}
  };
  return <div style={{background:"#fff",border:"1px solid var(--border)",borderRadius:16,padding:24,marginBottom:18}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap",marginBottom:8}}>
      <div><h2 style={{fontFamily:"Playfair Display, serif",color:"var(--plum)",margin:0}}>{editingId?"Edit Product":"Add Product"}</h2><p style={{fontSize:12.5,color:"var(--text2)",margin:"6px 0 0"}}>Upload a product photo, choose its category, price, colors, and sizes.</p></div>
      {editingId&&<button type="button" className="gg-btn-outline" onClick={reset}>Add New Instead</button>}
    </div>
    {message&&<div style={{fontSize:13,margin:"10px 0",color:message.includes("updated")||message.includes("added")?"#3a8a5c":"#c0392b"}}>{message}</div>}
    <form onSubmit={save}>
      <label className="gg-field-label">Product to edit</label>
      <select className="gg-inp" value={editingId} onChange={e=>e.target.value?chooseProduct(products.find(product=>product.id===e.target.value)!):reset()}>
        <option value="">Create a new product</option>
        {products.map(product=><option key={product.id} value={product.id}>{product.name}</option>)}
      </select>
      <label className="gg-field-label">Product name</label><input className="gg-inp" required value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Makhwar Scarf — Jewel Tones"/>
      <label className="gg-field-label">Category</label><select className="gg-inp" value={form.category} onChange={e=>updateCategory(e.target.value)}>{categories.map(category=><option key={category} value={category}>{category}</option>)}</select>
      <label className="gg-field-label">Price (OMR)</label><input className="gg-inp" required type="number" min="0" step="0.001" value={form.price} onChange={e=>setForm({...form,price:e.target.value})}/>
      <label className="gg-field-label">Colors</label>
      {isJewellery?<div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:12}}>{JEWELLERY_COLORS.map(color=><button type="button" key={color} className={colors.includes(color)?"gg-btn":"gg-btn-outline"} style={{padding:"8px 12px"}} onClick={()=>toggleJewelleryColor(color)}>{color}</button>)}</div>:<input className="gg-inp" value={form.colors} onChange={e=>setForm({...form,colors:e.target.value})} placeholder="Orange, Green, Lilac"/>}
      <div style={{fontSize:11.5,color:"var(--text3)",marginTop:-4,marginBottom:12}}>{isJewellery?"Jewellery colors are limited to Silver, Gold, and Golden Rose.":"Separate multiple colors with commas. Customers can choose from these on the product page."}</div>
      <label className="gg-field-label">Sizes</label><div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:14}}>{sizeOptions.map(size=><button type="button" key={size} className={form.sizes.includes(size)?"gg-btn":"gg-btn-outline"} style={{padding:"8px 12px"}} onClick={()=>toggleSize(size)}>{size}</button>)}</div>
      <label className="gg-field-label">Product photo</label><input className="gg-inp" type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>readImage(e.target.files?.[0]||null)}/>
      {form.imageUrl&&<img src={form.imageUrl} alt="Product preview" style={{width:120,height:120,objectFit:"cover",borderRadius:12,border:"1px solid var(--border)",marginBottom:12}}/>}
      <label className="gg-field-label">Description</label><textarea className="gg-inp" required rows={4} value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder="Describe the fabric, finish, and fit."/>
      <div style={{display:"flex",gap:16,flexWrap:"wrap",margin:"8px 0 14px"}}><label style={{fontSize:13,color:"var(--text2)"}}><input type="checkbox" checked={form.isNew} onChange={e=>setForm({...form,isNew:e.target.checked})}/> New arrival</label><label style={{fontSize:13,color:"var(--text2)"}}><input type="checkbox" checked={form.isBestseller} onChange={e=>setForm({...form,isBestseller:e.target.checked})}/> Bestseller</label></div>
      <button type="submit" className="gg-btn" style={{width:"100%"}} disabled={saving}>{saving?"Saving...":editingId?"Save Product Changes":"Add Product"}</button>
    </form>
  </div>;
}
 type AdminSettingsData = {
   notifyEmail:string;
   notifyPhone:string;
    transferDetails:string;
   deliveryHealth:{emailFailedAt:string|null;whatsappFailedAt:string|null};
 };
  function AdminSettings({products,onProductSaved}:{products:Product[];onProductSaved:(product:Product)=>void}){
    const [form,setForm]=useState<AdminSettingsData>({notifyEmail:"",notifyPhone:"",transferDetails:"",deliveryHealth:{emailFailedAt:null,whatsappFailedAt:null}});
   const [loading,setLoading]=useState(true);
   const [saving,setSaving]=useState(false);
   const [msg,setMsg]=useState("");
   const [testingChannel,setTestingChannel]=useState<"email"|"whatsapp"|null>(null);
   const [testMsg,setTestMsg]=useState("");
   useEffect(()=>{api<any>("/admin/settings").then(setForm).catch(e=>{if(!isBackendUnavailable(e))setMsg(e.message)}).finally(()=>setLoading(false))},[]);
   const save=async(e:React.FormEvent)=>{
     e.preventDefault();setSaving(true);setMsg("");
     try{const updated=await api<any>("/admin/settings",{method:"PATCH",body:JSON.stringify(form)});setForm(updated);setMsg("Saved!");}
     catch(err){setMsg(err instanceof Error?err.message:"Failed to save");}
     finally{setSaving(false);}
   };
    const testChannel=async(channel:"email"|"whatsapp")=>{
      setTestingChannel(channel);setTestMsg("");
      try{
        await api<any>("/admin/settings/notifications/test",{method:"POST",body:JSON.stringify({channel,recipient:channel==="email"?form.notifyEmail:form.notifyPhone})});
        setTestMsg(`${channel==="email"?"Email":"WhatsApp"} test sent successfully.`);
      }catch(err){setTestMsg(err instanceof Error?err.message:`${channel} test failed`)}
      finally{setTestingChannel(null);}
    };
   if(loading)return <div className="gg-empty">Loading settings...</div>;
   const failures = [
     {label:"Email",at:form.deliveryHealth.emailFailedAt},
     {label:"WhatsApp",at:form.deliveryHealth.whatsappFailedAt},
   ].filter((failure):failure is {label:string;at:string}=>Boolean(failure.at));
   return <div style={{maxWidth:520}}>
    {failures.length>0&&<div role="alert" style={{background:"#fff4f1",border:"1px solid #efb4a8",borderRadius:16,padding:"16px 18px",marginBottom:16,color:"#8d2f23"}}>
      <div style={{fontWeight:700,marginBottom:6}}>Order alert delivery needs attention</div>
      {failures.map(failure=><div key={failure.label} style={{fontSize:13,lineHeight:1.6}}>
        {failure.label} failed on {new Date(failure.at).toLocaleString()}.
      </div>)}
      <div style={{fontSize:12,color:"#76514a",marginTop:6}}>The warning clears after that channel successfully sends a new order alert.</div>
    </div>}
    <div style={{background:"#fff",border:"1px solid var(--border)",borderRadius:16,padding:24}}>
     <p style={{fontSize:13,color:"var(--text2)",marginBottom:16}}>New orders will send an email and WhatsApp alert to these contacts.</p>
     {msg&&<div style={{fontSize:13,marginBottom:10,color:msg==="Saved!"?"#3a8a5c":"#c0392b"}}>{msg}</div>}
     <form onSubmit={save}>
       <label className="gg-field-label">Notification Email</label>
       <input className="gg-inp" type="email" required value={form.notifyEmail} onChange={e=>setForm({...form,notifyEmail:e.target.value})}/>
       <label className="gg-field-label">WhatsApp Number (with country code)</label>
       <input className="gg-inp" type="tel" required placeholder="+96879162199" value={form.notifyPhone} onChange={e=>setForm({...form,notifyPhone:e.target.value})}/>
        <label className="gg-field-label">Bank / Phone Transfer Details</label>
        <textarea className="gg-inp" rows={5} value={form.transferDetails} onChange={e=>setForm({...form,transferDetails:e.target.value})} placeholder={"Example:\nBank: ...\nAccount name: ...\nAccount number: ...\nOr phone transfer number: +968 ..."} />
        <div style={{fontSize:12,color:"var(--text3)",marginTop:-4,marginBottom:8}}>These details appear highlighted at checkout. Clear this field and save to remove them.</div>
       <button type="submit" className="gg-btn" style={{width:"100%",marginTop:8}} disabled={saving}>{saving?"Saving...":"Save Changes"}</button>
     </form>
      <div style={{borderTop:"1px solid var(--border)",marginTop:18,paddingTop:18}}>
        <div className="gg-filter-title" style={{marginBottom:6}}>Test order alerts</div>
        <div style={{fontSize:12,color:"var(--text2)",lineHeight:1.5,marginBottom:10}}>Send a controlled test to the current contacts without creating an order.</div>
        <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
          <button type="button" className="gg-btn-outline" onClick={()=>testChannel("email")} disabled={testingChannel!==null}>{testingChannel==="email"?"Sending...":"Test Email"}</button>
          <button type="button" className="gg-btn-outline" onClick={()=>testChannel("whatsapp")} disabled={testingChannel!==null}>{testingChannel==="whatsapp"?"Sending...":"Test WhatsApp"}</button>
        </div>
        {testMsg&&<div role="status" style={{fontSize:12.5,marginTop:10,color:testMsg.includes("successfully")?"#3a8a5c":"#c0392b"}}>{testMsg}</div>}
      </div>
    </div>
     <div style={{marginTop:24}}>
       <AdminProductEditor products={products} onSaved={onProductSaved}/>
     </div>
    </div>;
 }
export function AdminOrderCard({o,changeStatus,setViewingOrder}:{o:Order;changeStatus:(id:string,status:string)=>void;setViewingOrder:(order:Order)=>void}){
  return <div style={{
    background:"#fff",
    border:"1px solid var(--border)",
    borderRadius:16,
    padding:"18px 22px"
  }}>
    <div style={{
      display:"flex",
      justifyContent:"space-between",
      flexWrap:"wrap",
      gap:10,
      marginBottom:12
    }}>
      <div className="gg-admin-summary">
        <div style={{
          fontWeight:700,
          color:"var(--plum)",
          fontSize:14.5
        }}>
          <OrderReference value={o.id}/>
        </div>
        <div className="gg-admin-customer-meta" style={{fontSize:12,color:"var(--text2)"}}>
          <span>Placed {o.date}</span>
          {o.customerName&&<span className="gg-admin-bidi" dir="auto">{o.customerName}</span>}
          {o.customerEmail&&<span className="gg-admin-contact" dir="ltr">{o.customerEmail}</span>}
        </div>
      </div>
      <select
        value={o.status}
        onChange={e=>changeStatus(o.id,e.target.value)}
        className="gg-inp"
        style={{width:"auto",padding:"6px 12px",fontSize:13,fontWeight:600}}
      >
        {ORDER_STATUSES.map(s=><option key={s} value={s}>{s}</option>)}
      </select>
    </div>
    <OrderTracker status={o.status}/>
    <div className="gg-admin-delivery">
      <div className="gg-filter-title">Delivery Details</div>
      {o.shippingName&&<span className="gg-admin-bidi" dir="auto">{o.shippingName}</span>}
      {o.shippingAddress&&<span className="gg-admin-bidi" dir="auto">{o.shippingAddress}</span>}
      {o.governorate&&<span className="gg-admin-bidi" dir="auto">{o.governorate}</span>}
       {o.wilayat&&<span className="gg-admin-bidi" dir="auto">{o.wilayat}</span>}
       {o.postalCode&&<span className="gg-admin-contact" dir="ltr">{o.postalCode}</span>}
      {o.phone&&<span className="gg-admin-contact gg-admin-phone" dir="ltr">{o.phone}</span>}
    </div>
    {o.items.map((it:any,i:number)=>
      <div key={i} style={{fontSize:13,color:"var(--text2)",padding:"4px 0"}}>
        {it.name} · Size {it.size} · Qty {it.qty} —{" "}
        <span style={{fontWeight:600,color:"var(--plum)"}}>{money(it.price)}</span>
      </div>
    )}
       <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:10,gap:10,flexWrap:"wrap"}}>
      <button
        className="gg-btn-outline"
        style={{fontSize:12.5,padding:"7px 16px"}}
        onClick={()=>setViewingOrder(o)}
      >
        View / Print Bill
      </button>
       {o.transferReceiptAvailable&&<button className="gg-btn-outline" style={{fontSize:12.5,padding:"7px 16px"}} onClick={()=>window.open(`/api/admin/orders/${o.id}/transfer-receipt`,"_blank","noopener,noreferrer")}>View Transfer Receipt</button>}
      <div style={{fontWeight:700,color:"var(--pink-deep)",fontSize:14.5}}>
        Total: {money(o.total)}
      </div>
    </div>
  </div>;
}

 function AdminAnalytics({data}:{data:any}){
   const totals=data?.totals||{orders:0,grossSales:0,visibleProducts:0,products:0};
   const statusEntries=Object.entries(data?.ordersByStatus||{}) as [string,number][];
   return <div style={{display:"grid",gap:18}}>
     <div style={{display:"grid",gridTemplateColumns:"repeat(4,minmax(0,1fr))",gap:12}}>
       {[["Orders",totals.orders],["Gross sales",money(totals.grossSales)],["Visible products",totals.visibleProducts],["Catalog products",totals.products]].map(([label,value])=><div key={String(label)} style={{background:"#fff",border:"1px solid var(--border)",borderRadius:16,padding:18}}><div style={{fontSize:12,color:"var(--text2)"}}>{label}</div><div style={{fontSize:24,fontWeight:700,color:"var(--plum)",marginTop:5}}>{value}</div></div>)}
     </div>
     <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:18}}>
       <div style={{background:"#fff",border:"1px solid var(--border)",borderRadius:16,padding:20}}><div className="gg-filter-title" style={{marginBottom:14}}>Orders by status</div>{statusEntries.length?statusEntries.map(([status,count])=><div key={status} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid var(--border)",fontSize:13}}><span>{status}</span><b>{count}</b></div>):<div style={{color:"var(--text2)",fontSize:13}}>No orders yet.</div>}</div>
       <div style={{background:"#fff",border:"1px solid var(--border)",borderRadius:16,padding:20}}><div className="gg-filter-title" style={{marginBottom:14}}>Top products</div>{(data?.topProducts||[]).length?(data.topProducts as any[]).map((item)=><div key={item.name} style={{display:"flex",justifyContent:"space-between",gap:12,padding:"8px 0",borderBottom:"1px solid var(--border)",fontSize:13}}><span>{item.name}</span><b>{item.quantity} sold · {money(item.revenue)}</b></div>):<div style={{color:"var(--text2)",fontSize:13}}>Sales data will appear after the first order.</div>}</div>
     </div>
   </div>;
 }

  function AdminReviewCard({review,changeStatus,deleteReview}:{review:AdminReview;changeStatus:(id:number,status:ReviewModerationStatus)=>void;deleteReview:(review:AdminReview)=>void}){
    const statusColor=review.moderationStatus==="visible"?"#8bbf9f":review.moderationStatus==="hidden"?"#a88a9f":"#d9a04d";
    return <article style={{background:"#fff",border:"1px solid var(--border)",borderRadius:16,padding:"18px 22px"}}>
      <div style={{display:"flex",justifyContent:"space-between",gap:16,flexWrap:"wrap",marginBottom:12}}>
        <div><div style={{fontWeight:700,color:"var(--plum)",fontSize:15}}>{review.productName}</div><div style={{fontSize:12,color:"var(--text2)",marginTop:4}}>By <span dir="auto">{review.customerName}</span> · <span dir="ltr">{review.customerEmail}</span> · {new Date(review.createdAt).toLocaleDateString()}</div></div>
        <span className="gg-badge" style={{background:statusColor,color:"#fff"}}>{review.moderationStatus}</span>
      </div>
      <div style={{display:"flex",gap:3,color:"#e8b04b",marginBottom:8}} aria-label={`${review.rating} out of 5 stars`}>{[1,2,3,4,5].map(value=><Star key={value} size={15} fill={value<=review.rating?"currentColor":"none"}/>)}</div>
      {review.title&&<div style={{fontWeight:700,color:"var(--plum)",marginBottom:5}}>{review.title}</div>}
      <p style={{color:"var(--text2)",fontSize:13.5,lineHeight:1.6,margin:"0 0 14px",whiteSpace:"pre-wrap"}}>{review.body}</p>
      <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
        <label className="gg-field-label" htmlFor={`review-status-${review.id}`} style={{margin:0}}>Moderation</label>
        <select id={`review-status-${review.id}`} className="gg-inp" value={review.moderationStatus} onChange={event=>changeStatus(review.id,event.target.value as ReviewModerationStatus)} style={{width:"auto",padding:"7px 12px",margin:0}}>
          <option value="pending">Pending</option><option value="visible">Visible</option><option value="hidden">Hidden</option>
        </select>
        {review.moderationStatus==="hidden"&&<button className="gg-btn-outline" style={{fontSize:12.5,padding:"7px 16px"}} onClick={()=>changeStatus(review.id,"visible")}>Restore</button>}
        {review.moderationStatus!=="hidden"&&<button className="gg-btn-outline" style={{fontSize:12.5,padding:"7px 16px"}} onClick={()=>changeStatus(review.id,"hidden")}>Hide</button>}
        <button className="gg-btn-outline" style={{fontSize:12.5,padding:"7px 16px",color:"#b04b6b",borderColor:"#e7a5b8"}} onClick={()=>deleteReview(review)}>Delete</button>
      </div>
    </article>;
  }

  function localDateTimeValue(value:string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const pad = (part:number) => String(part).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  type DiscountForm = { code:string; percentage:string; categories:string[]; startsAt:string; endsAt:string; isEnabled:boolean };
  const emptyDiscountForm = ():DiscountForm => ({
    code:"",
    percentage:"10",
    categories:[],
    startsAt:localDateTimeValue(new Date().toISOString()),
    endsAt:"",
    isEnabled:true,
  });

  function AdminDiscounts() {
    const [discounts,setDiscounts] = useState<Discount[]>([]);
    const [serverCategories,setServerCategories] = useState<string[]>([]);
    const [form,setForm] = useState<DiscountForm>(()=>emptyDiscountForm());
    const [editingId,setEditingId] = useState<number|null>(null);
    const [loading,setLoading] = useState(true);
    const [saving,setSaving] = useState(false);
    const [message,setMessage] = useState("");
    const [error,setError] = useState("");
    const presetPercentages = [5,15,20,25,30,50];
    const availableCategories = serverCategories.length ? serverCategories : categories;

    const load = async (showLoading=true) => {
      if(showLoading) setLoading(true);
      setError("");
      try {
        const data = await api<{discounts:Discount[];categories:string[]}>("/admin/discounts");
        setDiscounts(data.discounts || []);
        setServerCategories(data.categories || []);
      } catch (err) {
        if (!isBackendUnavailable(err)) setError(err instanceof Error ? err.message : "Unable to load promo codes.");
      } finally {
        setLoading(false);
      }
    };
    useEffect(()=>{
      void load();
      const timer=setInterval(()=>void load(false),60_000);
      return ()=>clearInterval(timer);
    },[]);

    const reset = () => {
      setEditingId(null);
      setForm(emptyDiscountForm());
      setMessage("");
      setError("");
    };
    const edit = (discount:Discount) => {
      setEditingId(discount.id);
      setForm({
        code:discount.code,
        percentage:String(discount.percentage),
        categories:discount.categories || [],
        startsAt:localDateTimeValue(discount.startsAt),
        endsAt:localDateTimeValue(discount.endsAt),
        isEnabled:discount.isEnabled,
      });
      setMessage("");
      setError("");
      window.scrollTo({top:0,behavior:"smooth"});
    };
    const toggleCategory = (category:string) => setForm(current => ({
      ...current,
      categories:current.categories.includes(category)
        ? current.categories.filter(item=>item!==category)
        : [...current.categories,category],
    }));
    const save = async (event:React.FormEvent) => {
      event.preventDefault();
      setMessage("");
      setError("");
      const percentage = Number(form.percentage);
      if (!/^[a-z0-9][a-z0-9_-]{0,39}$/i.test(form.code.trim())) {
        setError("Use 1–40 letters, numbers, hyphens, or underscores for the code.");
        return;
      }
      if (!Number.isInteger(percentage) || percentage < 1 || percentage > 100) {
        setError("Enter a whole-number percentage from 1 to 100.");
        return;
      }
      if (!form.categories.length) {
        setError("Choose at least one product category.");
        return;
      }
      const startTime = new Date(form.startsAt).getTime();
      const endTime = new Date(form.endsAt).getTime();
      if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || endTime <= startTime) {
        setError("Choose an end date and time after the start date and time.");
        return;
      }
      setSaving(true);
      try {
        const body = {
          code:form.code.trim().toUpperCase(),
          percentage,
          categories:form.categories,
          startsAt:new Date(form.startsAt).toISOString(),
          endsAt:new Date(form.endsAt).toISOString(),
          isEnabled:form.isEnabled,
        };
        await api<Discount>(editingId ? `/admin/discounts/${editingId}` : "/admin/discounts", {
          method:editingId ? "PATCH" : "POST",
          body:JSON.stringify(body),
        });
        await load();
        setMessage(editingId ? "Promo code updated." : "Promo code created.");
        if (!editingId) setForm(emptyDiscountForm());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to save promo code.");
      } finally {
        setSaving(false);
      }
    };
    const toggleEnabled = async (discount:Discount) => {
      setError("");
      try {
        const updated=await api<Discount>(`/admin/discounts/${discount.id}`,{
          method:"PATCH",
          body:JSON.stringify({isEnabled:!discount.isEnabled}),
        });
        setDiscounts(current=>current.map(item=>item.id===updated.id?updated:item));
      } catch (err) {
        setError(err instanceof Error?err.message:"Unable to update promo code.");
      }
    };

    return <div style={{display:"grid",gap:20}}>
      <div style={{background:"#fff",border:"1px solid var(--border)",borderRadius:16,padding:24}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:14,flexWrap:"wrap",marginBottom:16}}>
          <div>
            <h2 style={{fontFamily:"Playfair Display, serif",color:"var(--plum)",margin:0}}>{editingId ? "Edit promo code" : "Create a promo code"}</h2>
            <p style={{fontSize:12.5,color:"var(--text2)",margin:"6px 0 0"}}>Set a clear saving window for selected product categories.</p>
          </div>
          {editingId && <button type="button" className="gg-btn-outline" onClick={reset}>Create new code</button>}
        </div>
        {message && <div role="status" style={{background:"#eef8f1",border:"1px solid #b9ddc4",borderRadius:10,padding:"10px 12px",fontSize:13,color:"#31754b",marginBottom:14}}>{message}</div>}
        {error && <div role="alert" className="gg-error-msg" style={{marginBottom:14}}>{error}</div>}
        <form onSubmit={save}>
          <label className="gg-field-label" htmlFor="discount-code">Code</label>
          <input id="discount-code" className="gg-inp" required value={form.code} onChange={e=>setForm({...form,code:e.target.value.toUpperCase()})} placeholder="EID15" autoCapitalize="characters"/>
          <label className="gg-field-label">Percentage</label>
          <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:10}}>
            {presetPercentages.map(value=><button type="button" key={value} className={Number(form.percentage)===value ? "gg-btn" : "gg-btn-outline"} style={{padding:"8px 13px"}} onClick={()=>setForm({...form,percentage:String(value)})}>{value}%</button>)}
            <label style={{display:"flex",alignItems:"center",gap:8,flex:"1 1 130px",minWidth:130}}>
              <span style={{fontSize:12.5,color:"var(--text2)"}}>Custom</span>
              <input className="gg-inp" style={{margin:0,minWidth:0}} type="number" min="1" max="100" step="1" value={form.percentage} onChange={e=>setForm({...form,percentage:e.target.value})} aria-label="Custom percentage"/>
              <span style={{fontSize:13,color:"var(--text2)"}}>%</span>
            </label>
          </div>
          <label className="gg-field-label">Eligible categories</label>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))",gap:8,marginBottom:14}}>
            {availableCategories.map(category=><label key={category} style={{display:"flex",alignItems:"center",gap:8,fontSize:13,color:"var(--text2)",padding:"8px 10px",border:"1px solid var(--border)",borderRadius:9,background:form.categories.includes(category)?"var(--lavender-light)":"#fff"}}>
              <input type="checkbox" checked={form.categories.includes(category)} onChange={()=>toggleCategory(category)}/><span>{category}</span>
            </label>)}
          </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,230px),1fr))",gap:12}}>
            <label className="gg-field-label" style={{margin:0}}>Starts <input className="gg-inp" type="datetime-local" required value={form.startsAt} onChange={e=>setForm({...form,startsAt:e.target.value})}/></label>
            <label className="gg-field-label" style={{margin:0}}>Ends <input className="gg-inp" type="datetime-local" required value={form.endsAt} onChange={e=>setForm({...form,endsAt:e.target.value})}/></label>
          </div>
          <label style={{display:"flex",alignItems:"center",gap:8,fontSize:13,color:"var(--text2)",margin:"16px 0"}}><input type="checkbox" checked={form.isEnabled} onChange={e=>setForm({...form,isEnabled:e.target.checked})}/><span>Enabled for shoppers</span></label>
          <button type="submit" className="gg-btn" style={{width:"100%"}} disabled={saving}>{saving ? "Saving..." : editingId ? "Save promo code" : "Create promo code"}</button>
        </form>
      </div>
      <div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,marginBottom:12}}>
          <div><h2 style={{fontFamily:"Playfair Display, serif",color:"var(--plum)",margin:0}}>Promo code history</h2><p style={{fontSize:12.5,color:"var(--text2)",margin:"5px 0 0"}}>Current and previous codes with their server status.</p></div>
          <button type="button" className="gg-btn-outline" onClick={()=>void load()} disabled={loading}>Refresh</button>
        </div>
        {loading ? <div className="gg-empty">Loading promo codes...</div> : discounts.length ? <div style={{display:"grid",gap:12}}>{discounts.map(discount=>{
          const statusColor = discount.status==="Active" ? "#4f9970" : discount.status==="Scheduled" ? "#b37a2f" : discount.status==="Disabled" ? "#967c93" : "#9d8b8b";
          return <article key={discount.id} style={{background:"#fff",border:"1px solid var(--border)",borderRadius:16,padding:"16px 20px"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12,flexWrap:"wrap"}}>
              <div style={{display:"flex",alignItems:"center",gap:10}}><div style={{width:36,height:36,borderRadius:10,background:"var(--lavender-light)",display:"grid",placeItems:"center",color:"var(--pink-deep)"}}><Tag size={17}/></div><div><div style={{fontWeight:800,color:"var(--plum)",letterSpacing:".04em"}}>{discount.code}</div><div style={{fontSize:12,color:"var(--text2)"}}>{discount.percentage}% off eligible items</div></div></div>
               <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}><span className="gg-badge" style={{background:statusColor,color:"#fff"}}>{discount.status}</span><button type="button" className="gg-btn-outline" style={{padding:"7px 13px",fontSize:12.5}} onClick={()=>edit(discount)}>Edit</button><button type="button" className="gg-btn-outline" style={{padding:"7px 13px",fontSize:12.5}} onClick={()=>toggleEnabled(discount)}>{discount.isEnabled?"Disable":"Enable"}</button></div>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:7,fontSize:12.5,color:"var(--text2)",marginTop:14}}><CalendarClock size={14}/><span>{new Date(discount.startsAt).toLocaleString()} – {new Date(discount.endsAt).toLocaleString()}</span></div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:10}}>{discount.categories.map(category=><span key={category} style={{fontSize:11.5,padding:"4px 8px",borderRadius:20,background:"var(--cream)",color:"var(--plum)"}}>{category}</span>)}</div>
          </article>;
        })}</div> : <div className="gg-empty">No promo codes yet. Create the first saving for your shoppers.</div>}
      </div>
    </div>;
  }

  function AdminOrders({section:initialSection="products",onProductsChanged}:{section?: "products"|"orders"|"reviews"|"settings"|"analytics"|"discounts";onProductsChanged?:(products:Product[])=>void}){
    const [section,setSection]=useState<"products"|"orders"|"reviews"|"settings"|"analytics"|"discounts">(initialSection);
  const [orders,setOrders]=useState<Order[]>([]);
  const [products,setProducts]=useState<Product[]>([]);
   const [reviews,setReviews]=useState<AdminReview[]>([]);
   const [analytics,setAnalytics]=useState<any>(null);
  const [loading,setLoading]=useState(true);
  const [err,setErr]=useState("");
  const [viewingOrder,setViewingOrder]=useState<Order|null>(null);

    useEffect(()=>{
      setLoading(true);
      setErr("");
        const request = section === "orders"
          ? api<any>("/admin/orders")
          : section === "products"
            ? api<any>("/admin/products")
            : section === "reviews"
              ? api<any>("/admin/reviews")
            : section === "analytics"
              ? api<any>("/admin/analytics")
              : Promise.resolve(null);

      request
        .then(data=>{
           if(section === "orders") setOrders(data.orders);
           else if(section === "products") { setProducts(data.products); onProductsChanged?.(data.products); }
           else if(section === "reviews") setReviews(data.reviews);
           else if(section === "analytics") setAnalytics(data);
        })
       .catch(e=>{
          if(isBackendUnavailable(e)){
            if(section==="products"){
              const fallback=catalogFallback();
              setProducts(fallback);
              onProductsChanged?.(fallback);
            } else if(section==="orders") setOrders([]);
            else if(section==="reviews") setReviews([]);
            else if(section==="analytics"){
              const fallback=catalogFallback();
              setAnalytics({totals:{orders:0,grossSales:0,visibleProducts:fallback.length,products:fallback.length},ordersByStatus:{},topProducts:[]});
            }
            return;
          }
          setErr(e.message);
       })
       .finally(()=>setLoading(false));
   },[section]);

  const changeReviewStatus=async(id:number,moderationStatus:ReviewModerationStatus)=>{
    const previous=reviews;
    setReviews(current=>current.map(review=>review.id===id?{...review,moderationStatus}:review));
    try{
      await api(`/admin/reviews/${id}/status`,{method:"PATCH",body:JSON.stringify({moderationStatus})});
    }catch(error){
      if(isBackendUnavailable(error)) return;
      setReviews(previous);
      alert(error instanceof Error?error.message:"Failed to update review moderation");
    }
  };

  const deleteReview=async(review:AdminReview)=>{
    if(!window.confirm(`Delete this review by ${review.customerName} permanently? This cannot be undone.`)) return;
    const previous=reviews;
    setReviews(current=>current.filter(item=>item.id!==review.id));
    try{
      await api(`/admin/reviews/${review.id}`,{method:"DELETE"});
    }catch(error){
      if(isBackendUnavailable(error)) return;
      setReviews(previous);
      alert(error instanceof Error?error.message:"Failed to delete review");
    }
  };

  const changeStatus=async(id:string,status:string)=>{
    const prev=orders;
    setOrders(o=>o.map(x=>x.id===id?{...x,status}:x));

    try{
      await api(`/admin/orders/${id}/status`,{
        method:"PATCH",
        body:JSON.stringify({status})
      });
    }catch(e){
      if(isBackendUnavailable(e)) return;
      setOrders(prev);
      alert(e instanceof Error?e.message:"Failed to update status");
    }
  };

  const hideOrShowProduct=async(id:string,isVisible:boolean)=>{
    const previous=products;

        setProducts(p =>
      p.map(x =>
        x.id===id
          ? {...x,isVisible}
          : x
      )
    );

    try{
      await api(`/admin/products/${id}/visibility`,{
        method:"PATCH",
        body:JSON.stringify({isVisible})
      });
    }catch(e){
      if(isBackendUnavailable(e)) return;
      setProducts(previous);
      alert(e instanceof Error?e.message:"Failed to update product visibility");
    }
  };

  const deleteProduct=async(product:Product)=>{
    const confirmed=window.confirm(
      `Delete "${product.name}" permanently? This cannot be undone.`
    );
    if(!confirmed)return;

    const previous=products;
      setProducts(current=>current.filter(x=>x.id!==product.id));

    try{
       await api(`/admin/products/${product.id}`,{method:"DELETE"});
       onProductsChanged?.(products.filter(x=>x.id!==product.id));
    }catch(e){
      if(isBackendUnavailable(e)) return;
      setProducts(previous);
      alert(e instanceof Error?e.message:"Failed to delete product");
    }
  };

  if(viewingOrder)
    return <OrderReceipt order={viewingOrder} onBack={()=>setViewingOrder(null)}/>;

  const activeOrders=orders.filter(o=>o.status!=="Received");
  const finishedOrders=orders.filter(o=>o.status==="Received");

  return (
    <div className="gg-container gg-section">

      <h1 style={{
        fontFamily:"Playfair Display, serif",
        fontSize:26,
        fontWeight:700,
        color:"var(--plum)",
        marginBottom:20
      }}>
        Admin Dashboard
      </h1>

      <div style={{display:"flex",gap:10,marginBottom:28,flexWrap:"wrap"}}>
        <button
          className={section==="products" ? "gg-btn" : "gg-btn-outline"}
          onClick={()=>setSection("products")}
        >
          Products
        </button>
        <button
          className={section==="orders" ? "gg-btn" : "gg-btn-outline"}
          onClick={()=>setSection("orders")}
        >
          All Orders
        </button>
         <button
           className={section==="reviews" ? "gg-btn" : "gg-btn-outline"}
           onClick={()=>setSection("reviews")}
         >
           Reviews
         </button>
         <button
           className={section==="settings" ? "gg-btn" : "gg-btn-outline"}
           onClick={()=>setSection("settings")}
         >
           Settings
         </button>
         <button
           className={section==="analytics" ? "gg-btn" : "gg-btn-outline"}
           onClick={()=>setSection("analytics")}
         >
           Analytics
         </button>
          <button
            className={section==="discounts" ? "gg-btn" : "gg-btn-outline"}
            onClick={()=>setSection("discounts")}
          >
            Discounts / Promo Codes
          </button>
      </div>

      {loading && (
        <div className="gg-empty">
          Loading...
        </div>
      )}

      {err && (
        <div className="gg-empty">
          {err}
        </div>
      )}

       {!loading && !err && (
         <>
            {section==="analytics" ? <AdminAnalytics data={analytics}/> : section==="settings" ? <AdminSettings products={products} onProductSaved={product=>{const next=products.some(item=>item.id===product.id)?products.map(item=>item.id===product.id?product:item):[...products,product];setProducts(next);onProductsChanged?.(next)}}/> : section==="discounts" ? <AdminDiscounts/> : <>
          {/* PRODUCTS */}
           <section style={{marginBottom:50,display:section==="products"?"block":"none"}}>

            <h2 style={{
              fontFamily:"Playfair Display, serif",
              color:"var(--plum)",
              marginBottom:16
            }}>
              Products
            </h2>

            <div style={{
              display:"flex",
              flexDirection:"column",
              gap:12
            }}>
              {products.map(product=>(
                <div
                  key={product.id}
                  style={{
                    background:"#fff",
                    border:"1px solid var(--border)",
                    borderRadius:16,
                    padding:"16px 20px",
                    display:"flex",
                    justifyContent:"space-between",
                    alignItems:"center",
                    gap:15,
                    flexWrap:"wrap"
                  }}
                >

                  <div>
                    <div style={{
                      fontWeight:700,
                      color:"var(--plum)"
                    }}>
                      {product.name}
                    </div>

                    <div style={{
                      fontSize:12,
                      color:"var(--text2)"
                    }}>
                      {product.category} · {money(product.price)}
                    </div>
                  </div>

                  <div style={{
                    display:"flex",
                    alignItems:"center",
                    gap:12
                  }}>

                    <span
                      className="gg-badge"
                      style={{
                        background:product.isVisible
                          ? "#8bbf9f"
                          : "#aaa",
                        color:"#fff"
                      }}
                    >
                      {product.isVisible
                        ? "Visible"
                        : "Hidden"}
                    </span>

                    <button
                      className="gg-btn-outline"
                      style={{
                        fontSize:12.5,
                        padding:"7px 16px"
                      }}
                      onClick={() =>
                        hideOrShowProduct(
                          product.id,
                          !product.isVisible
                        )
                      }
                    >
                      {product.isVisible
                        ? "Hide"
                        : "Show"}
                    </button>

                    <button
                      className="gg-btn-outline"
                      style={{
                        fontSize:12.5,
                        padding:"7px 16px",
                        color:"#b04b6b",
                        borderColor:"#e7a5b8"
                      }}
                      onClick={() => deleteProduct(product)}
                    >
                      Delete
                    </button>

                  </div>

                </div>
              ))}
            </div>

          </section>

          {/* ORDERS */}
           <section style={{display:section==="orders"?"block":"none"}}>

            <h2 style={{
              fontFamily:"Playfair Display, serif",
              color:"var(--plum)",
              marginBottom:16
            }}>
              All Orders
            </h2>

            <div style={{
              display:"flex",
              flexDirection:"column",
              gap:16
            }}>
              {activeOrders.length
                ? activeOrders.map(o=>
                    <AdminOrderCard key={o.id} o={o} changeStatus={changeStatus} setViewingOrder={setViewingOrder}/>
                  )
                : (
                  <div className="gg-empty">
                    No active orders right now.
                  </div>
                )}
            </div>

            {finishedOrders.length>0 && (
              <div style={{marginTop:36}}>

                <div
                  className="gg-filter-title"
                  style={{
                    fontSize:14,
                    marginBottom:14,
                    color:"var(--plum)"
                  }}
                >
                  Order Finished
                </div>

                <div style={{
                  display:"flex",
                  flexDirection:"column",
                  gap:16,
                  opacity:0.85
                }}>
                  {finishedOrders.map(o=>
                      <AdminOrderCard key={o.id} o={o} changeStatus={changeStatus} setViewingOrder={setViewingOrder}/>
                  )}
                </div>

              </div>
            )}

          </section>

           {/* REVIEWS */}
           <section style={{display:section==="reviews"?"block":"none"}}>
             <h2 style={{fontFamily:"Playfair Display, serif",color:"var(--plum)",marginBottom:6}}>Customer Reviews</h2>
             <p style={{fontSize:13,color:"var(--text2)",marginBottom:16}}>Approve new reviews, hide content that should not appear publicly, or restore and delete existing reviews.</p>
             <div style={{display:"flex",flexDirection:"column",gap:16}}>
               {reviews.length ? reviews.map(review=><AdminReviewCard key={review.id} review={review} changeStatus={changeReviewStatus} deleteReview={deleteReview}/>) : <div className="gg-empty">No customer reviews yet.</div>}
             </div>
           </section>

         </>}
         </>
      )}

    </div>
  );
}
export function OrderCard({o,viewBill}:{o:Order;viewBill:(o:Order)=>void}){
  return <div style={{background:"#fff",border:"1px solid var(--border)",borderRadius:16,padding:"18px 22px"}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:12}}><div><div style={{fontWeight:700,color:"var(--plum)",fontSize:14.5}}><OrderReference value={o.id}/></div><div style={{fontSize:12,color:"var(--text2)"}}>Placed {o.date}</div></div><span className="gg-badge" style={{background:o.status==="Received"?"#8bbf9f":"var(--pink)",color:"#fff"}}>{o.status}</span></div><OrderTracker status={o.status}/>{o.items.map((it:any,i:number)=><div key={i} style={{fontSize:13,color:"var(--text2)",padding:"4px 0"}}>{it.name} · Size {it.size} · Qty {it.qty} — <span style={{fontWeight:600,color:"var(--plum)"}}>{money(it.price)}</span></div>)}<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:10}}><button className="gg-btn-outline" style={{fontSize:12.5,padding:"7px 16px"}} onClick={()=>viewBill(o)}>View Bill</button><div style={{fontWeight:700,color:"var(--pink-deep)",fontSize:14.5}}>Total: {money(o.total)}</div></div></div>;
}
 function PreferencesPanel(){
   const {language,setLanguage,theme,setTheme,t}=usePreferences();
   return <section className="gg-preferences" aria-labelledby="gg-preferences-title">
     <div className="gg-filter-title" id="gg-preferences-title">{t("preferences.title")}</div>
     <p className="gg-preferences-copy">{t("preferences.subtitle")}</p>
     <div className="gg-preferences-grid">
       <label className="gg-preference-field"><span>{t("language.label")}</span><select className="gg-inp" value={language} onChange={e=>setLanguage(e.target.value as "en"|"ar")}><option value="en">{t("language.english")}</option><option value="ar">{t("language.arabic")}</option></select></label>
       <label className="gg-preference-field"><span>{t("theme.label")}</span><select className="gg-inp" value={theme} onChange={e=>setTheme(e.target.value as "auto"|"light"|"dark")}><option value="auto">{t("theme.auto")}</option><option value="light">{t("theme.light")}</option><option value="dark">{t("theme.dark")}</option></select></label>
     </div>
     <p className="gg-preferences-note">{t("preferences.saved")}</p>
   </section>;
 }
function Account({user,wishedProducts,orders,go,toggleWish,open,logout,viewBill}:any){
  const {t}=usePreferences();
  const [tab,setTab]=useState("orders");
  const activeOrders=orders.filter((o:Order)=>o.status!=="Received");
  const finishedOrders=orders.filter((o:Order)=>o.status==="Received");
  return <div className="gg-container gg-section">
    <div style={{display:"flex",alignItems:"center",gap:16,marginBottom:32}}>
      <div style={{width:58,height:58,borderRadius:"50%",background:"linear-gradient(155deg,var(--pink),var(--lavender))",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:20}}>{user.initials}</div>
      <div><div style={{fontFamily:"Playfair Display, serif",fontSize:22,fontWeight:700,color:"var(--plum)"}}>{user.name}</div><div style={{fontSize:13,color:"var(--text2)"}}>{user.email}</div></div>
    </div>
    <div style={{display:"flex",gap:10,marginBottom:28,borderBottom:"1px solid var(--border)"}}>
      {[["orders",t("account.myOrders"),<Package size={15}/>],["wishlist",t("account.wishlist"),<Heart size={15}/>],["profile",t("account.profile"),<UserIcon size={15}/>]].map(([id,label,icon]:any)=><button key={id} onClick={()=>setTab(id)} style={{display:"flex",alignItems:"center",gap:6,padding:"10px 16px",fontSize:13.5,fontWeight:600,color:tab===id?"var(--pink-deep)":"var(--text2)",borderBottom:tab===id?"2px solid var(--pink)":"2px solid transparent"}}>{icon}{label}</button>)}
    </div>
    {tab==="orders"&&(orders.length?<div>
      <div style={{display:"flex",flexDirection:"column",gap:16}}>{activeOrders.length?activeOrders.map((o:Order)=><OrderCard key={o.id} o={o} viewBill={viewBill}/>):<div className="gg-empty" style={{padding:"24px 20px"}}>No active orders right now.</div>}</div>
      {finishedOrders.length>0&&<div style={{marginTop:36}}><div className="gg-filter-title" style={{fontSize:14,marginBottom:14,color:"var(--plum)"}}>Order Finished</div><div style={{display:"flex",flexDirection:"column",gap:16,opacity:0.85}}>{finishedOrders.map((o:Order)=><OrderCard key={o.id} o={o} viewBill={viewBill}/>)}</div></div>}
    </div>:<div className="gg-empty">{t("account.noOrders")}</div>)}
    {tab==="wishlist"&&(wishedProducts.length?<div className="gg-grid">{wishedProducts.map((p:Product)=><ProductCard key={p.id} product={p} wished onOpen={()=>open(p)} onWish={()=>toggleWish(p)}/>)}</div>:<div className="gg-empty">{t("account.nothingSaved")}</div>)}
    {tab==="profile"&&<div style={{display:"grid",gap:16,maxWidth:520}}>
      <div style={{background:"#fff",border:"1px solid var(--border)",borderRadius:16,padding:24}}>
        <label className="gg-field-label">{t("account.fullName")}</label><input className="gg-inp" defaultValue={user.name}/>
        <label className="gg-field-label">{t("account.email")}</label><input className="gg-inp" defaultValue={user.email}/>
        <button className="gg-btn-outline" style={{width:"100%",marginTop:8,display:"flex",gap:8,justifyContent:"center"}} onClick={logout}><LogOut size={16}/> {t("account.signOut")}</button>
      </div>
      <PreferencesPanel/>
    </div>}
  </div>;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [guestMode, setGuestMode] = useState(false);
  const [checking, setChecking] = useState(true);
  const [page, setPage] = useState("home");
  const [category, setCategory] = useState<string | undefined>();
  const [products, setProducts] = useState<Product[]>([]);
  const [active, setActive] = useState<Product | null>(null);
  const [lines, setLines] = useState<Line[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("gg-cart") || "[]") as Line[];
    } catch {
      return [];
    }
  });
  const [cartOpen, setCartOpen] = useState(false);
  const [wishlistIds, setWishlistIds] = useState<Set<string>>(new Set());
  const [orders, setOrders] = useState<Order[]>([]);
  const [viewingOrder, setViewingOrder] = useState<Order | null>(null);
  const [recentIds, setRecentIds] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("gg-recent-products") || "[]") as string[];
    } catch {
      return [];
    }
  });

  const go = (nextPage: string, nextCategory?: string) => {
    setPage(nextPage);
    setCategory(nextCategory);
    setActive(null);
    setCartOpen(false);
    window.scrollTo(0, 0);
  };

  useEffect(() => {
    localStorage.setItem("gg-cart", JSON.stringify(lines));
  }, [lines]);
  useEffect(() => {
    localStorage.setItem("gg-recent-products", JSON.stringify(recentIds));
  }, [recentIds]);
  useEffect(() => {
    api<User>("/auth/me").then(setUser).catch(() => {}).finally(() => setChecking(false));
    api<any>("/products").then((data) => setProducts(data.products)).catch(() => setProducts(catalogFallback()));
  }, []);
  useEffect(() => {
    if (user) {
      api<any>("/wishlist").then((data) => setWishlistIds(new Set(data.productIds))).catch(() => {});
      api<any>("/orders").then((data) => setOrders(data.orders)).catch(() => {});
    }
  }, [user]);

  const toggleWish = async (product: Product) => {
    if (!user) {
      alert("Sign in to save favorites to your wishlist.");
      return;
    }
    try {
      if (wishlistIds.has(product.id)) {
        await api(`/wishlist/${product.id}`, { method: "DELETE" });
        setWishlistIds((previous) => { const next = new Set(previous); next.delete(product.id); return next; });
      } else {
        await api("/wishlist", { method: "POST", body: JSON.stringify({ productId: product.id }) });
        setWishlistIds((previous) => new Set(previous).add(product.id));
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : "Unable to update wishlist");
    }
  };
  const add = (product: Product, size: string, colorway = product.colorway) => setLines((previous) => {
    const found = previous.find((line) => line.productId === product.id && line.size === size && line.colorway === colorway);
    return found ? previous.map((line) => line === found ? { ...line, qty: Math.min(10, line.qty + 1) } : line) : [...previous, { productId: product.id, size, qty: 1, colorway }];
  });
  const update = (id: string, size: string, qty: number, colorway?: string) => setLines((previous) => previous.map((line) => line.productId === id && line.size === size && line.colorway === colorway ? { ...line, qty: Math.max(1, Math.min(10, qty)) } : line));
  const remove = (id: string, size: string, colorway?: string) => setLines((previous) => previous.filter((line) => !(line.productId === id && line.size === size && line.colorway === colorway)));
  const logout = async () => {
    if (user) await api("/auth/logout", { method: "POST" }).catch(() => {});
    setUser(null);
    setGuestMode(false);
    setPage("home");
  };

  if (checking) return <><BackgroundCanvas /><div className="gg-empty" style={{ minHeight: "100vh" }}>Loading your glam...</div></>;
  if (!user && !guestMode) return <><BackgroundCanvas /><Auth onUser={(nextUser)=>{setGuestMode(false);setUser(nextUser)}} onGuest={()=>{setGuestMode(true);setPage("home")}} /></>;

  const browsingUser:User = user ?? {id:"guest",name:"Guest shopper",email:"",initials:"G",isAdmin:false};
  const navigate = (nextPage: string, nextCategory?: string) => {
    if (!user && (nextPage === "account" || nextCategory === "wishlist")) {
      alert("Sign in to open your account and manage favorites.");
      return;
    }
    if (nextCategory === "wishlist") {
      setPage("account");
      return;
    }
    go(nextPage, nextCategory);
  };
  const wishedProducts = products.filter((product) => wishlistIds.has(product.id));
  const openProduct = (product: Product) => {
    setActive(product);
    setRecentIds((previous) => [product.id, ...previous.filter((id) => id !== product.id)].slice(0, 6));
    setPage("product");
    window.scrollTo(0, 0);
  };
  const recentProducts = recentIds.map((id) => products.find((product) => product.id === id)).filter(Boolean) as Product[];
  let content: any;
  if (page === "shop") content = <Shop products={products} initial={category} go={go} wished={wishlistIds} toggleWish={toggleWish} open={openProduct} />;
  else if (page === "product" && active) content = <ProductDetail product={active} add={add} toggle={toggleWish} wished={wishlistIds.has(active.id)} back={() => go("shop")} />;
  else if (page === "checkout") content = <Checkout lines={lines} products={products} onDone={() => { setLines([]); go("home"); }} />;
  else if (page === "bill" && viewingOrder) content = <OrderReceipt order={viewingOrder} onBack={() => go("account")} />;
  else if (page === "account") content = <Account user={browsingUser} wishedProducts={wishedProducts} orders={orders} go={go} toggleWish={toggleWish} open={openProduct} logout={logout} viewBill={(order: Order) => { setViewingOrder(order); go("bill"); }} />;
  else if (page === "admin" && browsingUser.isAdmin) content = <AdminOrders onProductsChanged={setProducts} />;
  else content = <Home products={products} go={go} wished={wishlistIds} toggleWish={toggleWish} open={openProduct} />;

  return <><BackgroundCanvas /><div id="app" style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
    <Header user={browsingUser} page={page} count={lines.reduce((sum, line) => sum + line.qty, 0)} wishCount={wishlistIds.size} go={navigate} openCart={() => setCartOpen(true)} logout={logout} />
    <div style={{ flex: 1, position: "relative", zIndex: 1 }}>{content}
      {page === "home" && recentProducts.length > 0 && <section className="gg-section gg-container"><div className="gg-section-head"><div><div className="gg-section-title">Recently viewed</div><div className="gg-section-sub">Pick up where you left off</div></div></div><div className="gg-grid">{recentProducts.map((product) => <ProductCard key={product.id} product={product} wished={wishlistIds.has(product.id)} onOpen={() => openProduct(product)} onWish={() => toggleWish(product)} />)}</div></section>}
    </div>
    <Footer go={navigate} logout={logout} />
  </div><Cart open={cartOpen} close={() => setCartOpen(false)} lines={lines} products={products} update={update} remove={remove} checkout={() => {
    if (!user) {
      setCartOpen(false);
      alert("Please sign in or create an account before checkout.");
      return;
    }
    setCartOpen(false);
    go("checkout");
  }} /><WhatsAppSupport /></>;
}

function LanguageSwitch({language,onChange}:{language:CheckoutLanguage;onChange:(language:CheckoutLanguage)=>void}) {
  const t=checkoutCopy[language];
  return <div className="gg-language-switch gg-print-hide" role="group" aria-label={t.language}>
    <span>{t.language}</span>
    <button type="button" className={language==="en"?"active":""} onClick={()=>onChange("en")} aria-pressed={language==="en"}>{t.english}</button>
    <button type="button" className={language==="ar"?"active":""} onClick={()=>onChange("ar")} aria-pressed={language==="ar"}>{t.arabic}</button>
  </div>;
}

function detectReceiptMime(bytes: Uint8Array): string | null {
  const startsWith = (signature: number[]) => signature.every((byte, index) => bytes[index] === byte);
  if (startsWith([0x25,0x50,0x44,0x46,0x2d])) return "application/pdf";
  if (bytes.length >= 3 && bytes[0]===0xff && bytes[1]===0xd8 && bytes[2]===0xff) return "image/jpeg";
  if (startsWith([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a])) return "image/png";
  if (bytes.length >= 12 && startsWith([0x52,0x49,0x46,0x46]) && bytes[8]===0x57 && bytes[9]===0x45 && bytes[10]===0x42 && bytes[11]===0x50) return "image/webp";
  return null;
}
