export type Category = 'Cotton Makhwar' | 'Italy Silk Makhwar' | 'Digital Cotton Liberty' | 'Cotton Amoudi Makhwar' | 'Makhwar Scarfs' | 'Earrings' | 'Full Sets' | 'Necklace' | 'Bracelet' | 'Rings';

export interface Product {
  id: string;
  name: string;
  category: Category;
  price: number;
  compareAt?: number;
  colorway: string;
  swatch: string;      // hex used for the placeholder image color
  sizes: string[];
  isNew?: boolean;
  isBestseller?: boolean;
  rating: number;
  reviews: number;
  description: string;
}

export const CATEGORIES: { id: Category; label: string; blurb: string }[] = [
  { id: 'Cotton Makhwar',         label: 'Cotton Makhwar',         blurb: 'Soft, breathable comfort' },
  { id: 'Italy Silk Makhwar',     label: 'Italy Silk Makhwar',     blurb: 'Luxe silk finish' },
  { id: 'Digital Cotton Liberty', label: 'Digital Cotton Liberty', blurb: 'Prints made to bloom' },
  { id: 'Cotton Amoudi Makhwar',  label: 'Cotton Amoudi Makhwar',  blurb: 'Lightweight everyday glam' },
  { id: 'Makhwar Scarfs',         label: 'Makhwar Scarfs',         blurb: 'Embroidered color for every look' },
  { id: 'Earrings',              label: 'Earrings',              blurb: 'Statement studs and hoops' },
  { id: 'Full Sets',             label: 'Full Sets',             blurb: 'Matching sets, effortless glam' },
  { id: 'Necklace',              label: 'Necklace',              blurb: 'Layer-worthy pieces' },
  { id: 'Bracelet',              label: 'Bracelet',              blurb: 'Delicate arm candy' },
  { id: 'Rings',                 label: 'Rings',                 blurb: 'Little details that shine' },
];

const names: Record<Category, string[]> = {
  'Cotton Makhwar': ['Lilac Cotton Makhwar', 'Cloud Cotton Makhwar', 'Heart Cotton Makhwar', 'Sparkle Cotton Makhwar', 'Butter Cotton Makhwar'],
  'Italy Silk Makhwar': ['Silk Rose Makhwar', 'Silk Lavender Makhwar', 'Silk Pearl Makhwar', 'Silk Blossom Makhwar'],
  'Digital Cotton Liberty': ['Liberty Bloom Makhwar', 'Liberty Garden Makhwar', 'Liberty Petal Makhwar', 'Liberty Sky Makhwar', 'Liberty Rose Makhwar'],
  'Cotton Amoudi Makhwar': ['Amoudi Blush Makhwar', 'Amoudi Lilac Makhwar', 'Amoudi Cream Makhwar', 'Amoudi Berry Makhwar', 'Amoudi Sky Makhwar'],
  'Makhwar Scarfs': ['Makhwar Scarf — Jewel Tones', 'Makhwar Scarf — Soft Pastels'],
  Earrings: ['Pearl Drop Earrings', 'Crystal Hoop Earrings'],
  'Full Sets': ['Rose Gold Full Set', 'Pearl Glow Full Set'],
  Necklace: ['Layered Pearl Necklace', 'Heart Charm Necklace'],
  Bracelet: ['Blush Tennis Bracelet', 'Dainty Charm Bracelet'],
  Rings: ['Petal Stack Ring', 'Twinkle Signet Ring'],
};

const swatches = ['#F6A6C8', '#D9A8DE', '#F7D9A0', '#B8C9F0', '#F5B8C8', '#E7B8E9', '#FCE29B', '#C4A6E0'];

function seedRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function buildProducts(): Product[] {
  const products: Product[] = [];
  let idx = 1;
  (Object.keys(names) as Category[]).forEach((cat) => {
    names[cat].forEach((name, i) => {
      const rnd = seedRandom(idx * 37 + i * 7);
       const base = 22 + Math.floor(rnd() * 58);
       const omrPrice = +(base * 0.385).toFixed(3);
      const onSale = rnd() > 0.7;
      products.push({
        id: `PRD-${String(idx).padStart(3, '0')}`,
        name,
        category: cat,
        price: omrPrice,
        compareAt: onSale ? +((base + 12 + Math.floor(rnd() * 20)) * 0.385).toFixed(3) : undefined,
        colorway: ['Blush', 'Lilac', 'Cream', 'Berry', 'Sky'][Math.floor(rnd() * 5)],
        swatch: swatches[idx % swatches.length],
        sizes: ['XS', 'S', 'M', 'L', 'XL'],
        isNew: rnd() > 0.75,
        isBestseller: rnd() > 0.8,
        rating: +(3.8 + rnd() * 1.2).toFixed(1),
        reviews: Math.floor(20 + rnd() * 480),
        description: `The ${name.toLowerCase()} is cut for movement and made to be photographed. Soft-touch fabric, true-to-size fit, and just enough sparkle for whatever the day calls for.`,
      });
      idx++;
    });
  });
  return products;
}

export const PRODUCTS: Product[] = buildProducts();

export interface CustomerUser {
  email: string;
  pass: string;
  name: string;
  initials: string;
}

export const USERS: CustomerUser[] = [
  { email: 'demo@girliesglam.com', pass: 'glam123', name: 'Maryam Al-Falahi', initials: 'MF' },
];

export type User = CustomerUser;

export interface CartLine {
  productId: string;
  size: string;
  qty: number;
  colorway?: string;
}

export interface Order {
  id: string;
  date: string;
  items: { name: string; size: string; qty: number; price: number; colorway?: string }[];
  total: number;
  status: 'Processing' | 'Shipped' | 'Delivered';
}

export const PAST_ORDERS: Order[] = [
  {
    id: 'GG-10482',
    date: 'Jul 12, 2026',
    items: [
      { name: 'Rosé Makhwar', size: 'M', qty: 1, price: 22.33 },
      { name: 'Liberty Bloom Makhwar', size: 'M', qty: 2, price: 5.39 },
    ],
    total: 33.11,
    status: 'Delivered',
  },
  {
    id: 'GG-10611',
    date: 'Jul 20, 2026',
    items: [{ name: 'Amoudi Lilac Makhwar', size: 'M', qty: 1, price: 18.865 }],
    total: 18.865,
    status: 'Shipped',
  },
];
