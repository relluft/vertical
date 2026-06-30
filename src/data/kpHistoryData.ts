import type { CrmState, ProductVariant, Supplier, SupplierProduct } from '../crm/types'
import { addCalendarDays, getOfferSaleTotal, kpValidityDays, kpVatRate } from '../lib/kpFormatting'
import { kpPriceRevision, roundMoneyAmount } from '../lib/kpPricing'
import { resolveVerticalProductUrl } from '../lib/verticalProducts'
import type { DemoOfferTable, DemoOfferTableItem } from '../types/demo'
import { recalculateOfferTable } from './demoData'

export interface KpHistoryEntry {
  id: string
  title?: string
  number: string
  date: string
  customer: string
  total: number
  source: string
  status?: string
  objectName?: string
  itemsCount?: number
  recipientName?: string
  validUntil?: string
  validityDays?: number
  vatRate?: number
  offerTable?: DemoOfferTable | null
}

interface CatalogOption {
  variant: ProductVariant
  product: SupplierProduct
  supplier: Supplier
  searchText: string
}

interface DemoHistoryItemSpec {
  keywords: string[]
  supplierCode?: string
  quantity: number
  markup: number
  need: string
  managerComment: string
}

interface DemoHistorySpec {
  id: string
  targetItemsCount: number
  title: string
  number: string
  date: string
  customer: string
  objectName: string
  source: string
  status: string
  items: DemoHistoryItemSpec[]
}

const demoHistorySpecs: DemoHistorySpec[] = [
  {
    id: 'history-demo-bank-entry',
    targetItemsCount: 10,
    title: 'Входная группа центрального офиса',
    number: '221-В',
    date: '2026-06-24',
    customer: 'АО "Северный банк"',
    objectName: 'Центральный офис, ул. Баумана, 29',
    source: 'Отправлено клиенту',
    status: 'На согласовании',
    items: [
      {
        keywords: ['пандус', 'регулируемых'],
        supplierCode: 'vertical',
        quantity: 2,
        markup: 1.46,
        need: 'Подставной пандус для входной группы офиса - 2 шт.',
        managerComment: 'Подобран под согласованный перепад входной группы, позиция есть на складе.',
      },
      {
        keywords: ['модуль пандуса'],
        supplierCode: 'vertical',
        quantity: 6,
        markup: 1.42,
        need: 'Модули пандуса для выравнивания подхода - 6 шт.',
        managerComment: 'Добавлен запас по модулям для подгонки на объекте.',
      },
      {
        keywords: ['кнопка вызова', 'шнурком'],
        supplierCode: 'istok-audio',
        quantity: 1,
        markup: 1.52,
        need: 'Кнопка вызова помощи со шнурком для улицы - 1 шт.',
        managerComment: 'Комплект подходит для входа с постоянным потоком посетителей.',
      },
      {
        keywords: ['стойка для кнопки вызова'],
        supplierCode: 'istok-audio',
        quantity: 1,
        markup: 1.45,
        need: 'Стойка для кнопки вызова возле входа - 1 шт.',
        managerComment: 'Ставим отдельной строкой, чтобы монтажник мог вынести кнопку к зоне ожидания.',
      },
      {
        keywords: ['пиктограмма', 'доступность для инвалидов всех категорий'],
        supplierCode: 'vertical',
        quantity: 4,
        markup: 1.55,
        need: 'Тактильные пиктограммы доступности на вход и маршрут - 4 шт.',
        managerComment: 'Типовой комплект для входной группы, наличие подтверждено.',
      },
    ],
  },
  {
    id: 'history-demo-kindergarten-route',
    targetItemsCount: 4,
    title: 'Маршрут доступности детского сада',
    number: '219-В',
    date: '2026-06-21',
    customer: 'МБДОУ "Детский сад Радуга"',
    objectName: 'Главный вход и группа N 4',
    source: 'Сохранено в проекте',
    status: 'Ждет аванс',
    items: [
      {
        keywords: ['плитка тактильная', '300x300x4', 'жел'],
        supplierCode: 'vertical',
        quantity: 84,
        markup: 1.58,
        need: 'Желтая тактильная плитка для предупреждающих зон - 84 шт.',
        managerComment: 'Количество рассчитано по входу, коридору и группе N 4 с небольшим запасом.',
      },
      {
        keywords: ['лента противоскользящая', 'желтая'],
        supplierCode: 'safetystep',
        quantity: 10,
        markup: 1.48,
        need: 'Противоскользящая лента для ступеней и стеклянных дверей - 10 шт.',
        managerComment: 'Добавлена для контрастной маркировки и снижения риска скольжения.',
      },
      {
        keywords: ['пиктограмма тактильная', 'туалет'],
        supplierCode: 'vertical',
        quantity: 3,
        markup: 1.52,
        need: 'Пиктограммы туалета МГН для санитарных комнат - 3 шт.',
        managerComment: 'Подходит для детского сада, формат читаемый и износостойкий.',
      },
      {
        keywords: ['табличка тактильная', '100x300'],
        supplierCode: 'vertical',
        quantity: 12,
        markup: 1.5,
        need: 'Тактильные таблички для кабинетов и групп - 12 шт.',
        managerComment: 'Позиция заложена под индивидуальные надписи после согласования макетов.',
      },
    ],
  },
  {
    id: 'history-demo-library-navigation',
    targetItemsCount: 15,
    title: 'Навигация и мнемосхема библиотеки',
    number: '216-В',
    date: '2026-06-18',
    customer: 'МБУК "Городская библиотека"',
    objectName: 'Читальный зал и центральный вход',
    source: 'Word-файл',
    status: 'Отправлено',
    items: [
      {
        keywords: ['мнемосхема', '610'],
        supplierCode: 'invakor',
        quantity: 1,
        markup: 1.56,
        need: 'Тактильная мнемосхема 610x470 мм для центрального входа - 1 шт.',
        managerComment: 'Эконом-вариант подходит под бюджет библиотеки, макет потребуется после обмера.',
      },
      {
        keywords: ['комплексная тактильная табличка', '100x300'],
        supplierCode: 'invakor',
        quantity: 18,
        markup: 1.47,
        need: 'Комплексные тактильные таблички для залов и кабинетов - 18 шт.',
        managerComment: 'Заложено под кабинеты, читальный зал, гардероб и санузлы.',
      },
      {
        keywords: ['указатель флаговый', 'настенный'],
        supplierCode: 'vertical',
        quantity: 6,
        markup: 1.5,
        need: 'Флаговые настенные указатели для маршрута посетителя - 6 шт.',
        managerComment: 'Позиция помогает закрыть навигацию от входа до читального зала.',
      },
      {
        keywords: ['индукционная система портативная'],
        supplierCode: 'vertical',
        quantity: 1,
        markup: 1.44,
        need: 'Портативная индукционная система для стойки администратора - 1 шт.',
        managerComment: 'Добавлена по рекомендации для зоны обслуживания читателей.',
      },
    ],
  },
  {
    id: 'history-demo-museum-access',
    targetItemsCount: 12,
    title: 'Доступная среда музея',
    number: '214-В',
    date: '2026-06-14',
    customer: 'ГБУ "Музей истории города"',
    objectName: 'Центральный вход и кассовая зона',
    source: 'Сохранено в проекте',
    status: 'Принято в работу',
    items: [
      {
        keywords: ['мнемосхема', '600'],
        supplierCode: 'invakor',
        quantity: 1,
        markup: 1.54,
        need: 'Полноцветная тактильная мнемосхема 600x800 мм - 1 шт.',
        managerComment: 'Для музея выбран крупный формат с защитным покрытием.',
      },
      {
        keywords: ['тактильно-звуковая', 'датчиком движения'],
        supplierCode: 'vertical',
        quantity: 2,
        markup: 1.6,
        need: 'Тактильно-звуковые таблички с датчиком движения - 2 шт.',
        managerComment: 'Ставим на вход и в кассовой зоне для посетителей с нарушением зрения.',
      },
      {
        keywords: ['плитка тактильная', 'aisi304'],
        supplierCode: 'vertical',
        quantity: 28,
        markup: 1.45,
        need: 'Стальная тактильная плитка для исторического интерьера - 28 шт.',
        managerComment: 'AISI304 выбран вместо полиуретана из-за внешнего вида и нагрузки.',
      },
      {
        keywords: ['пиктограмма', '160'],
        supplierCode: 'invakor',
        quantity: 10,
        markup: 1.48,
        need: 'Тактильные пиктограммы с Брайлем 160x200 мм - 10 шт.',
        managerComment: 'Набор под зоны кассы, входа, гардероба и санитарных комнат.',
      },
    ],
  },
  {
    id: 'history-demo-hotel-room',
    targetItemsCount: 18,
    title: 'Комплект МГН для гостиничного номера',
    number: '211-В',
    date: '2026-06-10',
    customer: 'ООО "Отель Волга"',
    objectName: 'Номер 104 и зона ресепшен',
    source: 'Сохранено вручную',
    status: 'Черновик согласован',
    items: [
      {
        keywords: ['туалетная кабина'],
        supplierCode: 'istok-audio',
        quantity: 1,
        markup: 1.38,
        need: 'Универсальная туалетная кабина для номера МГН - 1 шт.',
        managerComment: 'Позиция дорогая, наценка снижена для удержания бюджета гостиницы.',
      },
      {
        keywords: ['кнопка вызова универсал'],
        supplierCode: 'istok-audio',
        quantity: 2,
        markup: 1.48,
        need: 'Универсальные кнопки вызова для санузла и ресепшен - 2 шт.',
        managerComment: 'Одна кнопка в номере, одна на стойке администратора.',
      },
      {
        keywords: ['приемник настольный'],
        supplierCode: 'istok-audio',
        quantity: 1,
        markup: 1.47,
        need: 'Настольный приемник с ЖК-дисплеем для ресепшен - 1 шт.',
        managerComment: 'Подобран для дежурного администратора без отдельного табло.',
      },
      {
        keywords: ['пиктограмма тактильная туалет'],
        supplierCode: 'istok-audio',
        quantity: 4,
        markup: 1.5,
        need: 'Тактильные знаки для санузла и маршрута - 4 шт.',
        managerComment: 'Комплект закрывает номер, ресепшен и навигацию на этаже.',
      },
    ],
  },
  {
    id: 'history-demo-techpark-yard',
    targetItemsCount: 20,
    title: 'Навигация промышленной площадки',
    number: '207-В',
    date: '2026-06-05',
    customer: 'ООО "Технопарк Восток"',
    objectName: 'КПП и маршрут до административного корпуса',
    source: 'Отправлено клиенту',
    status: 'В договоре',
    items: [
      {
        keywords: ['табличка тактильная', 'гост'],
        supplierCode: 'vertical',
        quantity: 24,
        markup: 1.5,
        need: 'Тактильные таблички ГОСТ для корпусов и маршрута - 24 шт.',
        managerComment: 'Позиция будет изготавливаться партиями после утверждения перечня помещений.',
      },
      {
        keywords: ['пиктограмма модульная'],
        supplierCode: 'vertical',
        quantity: 8,
        markup: 1.48,
        need: 'Модульные пиктограммы с торцевым креплением - 8 шт.',
        managerComment: 'Подходит для развилок маршрута на промышленной площадке.',
      },
      {
        keywords: ['самоклеящаяся резиновая', '50'],
        supplierCode: 'safetystep',
        quantity: 60,
        markup: 1.62,
        need: 'Резиновая противоскользящая полоса 50 мм - 60 шт.',
        managerComment: 'Заложена на наружные ступени и опасные перепады.',
      },
      {
        keywords: ['клей двухкомпонентный'],
        supplierCode: 'vertical',
        quantity: 3,
        markup: 1.36,
        need: 'Двухкомпонентный клей для монтажа покрытий - 3 шт.',
        managerComment: 'Расход подобран с запасом под наружные работы.',
      },
    ],
  },
  {
    id: 'history-demo-medcenter-entry',
    targetItemsCount: 7,
    title: 'Вход и регистратура медцентра',
    number: '203-В',
    date: '2026-05-30',
    customer: 'ООО "Медцентр Авиценна"',
    objectName: 'Регистратура и входная зона',
    source: 'Word-файл открыт',
    status: 'Оплачен частично',
    items: [
      {
        keywords: ['светозвуковой', 'скорая помощь'],
        supplierCode: 'vertical',
        quantity: 1,
        markup: 1.43,
        need: 'Светозвуковой оповещатель для кнопки помощи - 1 шт.',
        managerComment: 'Для медцентра выбран заметный оповещатель с антивандальным корпусом.',
      },
      {
        keywords: ['кнопка вызова персонала гост'],
        supplierCode: 'invakor',
        quantity: 2,
        markup: 1.5,
        need: 'Антивандальная кнопка вызова персонала ГОСТ - 2 шт.',
        managerComment: 'Две точки вызова: вход и регистратура.',
      },
      {
        keywords: ['комплексная', 'кнопкой вызова'],
        supplierCode: 'invakor',
        quantity: 1,
        markup: 1.46,
        need: 'Комплексная тактильная табличка с кнопкой вызова - 1 шт.',
        managerComment: 'Закрывает входную зону без отдельной таблички и корпуса кнопки.',
      },
      {
        keywords: ['модульное покрытие'],
        supplierCode: 'vertical',
        quantity: 36,
        markup: 1.57,
        need: 'Модульное покрытие для тамбура и зоны ожидания - 36 шт.',
        managerComment: 'Количество рассчитано по площади тамбура с запасом на подрезку.',
      },
      {
        keywords: ['лента тактильная', '50'],
        supplierCode: 'vertical',
        quantity: 20,
        markup: 1.55,
        need: 'Тактильная направляющая лента 50 мм - 20 шт.',
        managerComment: 'Маршрут от входа до регистратуры и санитарной комнаты.',
      },
    ],
  },
]

function normalizeCatalogText(value: string) {
  return value.toLocaleLowerCase('ru-RU').replace(/ё/g, 'е')
}

function createCatalogOptions(state: CrmState): CatalogOption[] {
  const productsById = new Map(state.products.map((product) => [product.id, product]))
  const suppliersById = new Map(state.suppliers.map((supplier) => [supplier.id, supplier]))

  return state.variants.flatMap((variant) => {
    const product = productsById.get(variant.supplierProductId)
    const supplier = product ? suppliersById.get(product.supplierId) : undefined

    if (!product || !supplier) {
      return []
    }

    return [
      {
        variant,
        product,
        supplier,
        searchText: normalizeCatalogText(
          [
            supplier.code,
            supplier.name,
            product.name,
            product.category,
            product.description,
            product.sku,
            product.externalId,
            variant.variantName,
            variant.sku,
            variant.size,
            variant.color,
            variant.material,
          ].join(' '),
        ),
      },
    ]
  })
}

function findCatalogOption(options: CatalogOption[], spec: DemoHistoryItemSpec, fallbackIndex: number) {
  const normalizedKeywords = spec.keywords.map(normalizeCatalogText)
  const supplierCode = spec.supplierCode ? normalizeCatalogText(spec.supplierCode) : null
  const match = options.find((option) => {
    const matchesSupplier = supplierCode ? normalizeCatalogText(option.supplier.code) === supplierCode : true

    return matchesSupplier && normalizedKeywords.every((keyword) => option.searchText.includes(keyword))
  })

  return match ?? options[fallbackIndex % Math.max(options.length, 1)] ?? null
}

const supplementalThemeKeywords: Record<string, string[]> = {
  'history-demo-bank-entry': [
    'пандус',
    'кнопка вызова',
    'стойка',
    'индукционная',
    'табличка',
    'пиктограмма',
    'знак',
    'лента',
  ],
  'history-demo-kindergarten-route': [
    'плитка',
    'лента',
    'полоса',
    'накладка',
    'табличка',
    'пиктограмма',
    'знак',
    'клей',
  ],
  'history-demo-library-navigation': [
    'мнемосхема',
    'табличка',
    'указатель',
    'пиктограмма',
    'индукционная',
    'кнопка',
    'лента',
    'плитка',
  ],
  'history-demo-museum-access': [
    'мнемосхема',
    'тактильно-звуковая',
    'плитка',
    'пиктограмма',
    'табличка',
    'индикатор',
    'лента',
  ],
  'history-demo-hotel-room': [
    'туалет',
    'кнопка',
    'приемник',
    'пиктограмма',
    'знак',
    'табличка',
    'индукционная',
    'лента',
  ],
  'history-demo-techpark-yard': [
    'табличка',
    'пиктограмма',
    'лента',
    'полоса',
    'накладка',
    'индикатор',
    'клей',
    'знак',
  ],
  'history-demo-medcenter-entry': [
    'светозвуковой',
    'кнопка',
    'табличка',
    'плитка',
    'лента',
    'пиктограмма',
    'приемник',
  ],
}

const supplementalScenarioLabels: Record<string, string> = {
  'history-demo-bank-entry': 'Комплект входной группы и зоны ожидания',
  'history-demo-kindergarten-route': 'Маршрут от входа до групп и санитарных комнат',
  'history-demo-library-navigation': 'Навигация по читальному залу и общественным зонам',
  'history-demo-museum-access': 'Доступная среда для входа, кассы и экспозиции',
  'history-demo-hotel-room': 'Комплект номера МГН и стойки ресепшен',
  'history-demo-techpark-yard': 'Промышленный маршрут от КПП до административного корпуса',
  'history-demo-medcenter-entry': 'Входная зона, регистратура и маршрут пациента',
}

function getCatalogOptionKey(option: CatalogOption) {
  return `${option.product.id}:${option.variant.id}`
}

function getCatalogOptionPurchasePrice(option: CatalogOption) {
  return roundMoneyAmount(Math.max(0, option.variant.purchasePrice || option.product.basePurchasePrice))
}

function includesCatalogText(option: CatalogOption, keywords: string[]) {
  return keywords.some((keyword) => option.searchText.includes(normalizeCatalogText(keyword)))
}

function getSupplementalQuantity(option: CatalogOption, index: number) {
  const purchasePrice = getCatalogOptionPurchasePrice(option)

  if (includesCatalogText(option, ['туалетная кабина', 'подъемник', 'терминал'])) {
    return 1
  }

  if (includesCatalogText(option, ['пандус', 'рампа', 'мнемосхема'])) {
    return [1, 1, 2, 1, 2][index % 5]
  }

  if (includesCatalogText(option, ['клей'])) {
    return [1, 2, 2, 3][index % 4]
  }

  if (purchasePrice >= 80_000) {
    return 1
  }

  if (purchasePrice >= 25_000) {
    return [1, 1, 2, 1, 2][index % 5]
  }

  if (includesCatalogText(option, ['лента', 'полоса', 'накладка', 'профиль'])) {
    return purchasePrice >= 3_000 ? [4, 6, 8, 10, 12][index % 5] : [8, 10, 12, 16, 20, 24][index % 6]
  }

  if (includesCatalogText(option, ['плитка', 'индикатор', 'конус', 'риф'])) {
    if (purchasePrice >= 5_000) {
      return [6, 8, 10, 12, 16][index % 5]
    }

    if (purchasePrice >= 1_200) {
      return [12, 18, 24, 30, 36][index % 5]
    }

    return [24, 36, 48, 60, 72, 84][index % 6]
  }

  if (includesCatalogText(option, ['табличка', 'пиктограмма', 'указатель', 'знак'])) {
    return [2, 3, 4, 6, 8, 10, 12][index % 7]
  }

  if (includesCatalogText(option, ['кнопка', 'приемник', 'оповещатель', 'индукционная'])) {
    return [1, 2, 2, 3, 1, 2][index % 6]
  }

  return [1, 2, 3, 4, 6, 8][index % 6]
}

function isHeavySupplementalOption(option: CatalogOption) {
  return (
    getCatalogOptionPurchasePrice(option) >= 150_000 ||
    includesCatalogText(option, ['подъемник', 'терминал', 'туалетная кабина', 'пандус', 'рампа'])
  )
}

function getSupplementalMarkup(option: CatalogOption, index: number) {
  const purchasePrice = getCatalogOptionPurchasePrice(option)
  const baseMarkup = purchasePrice >= 80_000 ? 1.34 : purchasePrice >= 25_000 ? 1.39 : 1.47

  return Number((baseMarkup + (index % 6) * 0.025).toFixed(2))
}

function makeSupplementalItemSpec(spec: DemoHistorySpec, option: CatalogOption, index: number): DemoHistoryItemSpec {
  const quantity = getSupplementalQuantity(option, index)
  const unit = option.product.unit || 'шт'
  const scenarioLabel = supplementalScenarioLabels[spec.id] ?? 'Комплектация объекта'

  return {
    keywords: [option.product.name, option.variant.variantName, option.product.sku].filter(Boolean),
    supplierCode: option.supplier.code,
    quantity,
    markup: getSupplementalMarkup(option, index),
    need: `${scenarioLabel}: ${getOfferItemDescription(option)} - ${quantity} ${unit}.`,
    managerComment:
      'Добавлено в комплект как связанная позиция; количество рассчитано под объект и небольшой монтажный запас.',
  }
}

function pickSupplementalOptions(
  spec: DemoHistorySpec,
  options: CatalogOption[],
  usedOptionKeys: Set<string>,
  count: number,
) {
  if (!count || !options.length) {
    return []
  }

  const themeKeywords = supplementalThemeKeywords[spec.id] ?? []
  const themedOptions = themeKeywords.length
    ? options.filter((option) => !usedOptionKeys.has(getCatalogOptionKey(option)) && includesCatalogText(option, themeKeywords))
    : []
  const fallbackOptions = options.filter(
    (option) => !usedOptionKeys.has(getCatalogOptionKey(option)) && !isHeavySupplementalOption(option),
  )
  const candidates = [...themedOptions, ...fallbackOptions]
  const uniqueCandidates = candidates.filter(
    (option, index, list) => list.findIndex((candidate) => getCatalogOptionKey(candidate) === getCatalogOptionKey(option)) === index,
  )
  const startIndex =
    uniqueCandidates.length > 0
      ? [...spec.id].reduce((sum, char) => sum + char.charCodeAt(0), 0) % uniqueCandidates.length
      : 0
  const picked: CatalogOption[] = []

  for (let index = 0; index < uniqueCandidates.length && picked.length < count; index += 1) {
    const option = uniqueCandidates[(startIndex + index) % uniqueCandidates.length]
    const optionKey = getCatalogOptionKey(option)

    if (usedOptionKeys.has(optionKey)) {
      continue
    }

    usedOptionKeys.add(optionKey)
    picked.push(option)
  }

  return picked
}

function roundSalePrice(value: number) {
  if (value >= 100_000) {
    return Math.round(value / 500) * 500
  }

  if (value >= 10_000) {
    return Math.round(value / 100) * 100
  }

  if (value >= 1_000) {
    return Math.round(value / 50) * 50
  }

  return Math.round(value / 10) * 10
}

function getOfferItemDescription(option: CatalogOption) {
  const details = [
    option.variant.size && option.variant.size !== 'по карточке' ? option.variant.size : '',
    option.variant.color && option.variant.color !== 'по карточке' ? option.variant.color : '',
    option.variant.material && option.variant.material !== 'по карточке' ? option.variant.material : '',
  ].filter(Boolean)

  return details.length ? `${option.product.name}, ${details.join(', ')}` : option.product.name
}

function makeHistoryOfferItem(
  historyId: string,
  itemSpec: DemoHistoryItemSpec,
  option: CatalogOption,
  index: number,
): DemoOfferTableItem {
  const purchasePrice = roundMoneyAmount(Math.max(0, option.variant.purchasePrice || option.product.basePurchasePrice))
  const salePrice = roundSalePrice(purchasePrice * itemSpec.markup)
  const productCode = option.variant.sku || option.product.sku
  const productUrl =
    option.product.sourceUrl ||
    resolveVerticalProductUrl({
      description: option.product.name,
      productCode,
    })

  return {
    id: `${historyId}-item-${index + 1}`,
    sourceNeed: itemSpec.need,
    description: getOfferItemDescription(option),
    productCode,
    productUrl,
    productImageUrl: option.product.imageUrl,
    unit: option.product.unit || 'шт',
    quantity: itemSpec.quantity,
    unitPrice: purchasePrice,
    installationUnitPrice: salePrice,
    minSalePrice: roundSalePrice(purchasePrice * Math.max(1.28, itemSpec.markup - 0.08)),
    maxSalePrice: roundSalePrice(purchasePrice * (itemSpec.markup + 0.14)),
    marketBenchmark: roundSalePrice(purchasePrice * (itemSpec.markup + 0.05)),
    pricingRevision: kpPriceRevision,
    reviewStatus: 'цена и наличие проверены',
    managerComment: `${option.supplier.name}: ${option.variant.availability || option.product.availability}. ${itemSpec.managerComment}`,
  }
}

function makeHistoryOfferTable(spec: DemoHistorySpec, options: CatalogOption[]) {
  const targetItemsCount = Math.max(0, spec.targetItemsCount)
  const usedOptionKeys = new Set<string>()
  const baseItems: DemoOfferTableItem[] = []

  spec.items.forEach((itemSpec, index) => {
    if (baseItems.length >= targetItemsCount) {
      return
    }

    const option = findCatalogOption(options, itemSpec, index)

    if (!option) {
      return
    }

    const optionKey = getCatalogOptionKey(option)

    if (usedOptionKeys.has(optionKey)) {
      return
    }

    usedOptionKeys.add(optionKey)
    baseItems.push(makeHistoryOfferItem(spec.id, itemSpec, option, baseItems.length))
  })
  const supplementalItemsCount = Math.max(0, targetItemsCount - baseItems.length)
  const supplementalItems = pickSupplementalOptions(spec, options, usedOptionKeys, supplementalItemsCount).map(
    (option, index) => {
      const itemIndex = baseItems.length + index

      return makeHistoryOfferItem(spec.id, makeSupplementalItemSpec(spec, option, itemIndex), option, itemIndex)
    },
  )

  return recalculateOfferTable({
    items: [...baseItems, ...supplementalItems],
    totals: [],
  })
}

export function createDemoKpHistoryEntries(state: CrmState): KpHistoryEntry[] {
  const options = createCatalogOptions(state)

  return demoHistorySpecs.map((spec) => {
    const offerTable = makeHistoryOfferTable(spec, options)
    const validityDays = kpValidityDays

    return {
      id: spec.id,
      title: spec.title,
      number: spec.number,
      date: spec.date,
      customer: spec.customer,
      total: getOfferSaleTotal(offerTable),
      source: spec.source,
      status: spec.status,
      objectName: spec.objectName,
      itemsCount: offerTable.items.length,
      recipientName: spec.customer,
      validUntil: addCalendarDays(spec.date, validityDays),
      validityDays,
      vatRate: kpVatRate,
      offerTable,
    }
  })
}
