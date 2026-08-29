import {
  Storefront,
  Restaurant,
  PhoneAndroid,
  LocalPharmacy,
  Checkroom,
  Construction,
  ContentCut,
  MenuBook,
  DirectionsCar,
  BakeryDining,
  SetMeal,
  Hotel,
  Warehouse,
  LocalGasStation,
  DevicesOther,
  MoreHoriz,
  type SvgIconComponent,
} from '@mui/icons-material'

export interface BusinessCategory {
  value: string
  label: string
  description: string
  icon: SvgIconComponent
}

/** Curated presets shown on the landing page and registration form — not an
 * exhaustive/enforced list (the backend stores whatever string is submitted, including
 * a custom "Other" value), just a fast start so this POS visibly supports any kind of
 * business rather than looking grocery-only. */
export const BUSINESS_CATEGORIES: BusinessCategory[] = [
  { value: 'Retail & Grocery', label: 'Retail & Grocery', description: 'Minimarts, general stores, supermarkets', icon: Storefront },
  { value: 'Restaurant & Bar', label: 'Restaurant & Bar', description: 'Cafes, restaurants, bars, fast food', icon: Restaurant },
  { value: 'Electronics & Phones', label: 'Electronics & Phones', description: 'Gadgets, accessories, repairs', icon: PhoneAndroid },
  { value: 'Pharmacy & Health', label: 'Pharmacy & Health', description: 'Pharmacies, clinics, wellness shops', icon: LocalPharmacy },
  { value: 'Fashion & Boutique', label: 'Fashion & Boutique', description: 'Clothing, shoes, accessories', icon: Checkroom },
  { value: 'Hardware & Construction', label: 'Hardware & Construction', description: 'Building materials, tools', icon: Construction },
  { value: 'Salon & Spa', label: 'Salon & Spa', description: 'Hair, beauty, barbershops', icon: ContentCut },
  { value: 'Bookstore & Stationery', label: 'Bookstore & Stationery', description: 'Books, office and school supplies', icon: MenuBook },
  { value: 'Auto Parts & Garage', label: 'Auto Parts & Garage', description: 'Spare parts, repair shops', icon: DirectionsCar },
  { value: 'Bakery & Confectionery', label: 'Bakery & Confectionery', description: 'Bread, cakes, pastries', icon: BakeryDining },
  { value: 'Butchery & Fresh Foods', label: 'Butchery & Fresh Foods', description: 'Meat, fish, produce', icon: SetMeal },
  { value: 'Hotel & Guesthouse', label: 'Hotel & Guesthouse', description: 'Lodging, hospitality', icon: Hotel },
  { value: 'Wholesale & Distribution', label: 'Wholesale & Distribution', description: 'Bulk supply, B2B trading', icon: Warehouse },
  { value: 'Fuel Station', label: 'Fuel Station', description: 'Petrol stations, convenience shops', icon: LocalGasStation },
  { value: 'Services & Other Trades', label: 'Services & Other Trades', description: 'Repairs, workshops, general services', icon: DevicesOther },
  { value: 'Other', label: 'Other', description: 'Any other kind of business', icon: MoreHoriz },
]
