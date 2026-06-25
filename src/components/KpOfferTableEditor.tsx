import { ExternalLink, Trash2 } from 'lucide-react'
import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import type {
  DemoOfferTable,
  DraftCellAnnotation,
  DraftCellId,
  DraftField,
  OfferItemEditableField,
} from '../types/demo'
import {
  addCalendarDays,
  formatDateRu,
  formatMoney,
  formatQuantity,
  getLineSaleTotal,
  getOfferSaleTotal,
  getVatFromGross,
  kpDocumentNumber,
  kpVatRate,
  kpValidityDays,
} from '../lib/kpFormatting'
import { getEffectivePurchaseUnitPrice } from '../lib/kpPricing'
import { cn } from '../lib/utils'
import { resolveVerticalProductImageUrl, resolveVerticalProductUrl } from '../lib/verticalProducts'

const numericFields: OfferItemEditableField[] = ['quantity', 'unitPrice', 'installationUnitPrice']
const operatorWorkspaceWidth = 1340
const operatorDocumentPageWidth = 794
const operatorPanelLeft = 813
const operatorPanelMinWidth = 526
const operatorPanelRightInset = 14
const operatorPanelViewportInset = 4
const operatorPanelPreferredLift = 420
const operatorPanelMinHeight = 360
const operatorPanelExtensionGap = 4
const percentFormatter = new Intl.NumberFormat('ru-RU', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

function resolveEditableFieldCellId(itemId: string, field: OfferItemEditableField): DraftCellId {
  return `kp-item:${itemId}:${field}`
}

function getEditableDisplayValue(item: DemoOfferTable['items'][number], field: OfferItemEditableField) {
  if (field === 'quantity') {
    return item.quantity ? formatQuantity(item.quantity) : ''
  }

  if (field === 'installationUnitPrice') {
    return item.installationUnitPrice ? formatMoney(item.installationUnitPrice) : ''
  }

  if (field === 'unitPrice') {
    return item.unitPrice ? formatMoney(item.unitPrice) : ''
  }

  return String(item[field] ?? '')
}

function formatPercent(value: number) {
  return `${percentFormatter.format(Number.isFinite(value) ? value : 0)}%`
}

function getVerticalProductUrl(item: DemoOfferTable['items'][number], index: number) {
  return resolveVerticalProductUrl(item, index)
}

function getOperatorPurchaseUnitPrice(item: DemoOfferTable['items'][number]) {
  return getEffectivePurchaseUnitPrice(item)
}

interface KpOfferTableEditorProps {
  offerTable: DemoOfferTable | null
  fields: DraftField[]
  cellAnnotations: Partial<Record<DraftCellId, DraftCellAnnotation>>
  editable?: boolean
  documentDate?: string
  documentNumber?: string
  recipientName?: string
  validityDays?: number
  vatRate?: number
  showOperatorColumns?: boolean
  operatorPanel?: ReactNode
  workspaceAlign?: 'center' | 'start'
  onPagePreviewWidthChange?: (width: number) => void
  onUpdateOfferItem?: (itemId: string, field: OfferItemEditableField, value: string) => void
  onDeleteOfferItem?: (itemId: string) => void
  onAddOfferItem?: () => void
  onUpdateField?: (fieldId: DraftField['id'], value: string) => void
}

export function KpOfferTableEditor({
  offerTable,
  editable = false,
  documentDate = new Date().toISOString().slice(0, 10),
  documentNumber = kpDocumentNumber,
  recipientName = '',
  validityDays = kpValidityDays,
  vatRate = kpVatRate,
  showOperatorColumns = true,
  operatorPanel,
  workspaceAlign = 'center',
  onPagePreviewWidthChange,
  onUpdateOfferItem,
  onDeleteOfferItem,
}: KpOfferTableEditorProps) {
  const [editingCellId, setEditingCellId] = useState<DraftCellId | null>(null)
  const [editingValue, setEditingValue] = useState('')
  const [selectedOperatorItemId, setSelectedOperatorItemId] = useState<string | null>(null)
  const [workspaceScale, setWorkspaceScale] = useState(1)
  const [operatorPanelWidth, setOperatorPanelWidth] = useState(operatorPanelMinWidth)
  const [operatorPanelPlacement, setOperatorPanelPlacement] = useState({ top: -282, height: 620 })
  const workspaceStageRef = useRef<HTMLDivElement | null>(null)
  const tableHeaderRef = useRef<HTMLTableRowElement | null>(null)
  const totalRowRef = useRef<HTMLTableRowElement | null>(null)
  const itemRowRefs = useRef<Record<string, HTMLTableRowElement | null>>({})
  const [operatorRowHeights, setOperatorRowHeights] = useState<{
    header: number
    rows: Record<string, number>
    total: number
  }>({ header: 0, rows: {}, total: 0 })
  const items = useMemo(() => offerTable?.items ?? [], [offerTable?.items])
  const total = useMemo(() => getOfferSaleTotal(offerTable), [offerTable])
  const validUntil = formatDateRu(addCalendarDays(documentDate, validityDays))
  const operatorRows = useMemo(
    () =>
      items.map((item, index) => {
        const purchaseUnitPrice = getOperatorPurchaseUnitPrice(item)
        const saleUnitPrice = item.installationUnitPrice || 0
        const marginUnit = saleUnitPrice - purchaseUnitPrice
        const purchaseTotal = (item.quantity || 0) * purchaseUnitPrice
        const saleTotal = getLineSaleTotal(item)
        const margin = saleTotal - purchaseTotal
        const marginPercent = purchaseTotal > 0 ? (margin / purchaseTotal) * 100 : 0

        return {
          item,
          index,
          purchaseUnitPrice,
          purchaseTotal,
          marginUnit,
          margin,
          marginPercent,
          verticalUrl: getVerticalProductUrl(item, index),
        }
      }),
    [items],
  )
  const operatorTotals = useMemo(() => {
    const purchaseTotal = operatorRows.reduce((sum, row) => sum + row.purchaseTotal, 0)
    const margin = operatorRows.reduce((sum, row) => sum + row.margin, 0)
    const marginPercent = purchaseTotal > 0 ? (margin / purchaseTotal) * 100 : 0

    return { purchaseTotal, margin, marginPercent }
  }, [operatorRows])
  const activeOperatorItemId = selectedOperatorItemId ?? operatorRows[0]?.item.id ?? null
  const workspaceStageStyle = {
    '--operator-workspace-scale': workspaceScale,
    '--operator-panel-width': `${operatorPanelWidth}px`,
    '--operator-panel-top': `${operatorPanelPlacement.top}px`,
    '--operator-panel-height': `${operatorPanelPlacement.height}px`,
  } as CSSProperties

  useLayoutEffect(() => {
    if (typeof window === 'undefined') {
      return undefined
    }

    const updateWorkspaceScale = () => {
      const availableWidth = workspaceStageRef.current?.clientWidth || window.innerWidth
      const nextScale = Math.min(1, availableWidth / operatorWorkspaceWidth)
      const centeredWorkspaceLeft =
        workspaceAlign === 'center' && availableWidth >= operatorWorkspaceWidth
          ? (availableWidth - operatorWorkspaceWidth) / 2
          : 0
      const visiblePanelLeft = centeredWorkspaceLeft + operatorPanelLeft * nextScale
      const visiblePanelWidth = availableWidth - visiblePanelLeft - operatorPanelRightInset
      const nextPanelWidth = Math.max(operatorPanelMinWidth, visiblePanelWidth / nextScale)
      const stageTop = workspaceStageRef.current?.getBoundingClientRect().top ?? 0
      const extensionTop = workspaceStageRef.current
        ?.querySelector('.operator-extension-table')
        ?.getBoundingClientRect().top
      const visiblePanelTop = Math.max(operatorPanelViewportInset, stageTop - operatorPanelPreferredLift)
      const visiblePanelBottomLimit = extensionTop
        ? Math.min(window.innerHeight - operatorPanelViewportInset, extensionTop - operatorPanelExtensionGap)
        : window.innerHeight - operatorPanelViewportInset
      const visiblePanelBottom = Math.max(visiblePanelTop, visiblePanelBottomLimit)
      const nextPanelTop = (visiblePanelTop - stageTop) / nextScale
      const nextPanelHeight = Math.max(operatorPanelMinHeight, (visiblePanelBottom - visiblePanelTop) / nextScale)

      setWorkspaceScale((current) => (Math.abs(current - nextScale) < 0.001 ? current : nextScale))
      setOperatorPanelWidth((current) => (Math.abs(current - nextPanelWidth) < 0.5 ? current : nextPanelWidth))
      setOperatorPanelPlacement((current) =>
        Math.abs(current.top - nextPanelTop) < 0.5 && Math.abs(current.height - nextPanelHeight) < 0.5
          ? current
          : { top: nextPanelTop, height: nextPanelHeight },
      )
      onPagePreviewWidthChange?.(operatorDocumentPageWidth * nextScale)
    }

    const frameId = window.requestAnimationFrame(updateWorkspaceScale)
    const timeoutIds = [
      window.setTimeout(updateWorkspaceScale, 80),
      window.setTimeout(updateWorkspaceScale, 260),
      window.setTimeout(updateWorkspaceScale, 620),
    ]
    const resizeObserver =
      'ResizeObserver' in window && workspaceStageRef.current
        ? new ResizeObserver(updateWorkspaceScale)
        : null

    if (workspaceStageRef.current) {
      resizeObserver?.observe(workspaceStageRef.current)
    }

    window.addEventListener('resize', updateWorkspaceScale)
    window.addEventListener('scroll', updateWorkspaceScale, { passive: true })

    return () => {
      window.cancelAnimationFrame(frameId)
      timeoutIds.forEach((timeoutId) => window.clearTimeout(timeoutId))
      resizeObserver?.disconnect()
      window.removeEventListener('resize', updateWorkspaceScale)
      window.removeEventListener('scroll', updateWorkspaceScale)
    }
  }, [onPagePreviewWidthChange, workspaceAlign])

  useLayoutEffect(() => {
    if (typeof window === 'undefined') {
      return undefined
    }

    const measureRows = () => {
      const nextRows = Object.fromEntries(
        items.map((item) => [item.id, itemRowRefs.current[item.id]?.offsetHeight ?? 0]),
      )
      const nextHeader = tableHeaderRef.current?.offsetHeight ?? 0
      const nextTotal = totalRowRef.current?.offsetHeight ?? 0

      setOperatorRowHeights((current) => {
        const sameHeader = Math.abs(current.header - nextHeader) < 0.5
        const sameTotal = Math.abs(current.total - nextTotal) < 0.5
        const sameRows =
          Object.keys(nextRows).length === Object.keys(current.rows).length &&
          Object.entries(nextRows).every(([itemId, height]) => Math.abs((current.rows[itemId] ?? 0) - height) < 0.5)

        return sameHeader && sameTotal && sameRows ? current : { header: nextHeader, rows: nextRows, total: nextTotal }
      })
    }

    const frameId = window.requestAnimationFrame(measureRows)
    window.addEventListener('resize', measureRows)

    return () => {
      window.cancelAnimationFrame(frameId)
      window.removeEventListener('resize', measureRows)
    }
  }, [editingCellId, editingValue, items])

  const startEditing = (cellId: DraftCellId, value: string) => {
    if (!editable) {
      return
    }

    setEditingCellId(cellId)
    setEditingValue(value)
  }

  const stopEditing = () => {
    setEditingCellId(null)
    setEditingValue('')
  }

  const commitEditing = (commit?: (value: string) => void) => {
    commit?.(editingValue)
    stopEditing()
  }

  const renderEditableCell = ({
    item,
    field,
    multiline = false,
    align = 'left',
    placeholder = '',
  }: {
    item: DemoOfferTable['items'][number]
    field: OfferItemEditableField
    multiline?: boolean
    align?: 'left' | 'center' | 'right'
    placeholder?: string
  }) => {
    const cellId = resolveEditableFieldCellId(item.id, field)
    const isEditing = editingCellId === cellId
    const value = String(item[field] ?? '')
    const displayValue = getEditableDisplayValue(item, field)
    const numeric = numericFields.includes(field)
    const productImageUrl = field === 'description' ? resolveVerticalProductImageUrl(item) : undefined

    return (
      <td
        onClick={() => startEditing(cellId, value)}
        className={cn(
          'kp-doc-cell kp-doc-editable-cell',
          editable ? 'kp-doc-cell-interactive' : '',
          align === 'right' ? 'kp-doc-cell-right' : '',
          align === 'center' ? 'kp-doc-cell-center' : '',
          productImageUrl ? 'kp-doc-description-cell' : '',
        )}
      >
        {isEditing ? (
          multiline ? (
            <textarea
              autoFocus
              rows={3}
              value={editingValue}
              onChange={(event) => setEditingValue(event.target.value)}
              onBlur={() => commitEditing((nextValue) => onUpdateOfferItem?.(item.id, field, nextValue))}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  event.preventDefault()
                  stopEditing()
                }

                if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
                  event.preventDefault()
                  commitEditing((nextValue) => onUpdateOfferItem?.(item.id, field, nextValue))
                }
              }}
              className="kp-doc-cell-control kp-doc-cell-textarea"
            />
          ) : (
            <input
              autoFocus
              inputMode={numeric ? 'decimal' : undefined}
              value={editingValue}
              onChange={(event) => setEditingValue(event.target.value)}
              onBlur={() => commitEditing((nextValue) => onUpdateOfferItem?.(item.id, field, nextValue))}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  event.preventDefault()
                  stopEditing()
                }

                if (event.key === 'Enter') {
                  event.preventDefault()
                  commitEditing((nextValue) => onUpdateOfferItem?.(item.id, field, nextValue))
                }
              }}
              className={cn(
                'kp-doc-cell-control',
                align === 'right' ? 'kp-doc-cell-control-right' : '',
                align === 'center' ? 'kp-doc-cell-control-center' : '',
              )}
            />
          )
        ) : productImageUrl ? (
          <span className="kp-doc-product-cell">
            <img className="kp-doc-product-image" src={productImageUrl} alt={displayValue || item.productCode} />
            <span className={displayValue ? '' : 'kp-doc-placeholder'}>{displayValue || placeholder}</span>
          </span>
        ) : (
          <span className={displayValue ? '' : 'kp-doc-placeholder'}>{displayValue || placeholder}</span>
        )}
      </td>
    )
  }

  const renderOperatorPurchaseUnitCell = (row: (typeof operatorRows)[number]) => {
    const cellId = resolveEditableFieldCellId(row.item.id, 'unitPrice')
    const isEditing = editingCellId === cellId

    return (
      <div
        className={cn(
          'operator-extension-cell operator-extension-money',
          editable ? 'operator-extension-cell-interactive' : '',
        )}
        role="cell"
        onClick={() => {
          if (!isEditing) {
            startEditing(cellId, row.purchaseUnitPrice ? String(row.purchaseUnitPrice) : '')
          }
        }}
      >
        {isEditing ? (
          <input
            autoFocus
            inputMode="decimal"
            value={editingValue}
            onChange={(event) => setEditingValue(event.target.value)}
            onBlur={() => commitEditing((nextValue) => onUpdateOfferItem?.(row.item.id, 'unitPrice', nextValue))}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault()
                stopEditing()
              }

              if (event.key === 'Enter') {
                event.preventDefault()
                commitEditing((nextValue) => onUpdateOfferItem?.(row.item.id, 'unitPrice', nextValue))
              }
            }}
            className="kp-doc-cell-control kp-doc-cell-control-right operator-extension-input"
          />
        ) : (
          formatMoney(row.purchaseUnitPrice)
        )}
      </div>
    )
  }

  return (
    <div
      className={cn('word-stage', workspaceAlign === 'start' ? 'is-workspace-start' : '')}
      ref={workspaceStageRef}
      style={workspaceStageStyle}
    >
      <div className="operator-workspace">
        <article className="word-page" aria-label="Рабочий лист коммерческого предложения">
          <img className="kp-doc-brand-header" src="/templates/kp-header.png" alt="" />

          <div className="kp-doc-top-meta">
            <div>Контактная информация:</div>
            <div>тел. +7(987)747 16 07</div>
            <div>e-mail: obelyakov888@gmail.com</div>
          </div>

          <div className="kp-doc-recipient">кому:{recipientName ? ` ${recipientName}` : ''}</div>

          <h1 className="kp-doc-title">
            Коммерческое предложение № {documentNumber.trim() || kpDocumentNumber} от {formatDateRu(documentDate)} г
          </h1>

          {showOperatorColumns && operatorPanel ? (
            <aside className="operator-constructor-panel" aria-label="Рабочая область конструктора КП">
              <div className="operator-constructor-panel-scroll">{operatorPanel}</div>
            </aside>
          ) : null}

          <div className="kp-table-with-extension">
            <table className="word-table kp-offer-table">
              <colgroup>
                <col className="kp-col-number" />
                <col className="kp-col-name" />
                <col className="kp-col-qty" />
                <col className="kp-col-unit" />
                <col className="kp-col-price" />
                <col className="kp-col-sum" />
              </colgroup>
              <thead>
                <tr ref={tableHeaderRef}>
                  <th>№ п/п</th>
                  <th>Наименование/описание товара</th>
                  <th>Кол-во</th>
                  <th>Ед. изм.</th>
                  <th>Цена за единицу товара, руб.</th>
                  <th>Сумма, руб.</th>
                </tr>
              </thead>
              <tbody>
                {items.length ? (
                  items.map((item, index) => (
                    <tr
                      key={item.id}
                      ref={(node) => {
                        itemRowRefs.current[item.id] = node
                      }}
                      className={cn(
                        'kp-doc-data-row',
                        activeOperatorItemId === item.id ? 'kp-doc-data-row-active' : '',
                      )}
                      onMouseEnter={() => setSelectedOperatorItemId(item.id)}
                    >
                      <td className="kp-doc-cell kp-doc-cell-center kp-row-number-cell">
                        {onDeleteOfferItem ? (
                          <button
                            type="button"
                            className="kp-doc-row-delete-button"
                            onClick={(event) => {
                              event.stopPropagation()
                              onDeleteOfferItem(item.id)
                            }}
                            aria-label={`Удалить позицию ${index + 1} из КП`}
                            title="Удалить позицию из КП"
                          >
                            <Trash2 size={12} />
                          </button>
                        ) : null}
                        <span>{index + 1}</span>
                      </td>
                      {renderEditableCell({
                        item,
                        field: 'description',
                        multiline: true,
                        placeholder: 'Наименование товара',
                      })}
                      {renderEditableCell({
                        item,
                        field: 'quantity',
                        align: 'center',
                        placeholder: '0',
                      })}
                      {renderEditableCell({
                        item,
                        field: 'unit',
                        align: 'center',
                        placeholder: 'шт',
                      })}
                      {renderEditableCell({
                        item,
                        field: 'installationUnitPrice',
                        align: 'right',
                        placeholder: '0,00',
                      })}
                      <td className="kp-doc-cell kp-doc-cell-right">{formatMoney(getLineSaleTotal(item))}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="kp-doc-cell kp-doc-cell-center" />
                    <td className="kp-doc-cell kp-doc-placeholder">Добавьте первую позицию КП</td>
                    <td className="kp-doc-cell kp-doc-cell-center" />
                    <td className="kp-doc-cell kp-doc-cell-center" />
                    <td className="kp-doc-cell kp-doc-cell-right" />
                    <td className="kp-doc-cell kp-doc-cell-right" />
                  </tr>
                )}

                <tr ref={totalRowRef}>
                  <td className="kp-doc-cell kp-doc-total-label" colSpan={5}>
                    ИТОГО:
                  </td>
                  <td className="kp-doc-cell kp-doc-total-value">{formatMoney(total)}</td>
                </tr>
                <tr>
                  <td className="kp-doc-cell kp-doc-total-label" colSpan={5}>
                    В том числе НДС {vatRate}%
                  </td>
                  <td className="kp-doc-cell kp-doc-total-value">{formatMoney(getVatFromGross(total, vatRate))}</td>
                </tr>
              </tbody>
            </table>

            {showOperatorColumns ? (
            <div className="operator-extension-table" role="table" aria-label="Служебные колонки">
              <div
                className="operator-extension-head"
                role="row"
                style={operatorRowHeights.header ? { height: operatorRowHeights.header } : undefined}
              >
                <div className="operator-extension-head-cell" role="columnheader">
                  Цена закупки единицы товара, руб.
                </div>
                <div className="operator-extension-head-cell" role="columnheader">
                  Сумма закупки, руб.
                </div>
                <div className="operator-extension-head-cell" role="columnheader">
                  Наценка за единицу товара, руб.
                </div>
                <div className="operator-extension-head-cell" role="columnheader">
                  Сумма наценки, руб.
                </div>
                <div className="operator-extension-head-cell" role="columnheader">
                  %
                </div>
                <div className="operator-extension-head-cell" role="columnheader">
                  Ссылка
                </div>
              </div>
              <div className="operator-extension-body" role="rowgroup">
                {operatorRows.map((row) => {
                  const isSelected = activeOperatorItemId === row.item.id

                  return (
                    <div
                      key={row.item.id}
                      className={cn('operator-extension-row', isSelected ? 'is-active' : '')}
                      role="row"
                      style={
                        operatorRowHeights.rows[row.item.id]
                          ? { height: operatorRowHeights.rows[row.item.id] }
                          : undefined
                      }
                      onMouseEnter={() => setSelectedOperatorItemId(row.item.id)}
                    >
                      {renderOperatorPurchaseUnitCell(row)}
                      <div className="operator-extension-cell operator-extension-money" role="cell">
                        {formatMoney(row.purchaseTotal)}
                      </div>
                      <div className="operator-extension-cell operator-extension-money" role="cell">
                        {formatMoney(row.marginUnit)}
                      </div>
                      <div className="operator-extension-cell operator-extension-money" role="cell">
                        {formatMoney(row.margin)}
                      </div>
                      <div className="operator-extension-cell operator-extension-percent" role="cell">
                        {formatPercent(row.marginPercent)}
                      </div>
                      <div className="operator-extension-cell operator-extension-link-cell" role="cell">
                        <a
                          className="operator-extension-link"
                          href={row.verticalUrl}
                          target="_blank"
                          rel="noreferrer"
                          aria-label="Открыть товар на сайте Вертикаль"
                          title="Открыть товар на сайте Вертикаль"
                        >
                          <span>Открыть</span>
                          <ExternalLink size={11} />
                        </a>
                      </div>
                    </div>
                  )
                })}
                <div
                  className="operator-extension-row operator-extension-total-row"
                  role="row"
                  style={operatorRowHeights.total ? { height: operatorRowHeights.total } : undefined}
                >
                  <div className="operator-extension-cell" role="cell" />
                  <div className="operator-extension-cell operator-extension-money" role="cell">
                    {formatMoney(operatorTotals.purchaseTotal)}
                  </div>
                  <div className="operator-extension-cell" role="cell" />
                  <div className="operator-extension-cell operator-extension-money" role="cell">
                    {formatMoney(operatorTotals.margin)}
                  </div>
                  <div className="operator-extension-cell operator-extension-percent" role="cell">
                    {formatPercent(operatorTotals.marginPercent)}
                  </div>
                  <div className="operator-extension-cell" role="cell" />
                </div>
              </div>
            </div>
            ) : null}
          </div>

          <div className="kp-doc-conditions">
            <p>СТОИМОСТЬ ВКЛЮЧАЕТ ДОСТАВКУ.</p>
            <p>СРОК ДЕЙСТВИЯ КОММЕРЧЕСКОГО ПРЕДЛОЖЕНИЯ ДО {validUntil} г.</p>
          </div>

          <div className="kp-doc-signature">
            <p>С уважением,</p>
            <div className="kp-doc-signature-stack">
              <img className="kp-doc-signature-stack-signature" src="/templates/kp-signature.png" alt="" />
              <img className="kp-doc-signature-stack-stamp" src="/templates/kp-stamp.png" alt="" />
              <span className="kp-doc-signature-stack-role">Индивидуальный предприниматель</span>
              <span className="kp-doc-signature-stack-line" />
              <span className="kp-doc-signature-stack-name">/О.В. Беляков/</span>
            </div>
          </div>
        </article>

      </div>
    </div>
  )
}
