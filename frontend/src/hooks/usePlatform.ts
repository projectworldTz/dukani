import { useAuthStore } from '../stores/authStore'

/**
 * Which product the signed-in business is using. Pharmacy & Health businesses get the
 * pharmacy platform (medicines, batches & expiry, prescriptions, controlled drugs);
 * everyone else gets the general POS.
 */
export function usePlatform() {
  const platform = useAuthStore((s) => s.user?.business?.platform ?? 'general')
  const isPharmacy = platform === 'pharmacy'
  const isButchery = platform === 'butchery'

  return {
    platform,
    isPharmacy,
    isButchery,
    /** Words that change between platforms, so screens read naturally for each trade. */
    terms: isPharmacy
      ? { product: 'medicine', products: 'Medicines', productsPath: '/medicines', sell: 'Dispense', brand: 'Pharmacy' }
      : isButchery
        ? { product: 'product', products: 'Products', productsPath: '/products', sell: 'Sell', brand: 'Butchery' }
        : { product: 'product', products: 'Products', productsPath: '/products', sell: 'Sell', brand: 'POS' },
  }
}
