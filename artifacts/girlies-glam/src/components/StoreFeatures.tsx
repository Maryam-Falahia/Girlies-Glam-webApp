import { Clock, MessageCircle, Ruler, Star, X } from "lucide-react";
import { useEffect, useState } from "react";

type SizeGuideProps = {
  sizes: string[];
  onClose: () => void;
};

export function SizeGuide({ sizes, onClose }: SizeGuideProps) {
  const rows = [
    ["Small", "84–88", "66–70", "90–94"],
    ["Medium", "89–94", "71–76", "95–100"],
    ["Large", "95–100", "77–82", "101–106"],
    ["X Large", "101–108", "83–90", "107–114"],
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Size guide"
      onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 30, background: "rgba(38, 20, 35, .42)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
    >
      <div onClick={(event) => event.stopPropagation()} style={{ width: "min(520px, 100%)", background: "#fff", borderRadius: 20, padding: 24, boxShadow: "0 20px 60px rgba(38, 20, 35, .2)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: 16 }}>
          <div>
            <div className="gg-filter-title" style={{ fontSize: 18 }}>Size Guide</div>
            <p style={{ margin: "6px 0 0", color: "var(--text2)", fontSize: 13 }}>Measurements are in centimeters. Measure over light clothing for the best fit.</p>
          </div>
          <button className="gg-icon-btn" onClick={onClose} aria-label="Close size guide"><X size={18} /></button>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead><tr>{["Size", "Bust", "Waist", "Hip"].map((heading) => <th key={heading} style={{ textAlign: "left", padding: "9px 8px", borderBottom: "1px solid var(--border)", color: "var(--plum)" }}>{heading}</th>)}</tr></thead>
            <tbody>{rows.filter(([size]) => sizes.includes(size)).map((row) => <tr key={row[0]}>{row.map((cell) => <td key={cell} style={{ padding: "9px 8px", borderBottom: "1px solid var(--border)", color: "var(--text2)" }}>{cell}</td>)}</tr>)}</tbody>
          </table>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", color: "var(--text2)", fontSize: 12, marginTop: 14 }}>
          <Ruler size={15} color="var(--pink-deep)" /> If you are between sizes, choose the larger size for a relaxed fit.
        </div>
      </div>
    </div>
  );
}

export function DeliveryPromise({ governorate }: { governorate?: string }) {
  const eta = governorate === "Muscat" ? "1–2 days" : governorate ? "2–5 days" : "2–5 days across Oman";
  return <div style={{ display: "flex", gap: 9, alignItems: "center" }}><Clock size={16} /> Estimated delivery: {eta}</div>;
}

type ProductReview = {
  id: number;
  rating: number;
  title: string;
  body: string;
  customerName: string;
  createdAt: string;
  moderationStatus?: "visible" | "hidden" | "pending";
};

export function ProductReviews({ productId }: { productId: string }) {
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [myReviewStatus, setMyReviewStatus] = useState<"visible" | "hidden" | "pending" | null>(null);

  const loadReviews = async () => {
    try {
      const response = await fetch(`/api/products/${encodeURIComponent(productId)}/reviews`, { credentials: "include" });
      if (!response.ok) throw new Error("Unable to load reviews");
      const data = await response.json();
      setReviews(data.reviews || []);
      setMyReviewStatus(data.myReviewStatus || null);
    } catch {
      setMessage("Reviews are temporarily unavailable.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadReviews();
  }, [productId]);

  const submitReview = async (event: React.FormEvent) => {
    event.preventDefault();
    if (body.trim().length < 3) {
      setMessage("Please write at least a few words about this product.");
      return;
    }
    setSubmitting(true);
    setMessage("");
    try {
      const response = await fetch(`/api/products/${encodeURIComponent(productId)}/reviews`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, title, body }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to submit review");
      setMyReviewStatus(data.moderationStatus || "pending");
      setTitle("");
      setBody("");
      setRating(5);
      setMessage("Thank you — your review is awaiting approval and will appear here once it is approved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to submit review");
    } finally {
      setSubmitting(false);
    }
  };

  return <section style={{ marginTop: 44, borderTop: "1px solid var(--border)", paddingTop: 28 }}>
    <div className="gg-section-head">
      <div>
        <div className="gg-section-title">Customer reviews</div>
        <div className="gg-section-sub">Share your experience with the Girlies Glam community</div>
      </div>
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))", gap: 22, alignItems: "start" }}>
      {myReviewStatus ? <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 16, padding: 20 }}>
        <div className="gg-filter-title" style={{ marginBottom: 10 }}>Your review</div>
        {myReviewStatus === "hidden"
          ? <p role="status" style={{ color: "#9a3d5d", fontSize: 13, lineHeight: 1.6, margin: 0 }}>Your review is currently hidden and is not visible to other customers. Please contact us if you think this was a mistake.</p>
          : myReviewStatus === "pending"
            ? <p role="status" style={{ color: "var(--text2)", fontSize: 13, lineHeight: 1.6, margin: 0 }}>Your review is waiting for store approval. It will appear here once it is approved.</p>
            : <p role="status" style={{ color: "#3a8a5c", fontSize: 13, lineHeight: 1.6, margin: 0 }}>Your review is live and visible to other customers.</p>}
      </div> : <form onSubmit={submitReview} style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 16, padding: 20 }}>
        <div className="gg-filter-title" style={{ marginBottom: 12 }}>Write a review</div>
        <div style={{ display: "flex", gap: 3, marginBottom: 14 }} aria-label={`Rating: ${rating} out of 5`}>
          {[1, 2, 3, 4, 5].map((value) => <button key={value} type="button" aria-label={`${value} star${value === 1 ? "" : "s"}`} onClick={() => setRating(value)} style={{ color: "#e8b04b", padding: 2 }}><Star size={20} fill={value <= rating ? "currentColor" : "none"} /></button>)}
        </div>
        <label className="gg-field-label" htmlFor={`review-title-${productId}`}>Review title <span style={{ color: "var(--text3)", fontWeight: 400 }}>(optional)</span></label>
        <input id={`review-title-${productId}`} className="gg-inp" maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="What stood out?" />
        <label className="gg-field-label" htmlFor={`review-body-${productId}`}>Your review</label>
        <textarea id={`review-body-${productId}`} className="gg-inp" rows={5} maxLength={2000} required value={body} onChange={(event) => setBody(event.target.value)} placeholder="Tell other customers about the fit, quality, and finish." />
        <button className="gg-btn" type="submit" disabled={submitting} style={{ width: "100%", marginTop: 12 }}>{submitting ? "Posting..." : "Post review"}</button>
        {message && <div role="status" style={{ color: message.includes("Thank you") ? "#3a8a5c" : "#9a3d5d", fontSize: 12.5, lineHeight: 1.5, marginTop: 10 }}>{message}</div>}
      </form>}
      <div style={{ display: "grid", gap: 10 }}>
        {loading ? <div className="gg-empty" style={{ padding: 24 }}>Loading reviews...</div> : reviews.length ? reviews.map((review) => <article key={review.id} style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 16, padding: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
            <div><div style={{ display: "flex", gap: 2, color: "#e8b04b" }}>{[1, 2, 3, 4, 5].map((value) => <Star key={value} size={14} fill={value <= review.rating ? "currentColor" : "none"} />)}</div>{review.title && <div style={{ fontWeight: 700, color: "var(--plum)", marginTop: 7 }}>{review.title}</div>}</div>
            <div style={{ color: "var(--text3)", fontSize: 11 }}>{new Date(review.createdAt).toLocaleDateString()}</div>
          </div>
          <p style={{ color: "var(--text2)", lineHeight: 1.6, fontSize: 13.5, margin: "10px 0 7px" }}>{review.body}</p>
          <div style={{ color: "var(--plum)", fontSize: 12, fontWeight: 600 }}>— {review.customerName}</div>
        </article>) : <div className="gg-empty" style={{ padding: 24 }}>No reviews yet. Be the first customer to share your thoughts.</div>}
      </div>
    </div>
  </section>;
}

export function WhatsAppSupport() {
  const [open, setOpen] = useState(false);
  const phone = "96879162199";
  const message = encodeURIComponent("Hello Girlies Glam, I need help with my order or product.");
  return (
    <div style={{ position: "fixed", right: 20, bottom: 20, zIndex: 20 }}>
      {open && <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 16, padding: 14, marginBottom: 10, width: 220, boxShadow: "0 12px 30px rgba(38,20,35,.15)" }}>
        <div style={{ fontWeight: 700, color: "var(--plum)", fontSize: 13 }}>Need help choosing?</div>
        <div style={{ color: "var(--text2)", fontSize: 12, lineHeight: 1.5, margin: "5px 0 10px" }}>Message us about sizing, products, or an existing order.</div>
        <a className="gg-btn" href={`https://wa.me/${phone}?text=${message}`} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, textDecoration: "none", fontSize: 12 }}>Open WhatsApp</a>
      </div>}
      <button onClick={() => setOpen((value) => !value)} aria-label="Contact Girlies Glam on WhatsApp" style={{ width: 52, height: 52, border: 0, borderRadius: "50%", background: "#25D366", color: "#fff", display: "grid", placeItems: "center", boxShadow: "0 8px 20px rgba(37,211,102,.32)", cursor: "pointer" }}>
        <MessageCircle size={23} />
      </button>
    </div>
  );
}