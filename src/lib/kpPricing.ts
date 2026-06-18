import type { DemoOfferTableItem } from '../types/demo'

export const purchaseToSaleRatio = 0.76
const legacyKpPriceRevision = 'kp-sale-90-purchase-75-v1'
export const kpPriceRevision = 'kp-sale-90-markup-35-70-v2'
export const salePriceAdjustmentRatio = 0.9
export const minMarkupPercent = 35
export const maxMarkupPercent = 70

export function roundMoneyAmount(value: number) {
  return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100
}

export function getSaleUnitPriceFromPurchase(purchaseUnitPrice: number) {
  const safePurchaseUnitPrice = Number.isFinite(purchaseUnitPrice) ? Math.max(0, purchaseUnitPrice) : 0

  return safePurchaseUnitPrice > 0 ? roundMoneyAmount(safePurchaseUnitPrice / purchaseToSaleRatio) : 0
}

export function getPurchaseUnitPriceFromSale(saleUnitPrice: number) {
  const safeSaleUnitPrice = Number.isFinite(saleUnitPrice) ? Math.max(0, saleUnitPrice) : 0

  return safeSaleUnitPrice > 0 ? roundMoneyAmount(safeSaleUnitPrice * purchaseToSaleRatio) : 0
}

export function getEffectivePurchaseUnitPrice(
  item: Pick<DemoOfferTableItem, 'unitPrice' | 'installationUnitPrice'>,
) {
  const saleUnitPrice = Number.isFinite(item.installationUnitPrice)
    ? Math.max(0, item.installationUnitPrice)
    : 0
  const purchaseUnitPrice = Number.isFinite(item.unitPrice) ? Math.max(0, item.unitPrice) : 0

  if (purchaseUnitPrice > 0 && (!saleUnitPrice || purchaseUnitPrice < saleUnitPrice)) {
    return purchaseUnitPrice
  }

  return getPurchaseUnitPriceFromSale(saleUnitPrice)
}

function hashString(value: string) {
  return Array.from(value).reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) >>> 0, 7)
}

export function getTargetMarkupPercent(item: Pick<DemoOfferTableItem, 'id' | 'productCode' | 'description'>) {
  const spread = maxMarkupPercent - minMarkupPercent + 1
  const seed = item.productCode || item.id || item.description

  return minMarkupPercent + (hashString(seed) % spread)
}

function getPurchaseUnitPriceForMarkup(saleUnitPrice: number, markupPercent: number) {
  const safeSaleUnitPrice = Number.isFinite(saleUnitPrice) ? Math.max(0, saleUnitPrice) : 0
  const safeMarkupPercent = Number.isFinite(markupPercent)
    ? Math.min(maxMarkupPercent, Math.max(minMarkupPercent, markupPercent))
    : minMarkupPercent

  return safeSaleUnitPrice > 0 ? roundMoneyAmount(safeSaleUnitPrice / (1 + safeMarkupPercent / 100)) : 0
}

export function applyKpPriceAdjustments<T extends DemoOfferTableItem>(item: T): T {
  if (item.pricingRevision === kpPriceRevision) {
    return item
  }

  const saleMultiplier = item.pricingRevision === legacyKpPriceRevision ? 1 : salePriceAdjustmentRatio
  const saleUnitPrice = roundMoneyAmount((item.installationUnitPrice || 0) * saleMultiplier)
  const purchaseUnitPrice = getPurchaseUnitPriceForMarkup(saleUnitPrice, getTargetMarkupPercent(item))

  return {
    ...item,
    unitPrice: purchaseUnitPrice,
    installationUnitPrice: saleUnitPrice,
    minSalePrice: roundMoneyAmount((item.minSalePrice || 0) * salePriceAdjustmentRatio),
    maxSalePrice: roundMoneyAmount((item.maxSalePrice || 0) * salePriceAdjustmentRatio),
    marketBenchmark: roundMoneyAmount((item.marketBenchmark || 0) * salePriceAdjustmentRatio),
    pricingRevision: kpPriceRevision,
  }
}
