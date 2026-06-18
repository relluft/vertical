import type { DemoOfferTable } from '../types/demo'
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
  makeKpFileName,
} from './kpFormatting'

interface KpDocumentPayload {
  offerTable: DemoOfferTable | null
  documentDate: string
  documentNumber: string
  recipientName: string
  validityDays?: number
  vatRate?: number
}

export interface KpDocumentProgress {
  percent: number
  message: string
}

export interface KpDocumentFileHandle {
  createWritable: () => Promise<{
    write: (data: Blob) => Promise<void>
    close: () => Promise<void>
  }>
  getFile?: () => Promise<File>
}

interface SaveFilePickerWindow extends Window {
  showSaveFilePicker?: (options: {
    suggestedName?: string
    types?: Array<{
      description: string
      accept: Record<string, string[]>
    }>
  }) => Promise<KpDocumentFileHandle>
}

interface MsSaveNavigator extends Navigator {
  msSaveOrOpenBlob?: (blob: Blob, defaultName?: string) => boolean
}

type ProgressCallback = (progress: KpDocumentProgress) => void

export interface SavedKpDocument {
  fileName: string
  usedSavePicker: boolean
  blob: Blob
  saveHandle: KpDocumentFileHandle | null
}

const wordMimeType = 'application/msword;charset=utf-8'
const kpTemplateAssets = {
  header: {
    path: '/templates/kp-header.png',
    location: 'kp-header.png',
  },
  signature: {
    path: '/templates/kp-signature.png',
    location: 'kp-signature.png',
  },
  stamp: {
    path: '/templates/kp-stamp.png',
    location: 'kp-stamp.png',
  },
} as const

type KpTemplateAssetName = keyof typeof kpTemplateAssets

interface KpTemplateAsset {
  location: string
  contentType: string
  base64: string
}

const templateAssetCache = new Map<KpTemplateAssetName, Promise<KpTemplateAsset>>()

function bytesToBase64(bytes: Uint8Array) {
  const chunkSize = 0x8000
  let binary = ''

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize))
  }

  return btoa(binary)
}

function stringToBase64(value: string) {
  return bytesToBase64(new TextEncoder().encode(value))
}

async function blobToBase64(blob: Blob) {
  return bytesToBase64(new Uint8Array(await blob.arrayBuffer()))
}

function wrapBase64(value: string) {
  return value.match(/.{1,76}/g)?.join('\r\n') ?? ''
}

function getAssetUrl(path: string) {
  if (typeof window === 'undefined') {
    return path
  }

  return new URL(path, window.location.origin).toString()
}

function loadTemplateAsset(name: KpTemplateAssetName) {
  const cached = templateAssetCache.get(name)
  const asset = kpTemplateAssets[name]

  if (cached) {
    return cached
  }

  const promise = fetch(getAssetUrl(asset.path))
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`Не удалось загрузить изображение шаблона: ${asset.path}`)
      }

      const blob = await response.blob()

      return {
        location: asset.location,
        contentType: blob.type || 'image/png',
        base64: await blobToBase64(blob),
      }
    })

  templateAssetCache.set(name, promise)

  return promise
}

async function loadKpTemplateAssets(onProgress?: ProgressCallback) {
  await reportProgress(onProgress, 48, 'Добавляем шапку, подпись и печать')

  const [header, signature, stamp] = await Promise.all([
    loadTemplateAsset('header'),
    loadTemplateAsset('signature'),
    loadTemplateAsset('stamp'),
  ])

  return {
    header,
    signature,
    stamp,
  }
}

function renderMhtmlDocument(html: string, assets: Record<KpTemplateAssetName, KpTemplateAsset>) {
  const boundary = `----=_NuOperatorKp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`
  const htmlPart = [
    `--${boundary}`,
    'Content-Type: text/html; charset="utf-8"',
    'Content-Transfer-Encoding: base64',
    'Content-Location: kp-document.html',
    '',
    wrapBase64(stringToBase64(html)),
  ].join('\r\n')
  const assetParts = Object.values(assets).map((asset) =>
    [
      `--${boundary}`,
      `Content-Type: ${asset.contentType}`,
      'Content-Transfer-Encoding: base64',
      `Content-Location: ${asset.location}`,
      '',
      wrapBase64(asset.base64),
    ].join('\r\n'),
  )

  return [
    'MIME-Version: 1.0',
    `Content-Type: multipart/related; boundary="${boundary}"; type="text/html"`,
    '',
    htmlPart,
    ...assetParts,
    `--${boundary}--`,
    '',
  ].join('\r\n')
}

function waitForUi() {
  return new Promise<void>((resolve) => window.setTimeout(resolve, 0))
}

async function reportProgress(onProgress: ProgressCallback | undefined, percent: number, message: string) {
  onProgress?.({ percent, message })
  await waitForUi()
}

function escapeHtml(value: string | number) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function makeEmptyOfferItem(): DemoOfferTable['items'][number] {
  return {
    id: 'empty',
    description: '',
    sourceNeed: '',
    productCode: '',
    unit: '',
    quantity: 0,
    unitPrice: 0,
    installationUnitPrice: 0,
    minSalePrice: 0,
    maxSalePrice: 0,
    marketBenchmark: 0,
    reviewStatus: '',
    managerComment: '',
  }
}

function renderOfferRows(offerTable: DemoOfferTable | null) {
  const items = offerTable?.items ?? []
  const rowsToRender = items.length ? items : [makeEmptyOfferItem()]

  return rowsToRender
    .map((item, index) => {
      const number = items.length ? String(index + 1) : ''
      const description = item.description || item.sourceNeed || ''
      const unitPrice = item.installationUnitPrice || 0
      const lineTotal = items.length ? getLineSaleTotal(item) : 0

      return `
        <tr>
          <td class="center">${escapeHtml(number)}</td>
          <td>${escapeHtml(description)}</td>
          <td class="center">${items.length ? escapeHtml(formatQuantity(item.quantity || 0)) : ''}</td>
          <td class="center">${escapeHtml(item.unit || 'шт')}</td>
          <td class="right">${items.length ? escapeHtml(formatMoney(unitPrice)) : ''}</td>
          <td class="right">${items.length ? escapeHtml(formatMoney(lineTotal)) : ''}</td>
        </tr>`
    })
    .join('')
}

async function generateKpDocBlob(payload: KpDocumentPayload, onProgress?: ProgressCallback) {
  await reportProgress(onProgress, 35, 'Собираем строки КП')

  const documentDate = payload.documentDate || new Date().toISOString().slice(0, 10)
  const validityDays = Number.isFinite(payload.validityDays)
    ? Math.max(1, payload.validityDays ?? kpValidityDays)
    : kpValidityDays
  const vatRate = Number.isFinite(payload.vatRate) ? Math.max(0, payload.vatRate ?? kpVatRate) : kpVatRate
  const documentNumber = payload.documentNumber.trim() || kpDocumentNumber
  const recipientName = payload.recipientName.trim()
  const total = getOfferSaleTotal(payload.offerTable)
  const rows = renderOfferRows(payload.offerTable)
  const templateAssets = await loadKpTemplateAssets(onProgress)

  await reportProgress(onProgress, 62, 'Формируем Word-документ')

  const html = `<!doctype html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">
<head>
  <meta charset="utf-8">
  <title>КП ${escapeHtml(documentNumber)}</title>
  <!--[if gte mso 9]>
  <xml>
    <w:WordDocument>
      <w:View>Print</w:View>
      <w:Zoom>100</w:Zoom>
      <w:DoNotOptimizeForBrowser/>
    </w:WordDocument>
  </xml>
  <![endif]-->
  <style>
    @page WordSection1 {
      size: 21cm 29.7cm;
      margin: 2cm 1.5cm 1.6cm 3cm;
    }
    body {
      margin: 0;
      font-family: "Times New Roman", serif;
      font-size: 11pt;
      color: #000;
    }
    .section {
      page: WordSection1;
    }
    .brand-header {
      display: block;
      width: 18.7cm;
      height: auto;
      max-width: none;
      margin: -1.1cm 0 6pt -2.15cm;
    }
    .top-meta {
      min-height: 46pt;
      text-align: right;
      line-height: 1.25;
    }
    .recipient {
      margin-top: 14pt;
      min-height: 17pt;
      text-align: right;
      font-style: italic;
      font-weight: bold;
    }
    h1 {
      margin: 22pt 0 11pt;
      text-align: center;
      font-size: 12pt;
      font-style: italic;
      font-weight: bold;
      line-height: 1.25;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      font-size: 9pt;
    }
    th,
    td {
      border: 1pt solid #000;
      padding: 4pt;
      vertical-align: top;
      line-height: 1.15;
    }
    th {
      text-align: center;
      font-weight: bold;
      vertical-align: middle;
    }
    .col-number { width: 8.8%; }
    .col-name { width: 43.9%; }
    .col-qty { width: 7.4%; }
    .col-unit { width: 6.9%; }
    .col-price { width: 14.6%; }
    .col-sum { width: 14%; }
    .center {
      text-align: center;
      vertical-align: middle;
    }
    .right {
      text-align: right;
      vertical-align: middle;
      white-space: nowrap;
    }
    .total-label,
    .total-value {
      text-align: right;
      font-weight: bold;
      vertical-align: middle;
    }
    .conditions {
      margin-top: 12pt;
      font-size: 10pt;
      font-weight: bold;
      line-height: 1.35;
      text-align: justify;
    }
    .conditions p,
    .signature p {
      margin: 0 0 6pt;
    }
    .signature {
      margin-top: 36pt;
      font-size: 11pt;
      line-height: 1.35;
      page-break-inside: avoid;
      mso-keep-together: yes;
    }
    .signature p {
      page-break-after: avoid;
      mso-keep-with-next: always;
    }
    .signature-stack {
      position: relative;
      width: 100%;
      height: 138pt;
      margin-top: 2pt;
      page-break-inside: avoid;
      font-size: 11pt;
      font-weight: bold;
      line-height: 1;
    }
    .signature-stack-role {
      position: absolute;
      left: 0;
      top: 116pt;
      white-space: nowrap;
    }
    .signature-stack-line {
      position: absolute;
      left: 182pt;
      right: 76pt;
      top: 125pt;
      border-bottom: 1pt solid #000 !important;
      height: 0;
    }
    .signature-stack-name {
      position: absolute;
      right: 0;
      top: 116pt;
      white-space: nowrap;
    }
    .signature-stack-signature {
      position: absolute;
      left: 0;
      top: 66pt;
      width: 76pt;
      height: auto;
    }
    .signature-stack-stamp {
      position: absolute;
      left: 76pt;
      top: 0;
      width: 116pt;
      height: auto;
    }
  </style>
</head>
<body>
  <div class="section">
    <img class="brand-header" src="${templateAssets.header.location}" alt="">

    <div class="top-meta">
      <div>Контактная информация:</div>
      <div>тел. +7(987)747 16 07</div>
      <div>e-mail: obelyakov888@gmail.com</div>
    </div>

    <div class="recipient">кому:${recipientName ? ` ${escapeHtml(recipientName)}` : ''}</div>

    <h1>Коммерческое предложение № ${escapeHtml(documentNumber)} от ${escapeHtml(formatDateRu(documentDate))} г</h1>

    <table>
      <colgroup>
        <col class="col-number">
        <col class="col-name">
        <col class="col-qty">
        <col class="col-unit">
        <col class="col-price">
        <col class="col-sum">
      </colgroup>
      <thead>
        <tr>
          <th>№ п/п</th>
          <th>Наименование/описание товара</th>
          <th>Кол-во</th>
          <th>Ед. изм.</th>
          <th>Цена за единицу товара, руб.</th>
          <th>Сумма, руб.</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
        <tr>
          <td class="total-label" colspan="5">ИТОГО:</td>
          <td class="total-value">${escapeHtml(formatMoney(total))}</td>
        </tr>
        <tr>
          <td class="total-label" colspan="5">В том числе НДС ${escapeHtml(vatRate)}%</td>
          <td class="total-value">${escapeHtml(formatMoney(getVatFromGross(total, vatRate)))}</td>
        </tr>
      </tbody>
    </table>

    <div class="conditions">
      <p>СТОИМОСТЬ ВКЛЮЧАЕТ ДОСТАВКУ.</p>
      <p>СРОК ДЕЙСТВИЯ КОММЕРЧЕСКОГО ПРЕДЛОЖЕНИЯ ДО ${escapeHtml(formatDateRu(addCalendarDays(documentDate, validityDays)))} г.</p>
    </div>

    <div class="signature">
      <p>С уважением,</p>
      <div class="signature-stack">
        <img class="signature-stack-signature" src="${templateAssets.signature.location}" alt="">
        <img class="signature-stack-stamp" src="${templateAssets.stamp.location}" alt="">
        <span class="signature-stack-role">Индивидуальный предприниматель</span>
        <span class="signature-stack-line"></span>
        <span class="signature-stack-name">/О.В. Беляков/</span>
      </div>
    </div>
  </div>
</body>
</html>`

  await reportProgress(onProgress, 82, 'Готовим файл DOC')

  return new Blob([renderMhtmlDocument(html, templateAssets)], { type: wordMimeType })
}

async function chooseSaveFileHandle(fileName: string) {
  const picker = (window as SaveFilePickerWindow).showSaveFilePicker

  if (!picker) {
    return null
  }

  return picker.call(window, {
    suggestedName: fileName,
    types: [
      {
        description: 'Word 97-2003 Document',
        accept: {
          'application/msword': ['.doc'],
        },
      },
    ],
  })
}

async function writeBlobThroughPicker(blob: Blob, handle: KpDocumentFileHandle) {
  const writable = await handle.createWritable()
  await writable.write(blob)
  await writable.close()
}

function downloadBlobThroughBrowser(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

export async function openSavedKpDoc(savedDocument: SavedKpDocument, onProgress?: ProgressCallback) {
  const previewWindow = window.open('', '_blank')

  if (!previewWindow) {
    throw new Error('Браузер заблокировал открытие документа. Разрешите всплывающие окна для сайта и попробуйте ещё раз.')
  }

  previewWindow.opener = null
  previewWindow.document.write(`
    <!doctype html>
    <html lang="ru">
      <head>
        <meta charset="utf-8">
        <title>Открытие ${escapeHtml(savedDocument.fileName)}</title>
      </head>
      <body style="margin:0;font-family:Arial,sans-serif;background:#f8fbff;color:#1e3a8a;">
        <div style="display:grid;min-height:100vh;place-items:center;text-align:center;">
          <div>
            <strong style="display:block;margin-bottom:8px;font-size:18px;">Открываем сохранённый DOC</strong>
            <span style="font-size:14px;">Файл будет передан Word или браузеру.</span>
          </div>
        </div>
      </body>
    </html>
  `)
  previewWindow.document.close()

  await reportProgress(onProgress, 12, 'Берём сохранённый DOC-файл')

  let docBlob: Blob = savedDocument.blob

  if (savedDocument.saveHandle?.getFile) {
    try {
      docBlob = await savedDocument.saveHandle.getFile()
    } catch {
      docBlob = savedDocument.blob
    }
  }

  await reportProgress(onProgress, 90, 'Передаём сохранённый DOC в Word')

  const saveOrOpenBlob = (navigator as MsSaveNavigator).msSaveOrOpenBlob

  if (saveOrOpenBlob) {
    saveOrOpenBlob.call(navigator, docBlob, savedDocument.fileName)
    previewWindow.close()
    await reportProgress(onProgress, 100, 'Сохранённый DOC передан в Word')

    return {
      fileName: savedDocument.fileName,
    }
  }

  const url = URL.createObjectURL(docBlob)
  const documentTitle = escapeHtml(savedDocument.fileName)
  previewWindow.document.open()
  previewWindow.document.write(`
    <!doctype html>
    <html lang="ru">
      <head>
        <meta charset="utf-8">
        <title>Открытие ${documentTitle}</title>
      </head>
      <body style="margin:0;font-family:Arial,sans-serif;background:#f8fbff;color:#1e3a8a;">
        <div style="display:grid;min-height:100vh;place-items:center;padding:24px;text-align:center;">
          <div style="max-width:440px;">
            <strong style="display:block;margin-bottom:8px;font-size:18px;">Открываем сохранённый DOC</strong>
            <p style="margin:0 0 16px;font-size:14px;line-height:1.45;">
              Если Word не открылся автоматически, нажмите кнопку ниже и откройте файл через Word.
            </p>
            <a
              id="doc-link"
              href="${url}"
              download="${documentTitle}"
              style="display:inline-flex;min-height:38px;align-items:center;border:1px solid #2563eb;border-radius:6px;background:#2563eb;color:#fff;padding:8px 14px;text-decoration:none;font-size:15px;"
            >
              Открыть DOC
            </a>
          </div>
        </div>
      </body>
    </html>
  `)
  previewWindow.document.close()
  const autoOpenFrame = previewWindow.document.createElement('iframe')
  autoOpenFrame.src = url
  autoOpenFrame.style.display = 'none'
  previewWindow.document.body.appendChild(autoOpenFrame)
  previewWindow.document.getElementById('doc-link')?.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 10 * 60_000)

  await reportProgress(onProgress, 100, 'Сохранённый DOC передан браузеру')

  return {
    fileName: savedDocument.fileName,
  }
}

export async function openKpDoc(payload: KpDocumentPayload, onProgress?: ProgressCallback) {
  const fileName = makeKpFileName(payload.recipientName, payload.documentDate, payload.documentNumber)
  const previewWindow = window.open('', '_blank')

  if (!previewWindow) {
    throw new Error('Браузер заблокировал открытие документа. Разрешите всплывающие окна для сайта и попробуйте ещё раз.')
  }

  previewWindow.opener = null
  previewWindow.document.write(`
    <!doctype html>
    <html lang="ru">
      <head>
        <meta charset="utf-8">
        <title>Открытие ${escapeHtml(fileName)}</title>
      </head>
      <body style="margin:0;font-family:Arial,sans-serif;background:#f8fbff;color:#1e3a8a;">
        <div style="display:grid;min-height:100vh;place-items:center;text-align:center;">
          <div>
            <strong style="display:block;margin-bottom:8px;font-size:18px;">Готовим документ</strong>
            <span style="font-size:14px;">Файл откроется автоматически.</span>
          </div>
        </div>
      </body>
    </html>
  `)
  previewWindow.document.close()

  onProgress?.({ percent: 8, message: 'Открываем окно предпросмотра DOC' })

  const docBlob = await generateKpDocBlob(payload, onProgress)

  await reportProgress(onProgress, 90, 'Передаём DOC в Word')

  const saveOrOpenBlob = (navigator as MsSaveNavigator).msSaveOrOpenBlob

  if (saveOrOpenBlob) {
    saveOrOpenBlob.call(navigator, docBlob, fileName)
    previewWindow.close()
    await reportProgress(onProgress, 100, 'DOC-файл передан в Word')

    return {
      fileName,
    }
  }

  const url = URL.createObjectURL(docBlob)
  const documentTitle = escapeHtml(fileName)
  previewWindow.document.open()
  previewWindow.document.write(`
    <!doctype html>
    <html lang="ru">
      <head>
        <meta charset="utf-8">
        <title>Открытие ${documentTitle}</title>
      </head>
      <body style="margin:0;font-family:Arial,sans-serif;background:#f8fbff;color:#1e3a8a;">
        <div style="display:grid;min-height:100vh;place-items:center;padding:24px;text-align:center;">
          <div style="max-width:440px;">
            <strong style="display:block;margin-bottom:8px;font-size:18px;">Открываем DOC-файл</strong>
            <p style="margin:0 0 16px;font-size:14px;line-height:1.45;">
              Если Word не открылся автоматически, нажмите кнопку ниже и откройте скачанный файл.
            </p>
            <a
              id="doc-link"
              href="${url}"
              download="${documentTitle}"
              style="display:inline-flex;min-height:38px;align-items:center;border:1px solid #2563eb;border-radius:6px;background:#2563eb;color:#fff;padding:8px 14px;text-decoration:none;font-size:15px;"
            >
              Открыть DOC
            </a>
          </div>
        </div>
      </body>
    </html>
  `)
  previewWindow.document.close()
  const autoOpenFrame = previewWindow.document.createElement('iframe')
  autoOpenFrame.src = url
  autoOpenFrame.style.display = 'none'
  previewWindow.document.body.appendChild(autoOpenFrame)
  previewWindow.document.getElementById('doc-link')?.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 10 * 60_000)

  await reportProgress(onProgress, 100, 'DOC-файл передан браузеру')

  return {
    fileName,
  }
}

export async function downloadKpDoc(payload: KpDocumentPayload, onProgress?: ProgressCallback) {
  const fileName = makeKpFileName(payload.recipientName, payload.documentDate, payload.documentNumber)
  let saveHandle: KpDocumentFileHandle | null = null

  onProgress?.({ percent: 8, message: 'Готовим выбор места сохранения' })

  try {
    saveHandle = await chooseSaveFileHandle(fileName)
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error
    }

    saveHandle = null
  }

  const blob = await generateKpDocBlob(payload, onProgress)

  await reportProgress(onProgress, 90, 'Сохраняем файл')

  if (saveHandle) {
    await writeBlobThroughPicker(blob, saveHandle)
  }

  if (!saveHandle) {
    downloadBlobThroughBrowser(blob, fileName)
  }

  await reportProgress(onProgress, 100, 'DOC-файл готов')

  return {
    fileName,
    usedSavePicker: Boolean(saveHandle),
    blob,
    saveHandle,
  }
}
