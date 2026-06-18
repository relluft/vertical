import type { DemoOfferTable, DemoOfferTableItem } from '../types/demo'

export const kpDocumentNumber = '1-В'
export const kpVatRate = 5
export const kpValidityDays = 15

export function formatMoney(value: number, fractionDigits = 2) {
  return new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(Number.isFinite(value) ? value : 0)
}

export function formatQuantity(value: number) {
  return new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0)
}

export function parseLocalDate(dateIso: string) {
  const [year, month, day] = dateIso.split('-').map(Number)

  if (!year || !month || !day) {
    return new Date()
  }

  return new Date(year, month - 1, day)
}

export function formatDateRu(dateIso: string) {
  const date = parseLocalDate(dateIso)

  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

export function addCalendarDays(dateIso: string, days: number) {
  const date = parseLocalDate(dateIso)
  date.setDate(date.getDate() + days)

  const timezoneOffsetMs = date.getTimezoneOffset() * 60 * 1000
  return new Date(date.getTime() - timezoneOffsetMs).toISOString().slice(0, 10)
}

export function getLineSaleTotal(item: DemoOfferTableItem) {
  return (item.quantity || 0) * (item.installationUnitPrice || 0)
}

export function getOfferSaleTotal(offerTable: DemoOfferTable | null) {
  return (offerTable?.items ?? []).reduce((sum, item) => sum + getLineSaleTotal(item), 0)
}

export function getVatFromGross(total: number, vatRate = kpVatRate) {
  const safeVatRate = Number.isFinite(vatRate) ? Math.max(0, vatRate) : kpVatRate

  return total * (safeVatRate / (100 + safeVatRate))
}

export function makeKpFileName(recipientName: string, dateIso: string, documentNumber = kpDocumentNumber) {
  const numberPart = documentNumber
    .trim()
    .normalize('NFKC')
    .replace(/[\\/:*?"<>|]+/g, '')
    .replace(/[^\p{L}\p{N}-]+/gu, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 30)
  const recipientPart = recipientName
    .trim()
    .normalize('NFKC')
    .replace(/[\\/:*?"<>|]+/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 70)

  return recipientPart
    ? `КП_${numberPart || 'без_номера'}_${recipientPart}_${dateIso || 'без_даты'}.doc`
    : `КП_${numberPart || 'без_номера'}_${dateIso || 'без_даты'}.doc`
}
