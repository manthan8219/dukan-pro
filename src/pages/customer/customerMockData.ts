export type ShopCategory = 'grocery' | 'dairy' | 'pharmacy' | 'bakery';

export type MockProduct = {
  id: string;
  name: string;
  price: number;
  unit: string;
  mrp?: number;
};

export type MockShop = {
  id: string;
  name: string;
  categories: ShopCategory[];
  rating: number;
  reviewCount: number;
  distanceKm: number;
  etaMin: number;
  openNow: boolean;
  tagline: string;
  products: MockProduct[];
};

export const MOCK_SHOPS: MockShop[] = [
  {
    id: 'shop-freshcart',
    name: 'FreshCart Kirana',
    categories: ['grocery', 'bakery'],
    rating: 4.7,
    reviewCount: 328,
    distanceKm: 0.7,
    etaMin: 22,
    openNow: true,
    tagline: 'Staples, snacks & daily needs',
    products: [
      { id: 'p1', name: 'Whole wheat atta 10kg', price: 485, unit: 'bag', mrp: 520 },
      { id: 'p2', name: 'Refined sunflower oil 5L', price: 899, unit: 'can', mrp: 960 },
      { id: 'p3', name: 'Toor dal 1kg', price: 142, unit: 'pack' },
      { id: 'p4', name: 'Brown bread loaf', price: 48, unit: 'pc' },
    ],
  },
  {
    id: 'shop-milkyway',
    name: 'MilkyWay Dairy',
    categories: ['dairy', 'bakery'],
    rating: 4.5,
    reviewCount: 186,
    distanceKm: 1.2,
    etaMin: 35,
    openNow: true,
    tagline: 'Milk, curd & fresh paneer',
    products: [
      { id: 'p5', name: 'Toned milk 1L', price: 56, unit: 'pack' },
      { id: 'p6', name: 'Curd 500g', price: 35, unit: 'cup' },
      { id: 'p7', name: 'Paneer 200g', price: 95, unit: 'pack' },
      { id: 'p8', name: 'Butter 100g', price: 58, unit: 'pack', mrp: 62 },
    ],
  },
  {
    id: 'shop-healthplus',
    name: 'HealthPlus Pharmacy',
    categories: ['pharmacy'],
    rating: 4.8,
    reviewCount: 412,
    distanceKm: 1.9,
    etaMin: 40,
    openNow: true,
    tagline: 'OTC, wellness & hygiene',
    products: [
      { id: 'p9', name: 'Vitamin C chewables', price: 180, unit: 'strip' },
      { id: 'p10', name: 'Hand sanitizer 500ml', price: 120, unit: 'bottle' },
      { id: 'p11', name: 'ORS sachets (4)', price: 40, unit: 'pack' },
    ],
  },
  {
    id: 'shop-spicebazaar',
    name: 'Spice Bazaar',
    categories: ['grocery'],
    rating: 4.3,
    reviewCount: 94,
    distanceKm: 2.4,
    etaMin: 45,
    openNow: false,
    tagline: 'Masalas, rice & dry fruits',
    products: [
      { id: 'p12', name: 'Basmati rice 5kg', price: 620, unit: 'bag' },
      { id: 'p13', name: 'Garam masala 100g', price: 75, unit: 'pack' },
      { id: 'p14', name: 'Cashews 250g', price: 320, unit: 'pack' },
    ],
  },
  {
    id: 'shop-greenleaf',
    name: 'GreenLeaf Organics',
    categories: ['grocery', 'dairy'],
    rating: 4.6,
    reviewCount: 201,
    distanceKm: 3.1,
    etaMin: 50,
    openNow: true,
    tagline: 'Organic produce & cold-pressed oils',
    products: [
      { id: 'p15', name: 'Organic honey 500g', price: 285, unit: 'jar' },
      { id: 'p16', name: 'Cold-pressed mustard oil 1L', price: 195, unit: 'bottle' },
      { id: 'p17', name: 'Mixed salad box', price: 129, unit: 'box' },
    ],
  },
  {
    id: 'shop-sweetcircle',
    name: 'Sweet Circle Bakery',
    categories: ['bakery'],
    rating: 4.4,
    reviewCount: 156,
    distanceKm: 0.9,
    etaMin: 28,
    openNow: true,
    tagline: 'Cakes, cookies & festive boxes',
    products: [
      { id: 'p18', name: 'Chocolate truffle cake 500g', price: 450, unit: 'box' },
      { id: 'p19', name: 'Butter cookies 250g', price: 120, unit: 'tin' },
      { id: 'p20', name: 'Milk cake bar', price: 60, unit: 'pc' },
    ],
  },
];

export type ShopFilters = {
  query: string;
  category: ShopCategory | 'all';
  maxDistanceKm: number | null;
  minRating: number | null;
  openNowOnly: boolean;
};

export const DEFAULT_SHOP_FILTERS: ShopFilters = {
  query: '',
  category: 'all',
  maxDistanceKm: null,
  minRating: null,
  openNowOnly: false,
};

export function filterShops(shops: MockShop[], f: ShopFilters): MockShop[] {
  const q = f.query.trim().toLowerCase();
  return shops.filter((s) => {
    if (f.openNowOnly && !s.openNow) return false;
    if (f.minRating != null && s.rating < f.minRating) return false;
    if (f.maxDistanceKm != null && s.distanceKm > f.maxDistanceKm) return false;
    if (f.category !== 'all' && !s.categories.includes(f.category)) return false;
    if (q) {
      const hay = `${s.name} ${s.tagline} ${s.categories.join(' ')}`.toLowerCase();
      const productHit = s.products.some((p) => p.name.toLowerCase().includes(q));
      if (!hay.includes(q) && !productHit) return false;
    }
    return true;
  });
}

export function getShopById(id: string): MockShop | undefined {
  return MOCK_SHOPS.find((s) => s.id === id);
}
