import JSZip from 'jszip'
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

const docxMimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
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

const pageWidthTwips = 11906
const pageHeightTwips = 16838
const pageMarginTopTwips = 1134
const pageMarginRightTwips = 850
const pageMarginBottomTwips = 907
const pageMarginLeftTwips = 1701
const contentWidthTwips = pageWidthTwips - pageMarginLeftTwips - pageMarginRightTwips
const offerTableColumnsTwips = [861, 4288, 725, 675, 1427, 1363]

type KpTemplateAssetName = keyof typeof kpTemplateAssets
type ParagraphAlign = 'left' | 'center' | 'right' | 'both'
type VerticalAlign = 'top' | 'center' | 'bottom'

interface KpTemplateAsset {
  location: string
  base64: string
}

interface RunOptions {
  bold?: boolean
  italic?: boolean
  size?: number
  noProof?: boolean
}

interface ParagraphOptions extends RunOptions {
  align?: ParagraphAlign
  before?: number
  after?: number
  keepNext?: boolean
  keepLines?: boolean
  pageBreakBefore?: boolean
}

interface TableCellOptions {
  width: number
  gridSpan?: number
  verticalAlign?: VerticalAlign
  noWrap?: boolean
  noBorders?: boolean
}

interface DocxPayloadData {
  offerTable: DemoOfferTable | null
  documentDate: string
  documentNumber: string
  recipientName: string
  validityDays: number
  vatRate: number
  total: number
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

async function blobToBase64(blob: Blob) {
  return bytesToBase64(new Uint8Array(await blob.arrayBuffer()))
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

      return {
        location: asset.location,
        base64: await blobToBase64(await response.blob()),
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

function waitForUi() {
  return new Promise<void>((resolve) => window.setTimeout(resolve, 0))
}

async function reportProgress(onProgress: ProgressCallback | undefined, percent: number, message: string) {
  onProgress?.({ percent, message })
  await waitForUi()
}

function escapeXml(value: string | number) {
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

function twipsToEmu(value: number) {
  return Math.round(value * 635)
}

function imageHeightFromAspect(widthTwips: number, pixelWidth: number, pixelHeight: number) {
  return Math.round(widthTwips * (pixelHeight / pixelWidth))
}

function runProperties(options: RunOptions = {}) {
  const size = options.size ?? 22

  return [
    '<w:rPr>',
    '<w:rFonts w:ascii="Times New Roman" w:eastAsia="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>',
    options.bold ? '<w:b/><w:bCs/>' : '',
    options.italic ? '<w:i/><w:iCs/>' : '',
    options.noProof ? '<w:noProof/>' : '',
    `<w:sz w:val="${size}"/><w:szCs w:val="${size}"/>`,
    '<w:color w:val="000000"/>',
    '</w:rPr>',
  ].join('')
}

function textRun(value: string | number, options: RunOptions = {}) {
  const parts = String(value).split('\n')
  const text = parts
    .map((part, index) => `${index ? '<w:br/>' : ''}<w:t xml:space="preserve">${escapeXml(part)}</w:t>`)
    .join('')

  return `<w:r>${runProperties(options)}${text}</w:r>`
}

function imageRun(relationshipId: string, name: string, widthTwips: number, heightTwips: number, docPrId: number) {
  const cx = twipsToEmu(widthTwips)
  const cy = twipsToEmu(heightTwips)
  const title = escapeXml(name)

  return `
    <w:r>
      ${runProperties({ noProof: true })}
      <w:drawing>
        <wp:inline distT="0" distB="0" distL="0" distR="0">
          <wp:extent cx="${cx}" cy="${cy}"/>
          <wp:effectExtent l="0" t="0" r="0" b="0"/>
          <wp:docPr id="${docPrId}" name="${title}"/>
          <wp:cNvGraphicFramePr>
            <a:graphicFrameLocks noChangeAspect="1"/>
          </wp:cNvGraphicFramePr>
          <a:graphic>
            <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
              <pic:pic>
                <pic:nvPicPr>
                  <pic:cNvPr id="${docPrId}" name="${title}"/>
                  <pic:cNvPicPr>
                    <a:picLocks noChangeAspect="1"/>
                  </pic:cNvPicPr>
                </pic:nvPicPr>
                <pic:blipFill>
                  <a:blip r:embed="${relationshipId}" cstate="print"/>
                  <a:stretch>
                    <a:fillRect/>
                  </a:stretch>
                </pic:blipFill>
                <pic:spPr>
                  <a:xfrm>
                    <a:off x="0" y="0"/>
                    <a:ext cx="${cx}" cy="${cy}"/>
                  </a:xfrm>
                  <a:prstGeom prst="rect">
                    <a:avLst/>
                  </a:prstGeom>
                </pic:spPr>
              </pic:pic>
            </a:graphicData>
          </a:graphic>
        </wp:inline>
      </w:drawing>
    </w:r>`
}

function paragraph(content: string, options: ParagraphOptions = {}) {
  const paragraphProperties = [
    options.align ? `<w:jc w:val="${options.align}"/>` : '',
    options.before !== undefined || options.after !== undefined
      ? `<w:spacing w:before="${options.before ?? 0}" w:after="${options.after ?? 0}"/>`
      : '',
    options.keepNext ? '<w:keepNext/>' : '',
    options.keepLines ? '<w:keepLines/>' : '',
    options.pageBreakBefore ? '<w:pageBreakBefore/>' : '',
    runProperties(options),
  ].join('')

  return `<w:p><w:pPr>${paragraphProperties}</w:pPr>${content}</w:p>`
}

function textParagraph(value: string | number, options: ParagraphOptions = {}) {
  return paragraph(textRun(value, options), options)
}

function tableBorders() {
  return `
    <w:tblBorders>
      <w:top w:val="single" w:sz="8" w:space="0" w:color="000000"/>
      <w:left w:val="single" w:sz="8" w:space="0" w:color="000000"/>
      <w:bottom w:val="single" w:sz="8" w:space="0" w:color="000000"/>
      <w:right w:val="single" w:sz="8" w:space="0" w:color="000000"/>
      <w:insideH w:val="single" w:sz="8" w:space="0" w:color="000000"/>
      <w:insideV w:val="single" w:sz="8" w:space="0" w:color="000000"/>
    </w:tblBorders>`
}

function noCellBorders() {
  return `
    <w:tcBorders>
      <w:top w:val="nil"/>
      <w:left w:val="nil"/>
      <w:bottom w:val="nil"/>
      <w:right w:val="nil"/>
    </w:tcBorders>`
}

function tableCell(content: string, options: TableCellOptions) {
  return `
    <w:tc>
      <w:tcPr>
        <w:tcW w:w="${options.width}" w:type="dxa"/>
        ${options.gridSpan ? `<w:gridSpan w:val="${options.gridSpan}"/>` : ''}
        ${options.noWrap ? '<w:noWrap/>' : ''}
        <w:vAlign w:val="${options.verticalAlign ?? 'top'}"/>
        ${options.noBorders ? noCellBorders() : ''}
      </w:tcPr>
      ${content}
    </w:tc>`
}

function tableRow(cells: string, cantSplit = false) {
  return `<w:tr>${cantSplit ? '<w:trPr><w:cantSplit/></w:trPr>' : ''}${cells}</w:tr>`
}

function renderTable(columns: number[], rows: string, borders = true) {
  const width = columns.reduce((sum, value) => sum + value, 0)

  return `
    <w:tbl>
      <w:tblPr>
        <w:tblW w:w="${width}" w:type="dxa"/>
        <w:tblLayout w:type="fixed"/>
        ${borders ? tableBorders() : ''}
        <w:tblCellMar>
          <w:top w:w="70" w:type="dxa"/>
          <w:left w:w="70" w:type="dxa"/>
          <w:bottom w:w="70" w:type="dxa"/>
          <w:right w:w="70" w:type="dxa"/>
        </w:tblCellMar>
      </w:tblPr>
      <w:tblGrid>
        ${columns.map((widthTwips) => `<w:gridCol w:w="${widthTwips}"/>`).join('')}
      </w:tblGrid>
      ${rows}
    </w:tbl>`
}

function headerCell(text: string, width: number) {
  return tableCell(textParagraph(text, { align: 'center', bold: true, size: 18, after: 0 }), {
    width,
    verticalAlign: 'center',
  })
}

function dataCell(text: string | number, width: number, align: ParagraphAlign = 'left') {
  return tableCell(textParagraph(text, { align, size: 18, after: 0 }), {
    width,
    verticalAlign: 'center',
  })
}

function renderOfferTable(data: DocxPayloadData) {
  const items = data.offerTable?.items ?? []
  const rowsToRender = items.length ? items : [makeEmptyOfferItem()]
  const headerRow = tableRow(
    [
      headerCell('№\nп/п', offerTableColumnsTwips[0]),
      headerCell('Наименование/описание товара', offerTableColumnsTwips[1]),
      headerCell('Кол-\nво', offerTableColumnsTwips[2]),
      headerCell('Ед. изм.', offerTableColumnsTwips[3]),
      headerCell('Цена за единицу товара, руб.', offerTableColumnsTwips[4]),
      headerCell('Сумма, руб.', offerTableColumnsTwips[5]),
    ].join(''),
    true,
  )
  const itemRows = rowsToRender
    .map((item, index) => {
      const number = items.length ? String(index + 1) : ''
      const description = item.description || item.sourceNeed || ''
      const unitPrice = item.installationUnitPrice || 0
      const lineTotal = items.length ? getLineSaleTotal(item) : 0

      return tableRow(
        [
          dataCell(number, offerTableColumnsTwips[0], 'center'),
          dataCell(description, offerTableColumnsTwips[1]),
          dataCell(items.length ? formatQuantity(item.quantity || 0) : '', offerTableColumnsTwips[2], 'center'),
          dataCell(item.unit || 'шт', offerTableColumnsTwips[3], 'center'),
          dataCell(items.length ? formatMoney(unitPrice) : '', offerTableColumnsTwips[4], 'right'),
          dataCell(items.length ? formatMoney(lineTotal) : '', offerTableColumnsTwips[5], 'right'),
        ].join(''),
      )
    })
    .join('')
  const totalLabelWidth = offerTableColumnsTwips.slice(0, 5).reduce((sum, width) => sum + width, 0)
  const totalRows = [
    tableRow(
      [
        tableCell(textParagraph('ИТОГО:', { align: 'right', bold: true, size: 20, after: 0 }), {
          width: totalLabelWidth,
          gridSpan: 5,
          verticalAlign: 'center',
        }),
        tableCell(textParagraph(formatMoney(data.total), { align: 'right', bold: true, size: 20, after: 0 }), {
          width: offerTableColumnsTwips[5],
          verticalAlign: 'center',
        }),
      ].join(''),
      true,
    ),
    tableRow(
      [
        tableCell(textParagraph(`В том числе НДС ${data.vatRate}%`, { align: 'right', bold: true, size: 20, after: 0 }), {
          width: totalLabelWidth,
          gridSpan: 5,
          verticalAlign: 'center',
        }),
        tableCell(textParagraph(formatMoney(getVatFromGross(data.total, data.vatRate)), { align: 'right', bold: true, size: 20, after: 0 }), {
          width: offerTableColumnsTwips[5],
          verticalAlign: 'center',
        }),
      ].join(''),
      true,
    ),
  ].join('')

  return renderTable(offerTableColumnsTwips, `${headerRow}${itemRows}${totalRows}`)
}

function renderSignatureBlock(assets: Record<KpTemplateAssetName, KpTemplateAsset>) {
  const signatureWidthTwips = 950
  const stampWidthTwips = 1780
  const signatureHeightTwips = imageHeightFromAspect(signatureWidthTwips, 214, 149)
  const stampHeightTwips = imageHeightFromAspect(stampWidthTwips, 350, 353)
  const imageParagraph = paragraph(
    `${imageRun('rIdSignature', assets.signature.location, signatureWidthTwips, signatureHeightTwips, 2)}${imageRun('rIdStamp', assets.stamp.location, stampWidthTwips, stampHeightTwips, 3)}`,
    { align: 'center', after: 0, keepLines: true },
  )
  const roleParagraph = textParagraph('Индивидуальный предприниматель', {
    align: 'center',
    bold: true,
    size: 22,
    after: 80,
    keepLines: true,
  })
  const nameParagraph = textParagraph('________________________ /О.В. Беляков/', {
    align: 'center',
    bold: true,
    size: 22,
    after: 0,
    keepLines: true,
  })
  const columns = [3600, contentWidthTwips - 3600]
  const rows = [
    tableRow(
      tableCell(textParagraph('С уважением,', { size: 22, after: 120, keepNext: true }), {
        width: contentWidthTwips,
        gridSpan: 2,
        noBorders: true,
      }),
      true,
    ),
    tableRow(
      [
        tableCell(imageParagraph, {
          width: columns[0],
          verticalAlign: 'center',
          noBorders: true,
        }),
        tableCell(`${roleParagraph}${nameParagraph}`, {
          width: columns[1],
          verticalAlign: 'center',
          noBorders: true,
        }),
      ].join(''),
      true,
    ),
  ].join('')

  return renderTable(columns, rows, false)
}

function renderDocumentXml(data: DocxPayloadData, assets: Record<KpTemplateAssetName, KpTemplateAsset>) {
  const headerWidthTwips = 8200
  const headerHeightTwips = imageHeightFromAspect(headerWidthTwips, 596, 158)
  const validUntil = formatDateRu(addCalendarDays(data.documentDate, data.validityDays))

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas"
  xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
  xmlns:o="urn:schemas-microsoft-com:office:office"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
  xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"
  xmlns:v="urn:schemas-microsoft-com:vml"
  xmlns:wp14="http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing"
  xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
  xmlns:w10="urn:schemas-microsoft-com:office:word"
  xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
  xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml"
  xmlns:w15="http://schemas.microsoft.com/office/word/2012/wordml"
  xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup"
  xmlns:wpi="http://schemas.microsoft.com/office/word/2010/wordprocessingInk"
  xmlns:wne="http://schemas.microsoft.com/office/word/2006/wordml"
  xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape"
  xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
  xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"
  mc:Ignorable="w14 w15 wp14">
  <w:body>
    ${paragraph(imageRun('rIdHeader', assets.header.location, headerWidthTwips, headerHeightTwips, 1), {
      align: 'center',
      after: 120,
      keepNext: true,
    })}
    ${textParagraph('Контактная информация:\nтел. +7(987)747 16 07\ne-mail: obelyakov888@gmail.com', {
      align: 'right',
      size: 22,
      after: 220,
      keepNext: true,
    })}
    ${textParagraph(`кому:${data.recipientName ? ` ${data.recipientName}` : ''}`, {
      align: 'right',
      bold: true,
      italic: true,
      size: 22,
      after: 300,
      keepNext: true,
    })}
    ${textParagraph(`Коммерческое предложение № ${data.documentNumber} от ${formatDateRu(data.documentDate)} г`, {
      align: 'center',
      bold: true,
      italic: true,
      size: 24,
      after: 180,
      keepNext: true,
    })}
    ${renderOfferTable(data)}
    ${textParagraph('СТОИМОСТЬ ВКЛЮЧАЕТ ДОСТАВКУ.', {
      bold: true,
      size: 22,
      before: 260,
      after: 120,
      keepLines: true,
    })}
    ${textParagraph(`СРОК ДЕЙСТВИЯ КОММЕРЧЕСКОГО ПРЕДЛОЖЕНИЯ ДО ${validUntil} г.`, {
      bold: true,
      size: 22,
      after: 520,
      keepLines: true,
    })}
    ${renderSignatureBlock(assets)}
    <w:sectPr>
      <w:pgSz w:w="${pageWidthTwips}" w:h="${pageHeightTwips}"/>
      <w:pgMar w:top="${pageMarginTopTwips}" w:right="${pageMarginRightTwips}" w:bottom="${pageMarginBottomTwips}" w:left="${pageMarginLeftTwips}" w:header="708" w:footer="708" w:gutter="0"/>
      <w:cols w:space="708"/>
      <w:docGrid w:linePitch="360"/>
    </w:sectPr>
  </w:body>
</w:document>`
}

function renderContentTypesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="png" ContentType="image/png"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`
}

function renderPackageRelationshipsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`
}

function renderDocumentRelationshipsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rIdHeader" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/kp-header.png"/>
  <Relationship Id="rIdSignature" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/kp-signature.png"/>
  <Relationship Id="rIdStamp" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/kp-stamp.png"/>
  <Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
  <Relationship Id="rIdSettings" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>
</Relationships>`
}

function renderStylesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault>
      <w:rPr>
        <w:rFonts w:ascii="Times New Roman" w:eastAsia="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>
        <w:sz w:val="22"/>
        <w:szCs w:val="22"/>
        <w:color w:val="000000"/>
      </w:rPr>
    </w:rPrDefault>
    <w:pPrDefault>
      <w:pPr>
        <w:spacing w:after="0"/>
      </w:pPr>
    </w:pPrDefault>
  </w:docDefaults>
</w:styles>`
}

function renderSettingsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:zoom w:percent="100"/>
  <w:defaultTabStop w:val="708"/>
  <w:compat>
    <w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/>
  </w:compat>
</w:settings>`
}

function renderCorePropertiesXml() {
  const now = new Date().toISOString()

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties"
  xmlns:dc="http://purl.org/dc/elements/1.1/"
  xmlns:dcterms="http://purl.org/dc/terms/"
  xmlns:dcmitype="http://purl.org/dc/dcmitype/"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>Коммерческое предложение</dc:title>
  <dc:creator>Вертикаль КП</dc:creator>
  <cp:lastModifiedBy>Вертикаль КП</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified>
</cp:coreProperties>`
}

function renderAppPropertiesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"
  xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>Вертикаль КП</Application>
</Properties>`
}

async function renderDocxBlob(data: DocxPayloadData, assets: Record<KpTemplateAssetName, KpTemplateAsset>) {
  const zip = new JSZip()

  zip.file('[Content_Types].xml', renderContentTypesXml())
  zip.file('_rels/.rels', renderPackageRelationshipsXml())
  zip.file('word/document.xml', renderDocumentXml(data, assets))
  zip.file('word/_rels/document.xml.rels', renderDocumentRelationshipsXml())
  zip.file('word/styles.xml', renderStylesXml())
  zip.file('word/settings.xml', renderSettingsXml())
  zip.file('docProps/core.xml', renderCorePropertiesXml())
  zip.file('docProps/app.xml', renderAppPropertiesXml())
  zip.file('word/media/kp-header.png', assets.header.base64, { base64: true })
  zip.file('word/media/kp-signature.png', assets.signature.base64, { base64: true })
  zip.file('word/media/kp-stamp.png', assets.stamp.base64, { base64: true })

  return zip.generateAsync({
    type: 'blob',
    mimeType: docxMimeType,
    compression: 'DEFLATE',
  })
}

async function generateKpDocBlob(payload: KpDocumentPayload, onProgress?: ProgressCallback) {
  await reportProgress(onProgress, 35, 'Собираем строки КП')

  const documentDate = payload.documentDate || new Date().toISOString().slice(0, 10)
  const validityDays = Number.isFinite(payload.validityDays)
    ? Math.max(1, payload.validityDays ?? kpValidityDays)
    : kpValidityDays
  const vatRate = Number.isFinite(payload.vatRate) ? Math.max(0, payload.vatRate ?? kpVatRate) : kpVatRate
  const data: DocxPayloadData = {
    offerTable: payload.offerTable,
    documentDate,
    documentNumber: payload.documentNumber.trim() || kpDocumentNumber,
    recipientName: payload.recipientName.trim(),
    validityDays,
    vatRate,
    total: getOfferSaleTotal(payload.offerTable),
  }
  const templateAssets = await loadKpTemplateAssets(onProgress)

  await reportProgress(onProgress, 62, 'Формируем Word-документ')
  const blob = await renderDocxBlob(data, templateAssets)
  await reportProgress(onProgress, 82, 'Готовим файл DOCX')

  return blob
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
        description: 'Word Document',
        accept: {
          [docxMimeType]: ['.docx'],
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
        <title>Открытие ${escapeXml(savedDocument.fileName)}</title>
      </head>
      <body style="margin:0;font-family:Arial,sans-serif;background:#f8fbff;color:#1e3a8a;">
        <div style="display:grid;min-height:100vh;place-items:center;text-align:center;">
          <div>
            <strong style="display:block;margin-bottom:8px;font-size:18px;">Открываем сохранённый Word-файл</strong>
            <span style="font-size:14px;">Файл будет передан Word или браузеру.</span>
          </div>
        </div>
      </body>
    </html>
  `)
  previewWindow.document.close()

  await reportProgress(onProgress, 12, 'Берём сохранённый Word-файл')

  let docBlob: Blob = savedDocument.blob

  if (savedDocument.saveHandle?.getFile) {
    try {
      docBlob = await savedDocument.saveHandle.getFile()
    } catch {
      docBlob = savedDocument.blob
    }
  }

  await reportProgress(onProgress, 90, 'Передаём Word-файл')

  const saveOrOpenBlob = (navigator as MsSaveNavigator).msSaveOrOpenBlob

  if (saveOrOpenBlob) {
    saveOrOpenBlob.call(navigator, docBlob, savedDocument.fileName)
    previewWindow.close()
    await reportProgress(onProgress, 100, 'Word-файл передан')

    return {
      fileName: savedDocument.fileName,
    }
  }

  const url = URL.createObjectURL(docBlob)
  const documentTitle = escapeXml(savedDocument.fileName)
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
            <strong style="display:block;margin-bottom:8px;font-size:18px;">Открываем сохранённый Word-файл</strong>
            <p style="margin:0 0 16px;font-size:14px;line-height:1.45;">
              Если Word не открылся автоматически, нажмите кнопку ниже и откройте файл через Word.
            </p>
            <a
              id="doc-link"
              href="${url}"
              download="${documentTitle}"
              style="display:inline-flex;min-height:38px;align-items:center;border:1px solid #2563eb;border-radius:6px;background:#2563eb;color:#fff;padding:8px 14px;text-decoration:none;font-size:15px;"
            >
              Открыть Word
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

  await reportProgress(onProgress, 100, 'Word-файл передан браузеру')

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
        <title>Открытие ${escapeXml(fileName)}</title>
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

  onProgress?.({ percent: 8, message: 'Открываем окно предпросмотра Word-файла' })

  const docBlob = await generateKpDocBlob(payload, onProgress)

  await reportProgress(onProgress, 90, 'Передаём Word-файл')

  const saveOrOpenBlob = (navigator as MsSaveNavigator).msSaveOrOpenBlob

  if (saveOrOpenBlob) {
    saveOrOpenBlob.call(navigator, docBlob, fileName)
    previewWindow.close()
    await reportProgress(onProgress, 100, 'Word-файл передан')

    return {
      fileName,
    }
  }

  const url = URL.createObjectURL(docBlob)
  const documentTitle = escapeXml(fileName)
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
            <strong style="display:block;margin-bottom:8px;font-size:18px;">Открываем Word-файл</strong>
            <p style="margin:0 0 16px;font-size:14px;line-height:1.45;">
              Если Word не открылся автоматически, нажмите кнопку ниже и откройте скачанный файл.
            </p>
            <a
              id="doc-link"
              href="${url}"
              download="${documentTitle}"
              style="display:inline-flex;min-height:38px;align-items:center;border:1px solid #2563eb;border-radius:6px;background:#2563eb;color:#fff;padding:8px 14px;text-decoration:none;font-size:15px;"
            >
              Открыть Word
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

  await reportProgress(onProgress, 100, 'Word-файл передан браузеру')

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

  await reportProgress(onProgress, 100, 'Word-файл готов')

  return {
    fileName,
    usedSavePicker: Boolean(saveHandle),
    blob,
    saveHandle,
  }
}
