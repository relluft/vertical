import type {
  DraftCellAnnotation,
  DraftCellId,
  DemoAsset,
  DemoDocumentType,
  DemoDraft,
  DemoOfferTable,
  DemoOfferTableItem,
  DemoOfferTableTotal,
  DemoMeasurement,
  DemoRun,
  DemoSourceOption,
  DemoStage,
  DemoState,
  DraftField,
  DraftSection,
  ExportArtifact,
  QAFlag,
  SourceLink,
  StageStatus,
} from '../types/demo'
import { applyKpPriceAdjustments, getEffectivePurchaseUnitPrice } from '../lib/kpPricing'
import { attachVerticalProductData, resolveVerticalProductUrl } from '../lib/verticalProducts'

const runStageBlueprints: Record<DemoDocumentType, DemoStage[]> = {
  kp: [
    {
      id: 'parse',
      title: 'Распознаем позиции',
      summary: 'Разбираем потребность или введенный текст на товарные строки.',
      durationLabel: '2 сек',
      details: 'Система выделяет товары, количества, единицы измерения и важные характеристики.',
      durationMs: 2200,
      status: 'pending',
    },
    {
      id: 'match',
      title: 'Ищем товары на Вертикаль',
      summary: 'Подбираем подходящие товары и фиксируем сомнительные совпадения.',
      durationLabel: '3 сек',
      details: 'Подбор идет внутри обработки, без отдельного пользовательского экрана.',
      durationMs: 2800,
      status: 'pending',
    },
    {
      id: 'prices',
      title: 'Подтягиваем цены',
      summary: 'Берем представительские цены через личный кабинет Вертикаль, если доступ есть.',
      durationLabel: '3 сек',
      details: 'Если цена недоступна, строка попадет в таблицу со статусом проверки.',
      durationMs: 2600,
      status: 'pending',
    },
    {
      id: 'table',
      title: 'Формируем рабочую таблицу',
      summary: 'Создаем строки КП со статусами проверки, ценами, маржей и комментариями.',
      durationLabel: '2 сек',
      details: 'Следующий полноценный экран для менеджера - рабочая таблица КП.',
      durationMs: 2200,
      status: 'pending',
    },
  ],
  tz: [
    {
      id: 'materials',
      title: 'Исходные данные для ТЗ собраны',
      summary: 'Берём выбранную основу, измеримые параметры и вводные по проекту.',
      durationLabel: '3 сек',
      details: 'На этом шаге система собирает только технически значимые данные.',
      durationMs: 3000,
      status: 'pending',
    },
    {
      id: 'norms',
      title: 'Технические требования проверены',
      summary: 'Сверяем измеримые параметры и применимые ограничения.',
      durationLabel: '4 сек',
      details: 'Сюда попадают только нейтральные требования, без персональных и клиентских данных.',
      durationMs: 4200,
      status: 'pending',
    },
    {
      id: 'pricing',
      title: 'Техническое решение оформлено',
      summary: 'Собираем структуру ТЗ и подготавливаем её для редактора.',
      durationLabel: '3 сек',
      details: 'Документ формируется как обезличенный рабочий шаблон для дальнейшей доработки.',
      durationMs: 3400,
      status: 'pending',
    },
    {
      id: 'draft',
      title: 'Черновик ТЗ готов',
      summary: 'Подготавливаем нейтральный документ с измеримыми параметрами и вводными.',
      durationLabel: '4 сек',
      details: 'Черновик можно открыть в редакторе, проверить и использовать как основу.',
      durationMs: 4200,
      status: 'pending',
    },
    {
      id: 'qa',
      title: 'Технические уточнения отмечены',
      summary: 'Подсвечиваем, что нужно проверить до финального экспорта.',
      durationLabel: '3 сек',
      details: 'Список остаётся обезличенным и концентрируется только на качестве данных.',
      durationMs: 3200,
      status: 'pending',
    },
    {
      id: 'ready',
      title: 'ТЗ готово к показу',
      summary: 'Документ можно просмотреть, отредактировать и вывести на согласование.',
      durationLabel: '2 сек',
      details: 'Рабочая версия остаётся нейтральной и безопасной для показа.',
      durationMs: 2200,
      status: 'pending',
    },
  ],
}

const blankDraftFields: DraftField[] = [
  {
    id: 'dueDate',
    label: 'Срок выполнения',
    value: '',
    hint: 'Заполняется вручную на финальном этапе или из рабочего примера.',
  },
  {
    id: 'specialTerms',
    label: 'Особые условия',
    value: '',
    hint: 'Свободная формулировка важных условий без персональных данных.',
  },
]

const demoFieldDefaults = {
  dueDate: 'КП действительно 5 рабочих дней после подтверждения наличия',
  specialTerms: 'поставка зависит от наличия на складе; спорные позиции требуют проверки перед выпуском',
}

const defaultOfferServiceTotals: DemoOfferTableTotal[] = []

function sumOfferAmounts(items: DemoOfferTableItem[]) {
  return items.reduce(
    (accumulator, item) => {
      const purchaseTotal = item.quantity * getEffectivePurchaseUnitPrice(item)
      const saleTotal = item.quantity * item.installationUnitPrice

      return {
        productTotal: accumulator.productTotal + purchaseTotal,
        installationTotal: accumulator.installationTotal + saleTotal,
        grandTotal: accumulator.grandTotal + saleTotal - purchaseTotal,
      }
    },
    {
      productTotal: 0,
      installationTotal: 0,
      grandTotal: 0,
    },
  )
}

function buildOfferTotals(
  items: DemoOfferTableItem[],
  serviceTotals: DemoOfferTableTotal[] = defaultOfferServiceTotals,
): DemoOfferTableTotal[] {
  const subtotal = sumOfferAmounts(items)

  return [
    {
      id: 'offer-subtotal',
      label: 'ИТОГО ПО ТОВАРАМ',
      productTotal: subtotal.productTotal,
      installationTotal: subtotal.installationTotal,
      grandTotal: subtotal.grandTotal,
      tone: 'subtotal',
    },
    ...serviceTotals.map((total) => ({ ...total })),
  ]
}

export function createEmptyOfferTable(): DemoOfferTable {
  return {
    items: [],
    totals: buildOfferTotals([]),
  }
}

function getVerticalProductUrl(item: DemoOfferTableItem, index = 0) {
  return resolveVerticalProductUrl(item, index)
}

export function recalculateOfferTable(offerTable: DemoOfferTable): DemoOfferTable {
  const items = offerTable.items.map((item) => applyKpPriceAdjustments(item))
  const serviceTotals = offerTable.totals
    .filter((total) => total.tone === 'service')
    .map((total) => ({
      id: total.id,
      label: total.label,
      grandTotal: total.grandTotal,
      tone: 'service' as const,
    }))

  return {
    ...offerTable,
    items,
    totals: buildOfferTotals(items, serviceTotals.length ? serviceTotals : defaultOfferServiceTotals),
  }
}

export function getDemoOfferTable(): DemoOfferTable {
  const items: DemoOfferTableItem[] = [
    {
      id: 'offer-mnemo',
      sourceNeed: 'Мнемосхема тактильная полноцветная 610x470 мм, рельеф и Брайль, 1 шт.',
      description:
        'Мнемосхема тактильная полноцветная с рельефом и дублированием шрифтом Брайля, защитное покрытие, формат 610x470 мм.',
      productCode: 'VRT-610-470-BR',
      productUrl: 'https://tiflocentre.ru/magazin/view_product.php?id=2318',
      unit: 'шт',
      quantity: 1,
      unitPrice: 18640,
      installationUnitPrice: 25400,
      minSalePrice: 22370,
      maxSalePrice: 29800,
      marketBenchmark: 26800,
      reviewStatus: 'готово',
      managerComment: 'Совпадение по формату и исполнению.',
    },
    {
      id: 'offer-sign-set',
      sourceNeed: 'Тактильные пиктограммы для входа и маршрута, комплект 4 шт.',
      description:
        'Комплект тактильных пиктограмм для входной группы и основных точек маршрута: вход, направление движения, кнопка вызова, зона ожидания.',
      productCode: 'VRT-PIC-SET-04',
      productUrl: 'https://tiflocentre.ru/magazin/view_product.php?id=1772',
      unit: 'шт',
      quantity: 4,
      unitPrice: 742.35,
      installationUnitPrice: 1190,
      minSalePrice: 940,
      maxSalePrice: 1420,
      marketBenchmark: 1250,
      reviewStatus: 'подтверждено',
      managerComment: 'Можно оставить в КП без доп. уточнений.',
    },
    {
      id: 'offer-contrast-tape',
      sourceNeed: 'Контрастная лента желтая, ширина 100 мм, 18 м.',
      description:
        'Лента контрастная для маркировки ступеней и дверных проемов, самоклеящаяся, желтая, ширина 100 мм.',
      productCode: 'VRT-TAPE-100-Y',
      productUrl: 'https://tiflocentre.ru/magazin/view_product.php?id=6261',
      unit: 'м',
      quantity: 18,
      unitPrice: 684.1,
      installationUnitPrice: 990,
      minSalePrice: 820,
      maxSalePrice: 1180,
      marketBenchmark: 1040,
      reviewStatus: 'готово',
      managerComment: 'Проверить фактический метраж перед выпуском.',
    },
    {
      id: 'offer-tactile-tile',
      sourceNeed: 'Тактильная плитка предупреждающая наружная 300x300 мм, 24 шт.',
      description:
        'Плитка тактильная предупреждающая, полиуретановая, наружное исполнение, размер 300x300 мм.',
      productCode: 'VRT-TILE-PU-300',
      productUrl: 'https://tiflocentre.ru/magazin/view_product.php?id=2483',
      unit: 'шт',
      quantity: 24,
      unitPrice: 1952.75,
      installationUnitPrice: 2840,
      minSalePrice: 2380,
      maxSalePrice: 3260,
      marketBenchmark: 2950,
      reviewStatus: 'цена требует проверки',
      managerComment: 'Представительскую цену лучше сверить в личном кабинете.',
    },
    {
      id: 'offer-nosing',
      sourceNeed: 'Противоскользящие накладки на ступени 1000 мм, 11 шт.',
      description:
        'Накладка на ступень противоскользящая в алюминиевом профиле с контрастной вставкой, длина 1000 мм.',
      productCode: 'VRT-NOS-AL-1000',
      productUrl: 'https://tiflocentre.ru/magazin/view_product.php?id=3893',
      unit: 'шт',
      quantity: 11,
      unitPrice: 1909.95,
      installationUnitPrice: 2760,
      minSalePrice: 2310,
      maxSalePrice: 3180,
      marketBenchmark: 2890,
      reviewStatus: 'готово',
      managerComment: 'Подходит по длине, цвет вставки уточнить.',
    },
    {
      id: 'offer-call-button',
      sourceNeed: 'Антивандальная кнопка вызова со стойкой, 1 комплект.',
      description:
        'Антивандальная кнопка вызова со стойкой крепления и базовой индикацией для входной зоны.',
      productCode: 'VRT-CALL-AV-STD',
      productUrl: 'https://tiflocentre.ru/magazin/view_product.php?id=5754',
      unit: 'компл.',
      quantity: 1,
      unitPrice: 4875.9,
      installationUnitPrice: 7200,
      minSalePrice: 5850,
      maxSalePrice: 8400,
      marketBenchmark: 7600,
      reviewStatus: 'нужно уточнить',
      managerComment: 'Нужно подтвердить тип питания и место установки.',
    },
    {
      id: 'offer-loop',
      sourceNeed: 'Индукционная система для посетителей с нарушением слуха, 1 комплект.',
      description:
        'Переносная индукционная система для обслуживания посетителей с нарушением слуха, портативный комплект.',
      productCode: 'VRT-LOOP-MOB',
      productUrl: 'https://tiflocentre.ru/magazin/view_product.php?id=1526',
      unit: 'компл.',
      quantity: 1,
      unitPrice: 23184.55,
      installationUnitPrice: 32900,
      minSalePrice: 27820,
      maxSalePrice: 38200,
      marketBenchmark: 34500,
      reviewStatus: 'цена требует проверки',
      managerComment: 'Цена зависит от наличия. Не выпускать без сверки.',
    },
    {
      id: 'offer-handrail',
      sourceNeed: 'Двухуровневые поручни из нержавеющей стали, 12,5 м.',
      description:
        'Ограждение с двухуровневыми поручнями, нержавеющая сталь, напольное исполнение, основной марш и площадка.',
      productCode: 'VRT-HR-SS-2L',
      productUrl: 'https://tiflocentre.ru/magazin/view_product.php?id=8368',
      unit: 'м',
      quantity: 12.5,
      unitPrice: 18900,
      installationUnitPrice: 26700,
      minSalePrice: 22680,
      maxSalePrice: 31500,
      marketBenchmark: 28400,
      reviewStatus: 'нужно уточнить',
      managerComment: 'Метраж и крепления зависят от фактического основания.',
    },
    {
      id: 'offer-accessible-entrance-sign',
      sourceNeed: 'Тактильная табличка доступный вход с Брайлем, 2 шт.',
      description:
        'Тактильная табличка "Доступный вход" с рельефным обозначением и дублированием шрифтом Брайля, контрастное исполнение.',
      productCode: 'VRT-SIGN-ENTRY-BR',
      productUrl: 'https://tiflocentre.ru/magazin/view_product.php?id=1772',
      unit: 'шт',
      quantity: 2,
      unitPrice: 1780,
      installationUnitPrice: 2590,
      minSalePrice: 2140,
      maxSalePrice: 3010,
      marketBenchmark: 2740,
      reviewStatus: 'готово',
      managerComment: 'Позиция соответствует табличкам доступного входа с Брайлем.',
    },
    {
      id: 'offer-mobile-ramp-1200',
      sourceNeed: 'Перекатной алюминиевый пандус 1200 мм, 1 шт.',
      description:
        'Пандус перекатной алюминиевый для преодоления порогов и небольших перепадов высоты, длина 1200 мм, противоскользящая поверхность.',
      productCode: 'VRT-RAMP-AL-MOB-1200',
      productUrl: 'https://tiflocentre.ru/magazin/view_product.php?id=277',
      unit: 'шт',
      quantity: 1,
      unitPrice: 13800,
      installationUnitPrice: 18900,
      minSalePrice: 16560,
      maxSalePrice: 22000,
      marketBenchmark: 20100,
      reviewStatus: 'готово',
      managerComment: 'Грязная позиция напрямую сопоставлена с перекатным алюминиевым пандусом 1200 мм.',
    },
  ]

  const syncedItems = items.map((item) => applyKpPriceAdjustments(attachVerticalProductData(item)))
  const subtotal = sumOfferAmounts(syncedItems)

  return {
    items: syncedItems,
    totals: [
      {
        id: 'offer-subtotal',
        label: 'ИТОГО',
        productTotal: subtotal.productTotal,
        installationTotal: subtotal.installationTotal,
        grandTotal: subtotal.grandTotal,
        tone: 'subtotal',
      },
    ],
  }
}

function createOfferTableFromItems(items: DemoOfferTableItem[]): DemoOfferTable {
  const syncedItems = items.map((item) => applyKpPriceAdjustments(attachVerticalProductData(item)))

  return {
    items: syncedItems,
    totals: buildOfferTotals(syncedItems),
  }
}

function getSanitaryRoomDemoOfferTable(): DemoOfferTable {
  return createOfferTableFromItems([
    {
      id: 'offer-san-folding-rail',
      sourceNeed: 'Откидные поручни для санузла, 800 мм, нержавейка, 2 шт.',
      description:
        'Поручень опорный откидной настенный для санитарной комнаты, нержавеющая сталь, длина 800 мм, с крепежной пластиной.',
      productCode: 'VRT-HND-FOLD-800',
      productUrl: 'https://tiflocentre.ru/magazin/view_product.php?id=2430',
      unit: 'шт',
      quantity: 2,
      unitPrice: 10450,
      installationUnitPrice: 13900,
      minSalePrice: 12540,
      maxSalePrice: 16200,
      marketBenchmark: 14800,
      reviewStatus: 'готово',
      managerComment: 'Позиция соответствует запросу: откидной поручень 800 мм для санузла.',
    },
    {
      id: 'offer-san-wall-rail-600',
      sourceNeed: 'Прямые настенные поручни 600 мм у раковины и унитаза, 4 шт.',
      description:
        'Поручень прямой настенный для санитарных помещений, нержавеющая сталь, длина 600 мм, скрытое крепление.',
      productCode: 'VRT-HND-WALL-600',
      productUrl: 'https://tiflocentre.ru/magazin/view_product.php?id=110',
      unit: 'шт',
      quantity: 4,
      unitPrice: 3820,
      installationUnitPrice: 5280,
      minSalePrice: 4580,
      maxSalePrice: 6120,
      marketBenchmark: 5600,
      reviewStatus: 'готово',
      managerComment: 'Количество и длина перенесены из грязной заявки без изменения смысла.',
    },
    {
      id: 'offer-san-corner-rail',
      sourceNeed: 'Угловой поручень 700 на 700 мм, 1 шт.',
      description:
        'Поручень угловой настенный 90 градусов для санитарной комнаты, нержавеющая сталь, размер 700x700 мм.',
      productCode: 'VRT-HND-COR-700',
      productUrl: 'https://tiflocentre.ru/magazin/view_product.php?id=7674',
      unit: 'шт',
      quantity: 1,
      unitPrice: 8420,
      installationUnitPrice: 11400,
      minSalePrice: 10100,
      maxSalePrice: 13200,
      marketBenchmark: 12100,
      reviewStatus: 'готово',
      managerComment: 'Грязная позиция напрямую сопоставлена с угловым поручнем 700x700 мм.',
    },
    {
      id: 'offer-san-shower-seat',
      sourceNeed: 'Откидное сиденье для душа настенное, 1 шт.',
      description:
        'Сиденье для душа откидное настенное для МГН, влагостойкое исполнение, усиленная рама, настенный монтаж.',
      productCode: 'VRT-SEAT-SH-FOLD',
      productUrl: 'https://tiflocentre.ru/magazin/view_product.php?id=4711',
      unit: 'шт',
      quantity: 1,
      unitPrice: 12600,
      installationUnitPrice: 16900,
      minSalePrice: 15120,
      maxSalePrice: 19800,
      marketBenchmark: 18100,
      reviewStatus: 'готово',
      managerComment: 'Сохранен тип изделия: откидное настенное сиденье для душевой зоны.',
    },
    {
      id: 'offer-san-tilt-mirror',
      sourceNeed: 'Зеркало наклонное для доступного санузла 600x800, 1 шт.',
      description:
        'Зеркало наклонное для санитарной комнаты МГН, размер 600x800 мм, с регулируемым углом наклона.',
      productCode: 'VRT-MIR-TILT-600-800',
      productUrl: 'https://tiflocentre.ru/magazin/view_product.php?id=7897',
      unit: 'шт',
      quantity: 1,
      unitPrice: 7150,
      installationUnitPrice: 9800,
      minSalePrice: 8580,
      maxSalePrice: 11400,
      marketBenchmark: 10400,
      reviewStatus: 'готово',
      managerComment: 'Размер и назначение совпадают с грязной заявкой.',
    },
    {
      id: 'offer-san-call-cord',
      sourceNeed: 'Кнопка вызова помощи со шнурком в туалет, 1 комплект.',
      description:
        'Комплект кнопки вызова помощи для санитарной комнаты со шнуровым приводом, световой индикацией и приемным блоком.',
      productCode: 'VRT-CALL-WC-CORD',
      productUrl: 'https://tiflocentre.ru/magazin/view_product.php?id=8378',
      unit: 'компл.',
      quantity: 1,
      unitPrice: 11800,
      installationUnitPrice: 15800,
      minSalePrice: 14160,
      maxSalePrice: 18400,
      marketBenchmark: 16900,
      reviewStatus: 'нужно уточнить',
      managerComment: 'Нужно уточнить состав комплекта: приемник, табло, тип питания.',
    },
    {
      id: 'offer-san-braille-signs',
      sourceNeed: 'Таблички туалет МГН с Брайлем, 2 шт.',
      description:
        'Тактильная табличка для санитарной комнаты МГН с рельефно-точечным шрифтом Брайля и контрастным обозначением.',
      productCode: 'VRT-SIGN-WC-BR',
      productUrl: 'https://tiflocentre.ru/magazin/view_product.php?id=1789',
      unit: 'шт',
      quantity: 2,
      unitPrice: 1640,
      installationUnitPrice: 2360,
      minSalePrice: 1970,
      maxSalePrice: 2750,
      marketBenchmark: 2480,
      reviewStatus: 'готово',
      managerComment: 'Запрос на таблички с Брайлем сохранен в профессиональном наименовании.',
    },
    {
      id: 'offer-san-crutch-holder',
      sourceNeed: 'Держатель костылей настенный, 1 шт.',
      description:
        'Держатель костылей настенный для санитарной комнаты и зоны ожидания, металлическое исполнение, настенный монтаж.',
      productCode: 'VRT-HOLD-CRUTCH',
      productUrl: 'https://tiflocentre.ru/magazin/view_product.php?id=8090',
      unit: 'шт',
      quantity: 1,
      unitPrice: 2450,
      installationUnitPrice: 3480,
      minSalePrice: 2940,
      maxSalePrice: 4050,
      marketBenchmark: 3700,
      reviewStatus: 'готово',
      managerComment: 'Позиция напрямую соответствует держателю костылей.',
    },
    {
      id: 'offer-san-lever-mixer',
      sourceNeed: 'Смеситель локтевой на раковину, 1 шт.',
      description:
        'Смеситель локтевой для раковины санитарной комнаты МГН, однорычажное исполнение с удлиненной рукояткой.',
      productCode: 'VRT-MIX-ELBOW',
      productUrl: 'https://tiflocentre.ru/magazin/view_product.php?id=1185',
      unit: 'шт',
      quantity: 1,
      unitPrice: 6900,
      installationUnitPrice: 9650,
      minSalePrice: 8280,
      maxSalePrice: 11200,
      marketBenchmark: 10300,
      reviewStatus: 'готово',
      managerComment: 'Грязное название уточнено до локтевого смесителя для раковины МГН.',
    },
    {
      id: 'offer-san-anti-slip-roll',
      sourceNeed: 'Противоскользящее покрытие для влажной зоны, 8 м2.',
      description:
        'Противоскользящее рулонное покрытие для влажных зон, износостойкое исполнение, поставка по площади 8 м2.',
      productCode: 'VRT-FLOOR-AS-WET',
      productUrl: 'https://tiflocentre.ru/magazin/view_product.php?id=6734',
      unit: 'м2',
      quantity: 8,
      unitPrice: 2140,
      installationUnitPrice: 3190,
      minSalePrice: 2570,
      maxSalePrice: 3710,
      marketBenchmark: 3400,
      reviewStatus: 'цена требует проверки',
      managerComment: 'Площадь оставлена из заявки, перед выпуском проверить фактический метраж.',
    },
    {
      id: 'offer-san-accessible-toilet',
      sourceNeed: 'Унитаз для МГН с увеличенным вылетом, 1 шт.',
      description:
        'Унитаз напольный для санитарной комнаты МГН с увеличенным вылетом чаши и возможностью бокового пересаживания.',
      productCode: 'VRT-WC-MGN-LONG',
      productUrl: 'https://tiflocentre.ru/magazin/view_product.php?id=2936',
      unit: 'шт',
      quantity: 1,
      unitPrice: 18400,
      installationUnitPrice: 24800,
      minSalePrice: 22080,
      maxSalePrice: 28900,
      marketBenchmark: 26500,
      reviewStatus: 'готово',
      managerComment: 'Тип изделия соответствует заявке: унитаз для МГН с увеличенным вылетом.',
    },
    {
      id: 'offer-san-accessible-sink',
      sourceNeed: 'Раковина для МГН с фронтальным подъездом, 1 шт.',
      description:
        'Раковина доступная для МГН с фронтальным подъездом инвалидной коляски, эргономичная форма чаши, настенный монтаж.',
      productCode: 'VRT-SINK-MGN-FRONT',
      productUrl: 'https://tiflocentre.ru/magazin/view_product.php?id=1180',
      unit: 'шт',
      quantity: 1,
      unitPrice: 13200,
      installationUnitPrice: 18400,
      minSalePrice: 15840,
      maxSalePrice: 21400,
      marketBenchmark: 19600,
      reviewStatus: 'готово',
      managerComment: 'Запрос на раковину для МГН сохранен в профессиональном наименовании.',
    },
    {
      id: 'offer-san-flat-siphon',
      sourceNeed: 'Поручень защиты слива под доступную раковину, 1 шт.',
      description:
        'Поручень опорный для защиты слива раковины, нержавеющая сталь с полиамидными окончаниями, для доступной санитарной комнаты.',
      productCode: 'VRT-SIPHON-FLAT-MGN',
      productUrl: 'https://tiflocentre.ru/magazin/view_product.php?id=5256',
      unit: 'шт',
      quantity: 1,
      unitPrice: 2860,
      installationUnitPrice: 4380,
      minSalePrice: 3430,
      maxSalePrice: 5100,
      marketBenchmark: 4680,
      reviewStatus: 'готово',
      managerComment: 'Позиция связана с доступной раковиной и соответствует карточке защиты слива на Вертикаль.',
    },
    {
      id: 'offer-san-soap-dispenser',
      sourceNeed: 'Дозатор мыла сенсорный настенный, 1 шт.',
      description:
        'Дозатор жидкого мыла сенсорный настенный для санитарной комнаты, бесконтактная подача, антивандальный корпус.',
      productCode: 'VRT-DISP-SOAP-SENS',
      productUrl: 'https://tiflocentre.ru/magazin/view_product.php?id=1189',
      unit: 'шт',
      quantity: 1,
      unitPrice: 4120,
      installationUnitPrice: 5960,
      minSalePrice: 4940,
      maxSalePrice: 6940,
      marketBenchmark: 6350,
      reviewStatus: 'готово',
      managerComment: 'Грязная строка сопоставлена с настенным сенсорным дозатором мыла.',
    },
    {
      id: 'offer-san-paper-holder',
      sourceNeed: 'Держатель туалетной бумаги настенный, 1 шт.',
      description:
        'Держатель туалетной бумаги настенный для санитарной комнаты МГН, усиленное металлическое исполнение.',
      productCode: 'VRT-HOLD-PAPER-WC',
      productUrl: 'https://tiflocentre.ru/magazin/view_product.php?id=5762',
      unit: 'шт',
      quantity: 1,
      unitPrice: 1980,
      installationUnitPrice: 2860,
      minSalePrice: 2380,
      maxSalePrice: 3330,
      marketBenchmark: 3060,
      reviewStatus: 'готово',
      managerComment: 'Позиция сохранена как настенный держатель туалетной бумаги.',
    },
    {
      id: 'offer-san-clothes-hook',
      sourceNeed: 'Крючки для одежды настенные, 2 шт.',
      description:
        'Крючок для одежды настенный для санитарной комнаты МГН, металлическое исполнение, безопасная скругленная форма.',
      productCode: 'VRT-HOOK-WALL-MGN',
      productUrl: 'https://tiflocentre.ru/magazin/view_product.php?id=1197',
      unit: 'шт',
      quantity: 2,
      unitPrice: 980,
      installationUnitPrice: 1480,
      minSalePrice: 1180,
      maxSalePrice: 1720,
      marketBenchmark: 1580,
      reviewStatus: 'готово',
      managerComment: 'Количество и назначение совпадают с грязной заявкой.',
    },
    {
      id: 'offer-san-hand-dryer',
      sourceNeed: 'Сушилка для рук бесконтактная, 1 шт.',
      description:
        'Электросушилка для рук бесконтактная настенная, автоматическое включение, корпус для общественных санитарных помещений.',
      productCode: 'VRT-DRYER-HAND-SENS',
      productUrl: 'https://tiflocentre.ru/magazin/view_product.php?id=5555',
      unit: 'шт',
      quantity: 1,
      unitPrice: 9800,
      installationUnitPrice: 13700,
      minSalePrice: 11760,
      maxSalePrice: 15900,
      marketBenchmark: 14600,
      reviewStatus: 'готово',
      managerComment: 'Грязная позиция соответствует бесконтактной настенной сушилке для рук.',
    },
    {
      id: 'offer-san-door-handle',
      sourceNeed: 'Опорный поручень-скоба для зоны двери санузла, 1 шт.',
      description:
        'Поручень опорный двойной для санитарной комнаты МГН, настенно-напольное исполнение, сталь, D38 мм.',
      productCode: 'VRT-HANDLE-DOOR-400',
      productUrl: 'https://tiflocentre.ru/magazin/view_product.php?id=400',
      unit: 'шт',
      quantity: 1,
      unitPrice: 3420,
      installationUnitPrice: 4860,
      minSalePrice: 4110,
      maxSalePrice: 5650,
      marketBenchmark: 5180,
      reviewStatus: 'готово',
      managerComment: 'Грязная строка уточнена до опорного поручня, который реально есть в каталоге Вертикаль.',
    },
  ])
}

function getNavigationEntranceDemoOfferTable(): DemoOfferTable {
  return createOfferTableFromItems([
    {
      id: 'offer-nav-guide-strip',
      sourceNeed: 'Тактильная направляющая полоса по коридору, 46 м.',
      description:
        'Тактильная направляющая полоса ПВХ для помещений, ширина 35 мм, контрастное исполнение, поставка по метражу.',
      productCode: 'VRT-GUIDE-PVC-35',
      productUrl: 'https://tiflocentre.ru/magazin/view_product.php?id=1445',
      unit: 'м',
      quantity: 46,
      unitPrice: 520,
      installationUnitPrice: 760,
      minSalePrice: 625,
      maxSalePrice: 890,
      marketBenchmark: 810,
      reviewStatus: 'готово',
      managerComment: 'Коридорная направляющая полоса сохранена как тактильная ПВХ полоса по метражу.',
    },
    {
      id: 'offer-nav-warning-indicators',
      sourceNeed: 'Индикаторы конусы перед лестницами и дверями, 350 шт.',
      description:
        'Тактильный индикатор предупреждающий конусный для помещений, самоклеящееся исполнение, комплектная поставка 350 шт.',
      productCode: 'VRT-IND-CONE-INT',
      productUrl: 'https://tiflocentre.ru/magazin/view_product.php?id=5011',
      unit: 'шт',
      quantity: 350,
      unitPrice: 74,
      installationUnitPrice: 118,
      minSalePrice: 89,
      maxSalePrice: 138,
      marketBenchmark: 126,
      reviewStatus: 'готово',
      managerComment: 'Количество индикаторов и зона применения соответствуют заявке.',
    },
    {
      id: 'offer-nav-mnemo-800',
      sourceNeed: 'Большая мнемосхема у входа 800x600, 1 шт.',
      description:
        'Мнемосхема тактильная полноцветная с рельефом и шрифтом Брайля, защитное покрытие, формат 800x600 мм.',
      productCode: 'VRT-MNEMO-800-600-BR',
      productUrl: 'https://tiflocentre.ru/magazin/view_product.php?id=4040',
      unit: 'шт',
      quantity: 1,
      unitPrice: 24700,
      installationUnitPrice: 32900,
      minSalePrice: 29640,
      maxSalePrice: 38200,
      marketBenchmark: 35000,
      reviewStatus: 'готово',
      managerComment: 'Грязная заявка просит большую мнемосхему, в КП стоит полноцветная 800x600 с Брайлем.',
    },
    {
      id: 'offer-nav-room-signs',
      sourceNeed: 'Таблички с Брайлем на кабинеты, 18 шт.',
      description:
        'Тактильная навигационная табличка на кабинет с рельефным текстом и шрифтом Брайля, индивидуальная печать.',
      productCode: 'VRT-SIGN-ROOM-BR',
      productUrl: 'https://tiflocentre.ru/magazin/view_product.php?id=2737',
      unit: 'шт',
      quantity: 18,
      unitPrice: 1280,
      installationUnitPrice: 1960,
      minSalePrice: 1540,
      maxSalePrice: 2280,
      marketBenchmark: 2100,
      reviewStatus: 'готово',
      managerComment: 'Количество кабинетов сохранено, изделие уточнено до тактильной таблички с Брайлем.',
    },
    {
      id: 'offer-nav-glass-marking',
      sourceNeed: 'Контрастные круги/полосы на стеклянные двери, 6 дверей.',
      description:
        'Комплект контрастной маркировки для стеклянных дверей: круговые маркеры и горизонтальные полосы для 6 дверных полотен.',
      productCode: 'VRT-GLASS-MARK-06',
      productUrl: 'https://tiflocentre.ru/magazin/view_product.php?id=2829',
      unit: 'компл.',
      quantity: 1,
      unitPrice: 8600,
      installationUnitPrice: 12800,
      minSalePrice: 10320,
      maxSalePrice: 14900,
      marketBenchmark: 13600,
      reviewStatus: 'готово',
      managerComment: 'Запрос на 6 дверей сохранен как комплект маркировки на 6 дверных полотен.',
    },
    {
      id: 'offer-nav-threshold-ramp',
      sourceNeed: 'Пороговые резиновые пандусы 25 мм, ширина 900, 3 шт.',
      description:
        'Пандус пороговый резиновый, высота 25 мм, ширина 900 мм, противоскользящая поверхность.',
      productCode: 'VRT-RAMP-RUB-25-900',
      productUrl: 'https://tiflocentre.ru/magazin/view_product.php?id=6817',
      unit: 'шт',
      quantity: 3,
      unitPrice: 5350,
      installationUnitPrice: 7450,
      minSalePrice: 6420,
      maxSalePrice: 8650,
      marketBenchmark: 7900,
      reviewStatus: 'готово',
      managerComment: 'Размеры порогового пандуса перенесены из заявки.',
    },
    {
      id: 'offer-nav-wireless-call',
      sourceNeed: 'Кнопка вызова у входа с беспроводным приемником, 1 комплект.',
      description:
        'Комплект беспроводной кнопки вызова помощи для входной группы с приемником, индикацией и креплением.',
      productCode: 'VRT-CALL-WL-ENTRY',
      productUrl: 'https://tiflocentre.ru/magazin/view_product.php?id=5754',
      unit: 'компл.',
      quantity: 1,
      unitPrice: 14300,
      installationUnitPrice: 19400,
      minSalePrice: 17160,
      maxSalePrice: 22600,
      marketBenchmark: 20700,
      reviewStatus: 'нужно уточнить',
      managerComment: 'Нужно подтвердить расстояние до приемника и питание.',
    },
    {
      id: 'offer-nav-audio-beacon',
      sourceNeed: 'Звуковой маяк на главный вход, 1 шт.',
      description:
        'Звуковой маяк для обозначения главного входа, программируемое голосовое сообщение, настенное исполнение.',
      productCode: 'VRT-BEACON-AUDIO',
      productUrl: 'https://tiflocentre.ru/magazin/view_product.php?id=497',
      unit: 'шт',
      quantity: 1,
      unitPrice: 15400,
      installationUnitPrice: 21900,
      minSalePrice: 18480,
      maxSalePrice: 25500,
      marketBenchmark: 23300,
      reviewStatus: 'цена требует проверки',
      managerComment: 'Позиция соответствует звуковому маяку входной группы, цену сверить перед выпуском.',
    },
  ])
}

export interface KpDemoScenario {
  id: 'demo-1' | 'demo-2' | 'demo-3'
  title: string
  requestText: string
  offerTable: DemoOfferTable
}

function createDemoScenarioRequest(offerTable: DemoOfferTable) {
  return offerTable.items.map((item) => item.sourceNeed).join('\n')
}

export function getKpDemoScenarios(): KpDemoScenario[] {
  const accessibilityRoute = getDemoOfferTable()
  const sanitaryRoom = getSanitaryRoomDemoOfferTable()
  const navigationEntrance = getNavigationEntranceDemoOfferTable()

  return [
    {
      id: 'demo-1',
      title: 'Доступный маршрут',
      requestText: createDemoScenarioRequest(accessibilityRoute),
      offerTable: accessibilityRoute,
    },
    {
      id: 'demo-2',
      title: 'Санузел МГН',
      requestText: createDemoScenarioRequest(sanitaryRoom),
      offerTable: sanitaryRoom,
    },
    {
      id: 'demo-3',
      title: 'Вход и навигация',
      requestText: createDemoScenarioRequest(navigationEntrance),
      offerTable: navigationEntrance,
    },
  ]
}

function getInitialKpOfferTable(): DemoOfferTable {
  const items: DemoOfferTableItem[] = [
    {
      id: 'offer-battery-casil',
      sourceNeed:
        'Аккумуляторная батарея для лестничного гусеничного подъемника "Барс-УГП 130" - 2 шт.',
      description:
        'Аккумуляторная батарея (CASIL CA12120 2 12 В / 12 Ач, F2 10601042) для лестничного гусеничного подъемника "Барс-УГП 130"',
      productCode: 'CASIL-CA12120',
      unit: 'шт',
      quantity: 2,
      unitPrice: 5619,
      installationUnitPrice: 5619,
      minSalePrice: 5619,
      maxSalePrice: 5619,
      marketBenchmark: 5619,
      reviewStatus: 'готово',
      managerComment: '',
    },
  ]
  const pricedItems = items.map((item) => applyKpPriceAdjustments(item))
  const subtotal = sumOfferAmounts(pricedItems)

  return {
    items: pricedItems,
    totals: [
      {
        id: 'offer-subtotal',
        label: 'ИТОГО',
        productTotal: subtotal.productTotal,
        installationTotal: subtotal.installationTotal,
        grandTotal: subtotal.grandTotal,
        tone: 'subtotal',
      },
    ],
  }
}

function makeCellSource(label: string, sourceType: 'norm' | 'price' | 'photo' | 'note', excerpt: string) {
  return {
    label,
    sourceType,
    excerpt,
    confidence: sourceType === 'price' || sourceType === 'norm' ? ('medium' as const) : ('high' as const),
  }
}

function makeCellAnnotation(
  cellId: DraftCellId,
  sources: ReturnType<typeof makeCellSource>[],
  issue?: DraftCellAnnotation['issue'],
): DraftCellAnnotation {
  return {
    cellId,
    sources,
    issue,
  }
}

function getProductMatchCheck(item: DemoOfferTableItem) {
  const checks: Record<string, string> = {
    'offer-mnemo':
      'Сверить в карточке формат 610x470 мм, наличие рельефа и Брайля, тип защитного покрытия и полноцветное исполнение.',
    'offer-sign-set':
      'Проверить, что в комплект входят 4 пиктограммы именно для входа, направления движения, кнопки вызова и зоны ожидания.',
    'offer-contrast-tape':
      'Сверить ширину 100 мм, желтый цвет, самоклеящуюся основу и пригодность для маркировки ступеней и дверных проемов.',
    'offer-tactile-tile':
      'Проверить размер 300x300 мм, наружное исполнение, полиуретан и предупреждающий тип рифления.',
    'offer-nosing':
      'Сверить длину 1000 мм, алюминиевый профиль, противоскользящую вставку и нужный контрастный цвет.',
    'offer-call-button':
      'Проверить, что это антивандальная кнопка со стойкой, базовой индикацией и подходящим типом питания.',
    'offer-loop':
      'Сверить состав переносного комплекта: усилитель, приемный контур, кабели/зарядка и совместимость с зоной обслуживания.',
    'offer-handrail':
      'Проверить двухуровневое исполнение, нержавеющую сталь, напольное крепление и применимость для марша и площадки.',
  }

  return checks[item.id] ?? `Сверить, что карточка соответствует строке: ${item.description}`
}

function getManagerControlCheck(item: DemoOfferTableItem) {
  const checks: Record<string, string> = {
    'offer-mnemo':
      'Перед выпуском подтвердить макет, адрес/планировку, язык Брайля и срок изготовления у поставщика.',
    'offer-sign-set':
      'Проверить, не нужны ли дополнительные пиктограммы по маршруту и совпадает ли количество с планом объекта.',
    'offer-contrast-tape':
      'Пересчитать фактический метраж по ступеням и дверным проемам, добавить запас на подрезку при необходимости.',
    'offer-tactile-tile':
      'Сверить количество плиток по зонам предупреждения и актуальность представительской цены в личном кабинете.',
    'offer-nosing':
      'Подтвердить количество ступеней, цвет контрастной вставки и способ крепления перед отправкой клиенту.',
    'offer-call-button':
      'Уточнить место установки, питание, необходимость приемника/табло и монтаж к стойке или стене.',
    'offer-loop':
      'Не выпускать без проверки наличия, версии комплекта и цены: позиция чувствительна к составу поставки.',
    'offer-handrail':
      'Подтвердить фактический метраж и тип основания по месту.',
  }

  return checks[item.id] ?? item.managerComment
}

export function getDemoDraftCellAnnotations(
  branch: DemoDocumentType,
): Partial<Record<DraftCellId, DraftCellAnnotation>> {
  if (branch !== 'kp') {
    return {}
  }

  const offerTable = getDemoOfferTable()
  const annotations: Partial<Record<DraftCellId, DraftCellAnnotation>> = {}

  offerTable.items.forEach((item, index) => {
    const productLink = getVerticalProductUrl(item, index)
    const selectionReason = item.productCode
      ? getProductMatchCheck(item)
      : 'Автоподбор не смог уверенно выбрать товар: в потребности не хватает артикула, состава комплекта и параметров монтажа.'
    const controlNote = item.productCode
      ? getManagerControlCheck(item)
      : 'Нужно вручную уточнить состав комплекта и только после этого привязать строку к карточке Вертикаль.'
    const descriptionId = `kp-item:${item.id}:description` as DraftCellId
    const quantityId = `kp-item:${item.id}:quantity` as DraftCellId
    const unitPriceId = `kp-item:${item.id}:unitPrice` as DraftCellId
    const installationPriceId = `kp-item:${item.id}:installationUnitPrice` as DraftCellId
    const productTotalId = `kp-item:${item.id}:productTotal` as DraftCellId
    const installationTotalId = `kp-item:${item.id}:installationTotal` as DraftCellId
    const grandTotalId = `kp-item:${item.id}:grandTotal` as DraftCellId

    annotations[descriptionId] = makeCellAnnotation(descriptionId, [
      makeCellSource('Ссылка на товар', 'price', productLink),
      makeCellSource('Проверить в карточке', 'note', selectionReason),
      makeCellSource('Перед выпуском КП', 'note', controlNote),
    ])

    annotations[quantityId] = makeCellAnnotation(quantityId, [
      makeCellSource('Потребность', 'note', `Количество ${item.quantity} извлечено из исходной потребности.`),
    ])

    annotations[unitPriceId] = makeCellAnnotation(
      unitPriceId,
      [
        makeCellSource('Ссылка на товар', 'price', productLink),
        makeCellSource('Источник цены', 'price', 'Представительская цена подтянута из демо-карточки Вертикаль и показана как будущий формат интеграции.'),
        makeCellSource('Что проверить', 'note', 'Сверить ценовую группу, НДС и актуальность складского остатка перед отправкой клиенту.'),
      ],
      item.id === 'offer-loop'
        ? {
            severity: 'high',
            title: 'Проверить техническое соответствие комплекта',
            summary: 'У переносной индукционной системы в карточке Вертикаль не подтверждены состав комплекта, версия усилителя и тип приемного контура. Без сверки есть риск заложить цену на неполную модификацию.',
          }
        : undefined,
    )

    annotations[installationPriceId] = makeCellAnnotation(
      installationPriceId,
      [
        makeCellSource('Авторасчет', 'note', 'Целевая цена продажи предложена системой и может быть изменена менеджером.'),
      ],
      item.id === 'offer-handrail'
        ? {
            severity: 'medium',
            title: 'Проверить целевую цену',
            summary: 'Цена зависит от фактического метража и выбранного исполнения.',
          }
        : undefined,
    )

    annotations[productTotalId] = makeCellAnnotation(productTotalId, [
      makeCellSource('Авторасчет', 'note', 'Сумма закупки считается автоматически: количество x представительская цена.'),
    ])

    annotations[installationTotalId] = makeCellAnnotation(installationTotalId, [
      makeCellSource('Авторасчет', 'note', 'Сумма продажи считается автоматически: количество x целевая цена продажи.'),
    ])

    annotations[grandTotalId] = makeCellAnnotation(grandTotalId, [
      makeCellSource('Авторасчет', 'note', 'Прибыль по строке считается как разница продажи и закупки.'),
    ])
  })

  offerTable.totals.forEach((total) => {
    const cellId = `kp-total:${total.id}` as DraftCellId
    annotations[cellId] = makeCellAnnotation(cellId, [
      makeCellSource(
        total.tone === 'service' ? 'Служебная надбавка' : 'Авторасчёт',
        'note',
        total.tone === 'service'
          ? 'Значение заведено как отдельная сервисная строка и проверяется вручную.'
          : 'Итоговый блок считается автоматически на основе строк рабочей таблицы КП.',
      ),
    ])
  })

  const dueDateId = 'kp-field:dueDate' as DraftCellId
  annotations[dueDateId] = makeCellAnnotation(
    dueDateId,
    [
      makeCellSource('Коммерческие вводные', 'note', 'Срок действия КП и поставки подтверждается вручную перед отправкой.'),
    ],
    {
      severity: 'medium',
      title: 'Подтвердить наличие',
      summary: 'Перед финальной отправкой нужно сверить доступность ключевых товарных позиций.',
    },
  )

  const specialTermsId = 'kp-field:specialTerms' as DraftCellId
  annotations[specialTermsId] = makeCellAnnotation(
    specialTermsId,
    [
      makeCellSource('Свободные вводные', 'note', 'Формулировка собирается из заметок менеджера и обычно дорабатывается вручную.'),
    ],
    {
      severity: 'low',
      title: 'Упростить формулировку',
      summary: 'Текст лучше держать коротким и однозначным перед экспортом.',
    },
  )

  return annotations
}

const emptyDraft: DemoDraft = {
  id: 'draft-main',
  caseId: 'case-main',
  documentType: 'kp',
  sections: [],
  offerTable: createEmptyOfferTable(),
  fields: blankDraftFields,
  cellAnnotations: {},
  issues: [],
  sources: [],
}

function getTodayLocalDate() {
  const now = new Date()
  const timezoneOffsetMs = now.getTimezoneOffset() * 60 * 1000
  return new Date(now.getTime() - timezoneOffsetMs).toISOString().slice(0, 10)
}

export function createEmptyExportForm() {
  return {
    documentTitle: '1-В',
    counterpartyName: '',
    counterpartyAddress: '',
    objectAddress: '',
    documentDate: getTodayLocalDate(),
    documentNumber: '1-В',
    signatoryName: '',
    manualNotes: '',
  } satisfies DemoState['exportForm']
}

export function createDemoExportForm() {
  return {
    documentTitle: '1-В',
    counterpartyName: 'ООО "Городская среда"',
    counterpartyAddress: 'Москва, ул. Новая Басманная, д. 14, стр. 2',
    objectAddress: 'Москва, Ленинский проспект, д. 52, входная группа поликлиники',
    documentDate: getTodayLocalDate(),
    documentNumber: '1-В',
    signatoryName: 'Иванов Сергей Петрович',
    manualNotes:
      'Пример реквизитов для финального экспорта. В рабочем сценарии эти данные сотрудник уточняет перед выпуском документа.',
  } satisfies DemoState['exportForm']
}

export function createEmptyExportGeneration() {
  return {
    selectedFormat: null,
    status: 'idle',
    progressPercent: 0,
    generatedArtifact: null,
    downloadMessage: null,
  } satisfies DemoState['exportGeneration']
}

export const totalRunDurationMs = runStageBlueprints.kp.reduce(
  (accumulator, stage) => accumulator + stage.durationMs,
  0,
)

export function getRunStageBlueprints(branch: DemoDocumentType) {
  return JSON.parse(JSON.stringify(runStageBlueprints[branch])) as DemoStage[]
}

export function getDefaultSectionId(branch: DemoDocumentType) {
  return branch === 'kp' ? 'kp-overview' : 'tz-overview'
}

export function getDemoNeedText(branch: DemoDocumentType, pipelineName: string) {
  void pipelineName
  if (branch === 'kp') {
    return `Мнемосхема тактильная полноцветная 610x470 мм, рельеф и Брайль - 1 шт.

Тактильные пиктограммы для входа и маршрута - комплект 4 шт.

Контрастная лента желтая, ширина 100 мм - 18 м.

Тактильная плитка предупреждающая наружная 300x300 мм - 24 шт.

Противоскользящие накладки на ступени 1000 мм - 11 шт.

Антивандальная кнопка вызова со стойкой - 1 комплект.

Индукционная система для посетителей с нарушением слуха - 1 комплект.

Двухуровневые поручни из нержавеющей стали - 12,5 м.`
  }

  return `Нужно зафиксировать состав работ по входной группе и маршруту прохода. Требуется убрать мешающие элементы, привести основание и подход к двери в рабочее состояние, предусмотреть безопасное перемещение маломобильных посетителей и исключить резкие перепады по высоте на основном пути движения.

В составе решения нужно отразить демонтаж старых ограждений и повреждённых участков, выравнивание проблемных зон, устройство нового узла прохода, монтаж поручней, обновление покрытия и все сопутствующие работы, без которых результат не будет рабочим. Отдельно нужно учесть материалы и элементы, которые должны быть закуплены для монтажа.

Также нужно обозначить ограничения по объекту: вход действующий, работы желательно выполнять поэтапно, без длительной остановки эксплуатации. Формулировки должны быть прикладными: какие элементы меняем, что именно выполняем на площадке, что должно быть смонтировано в итоге и каким требованиям должен соответствовать готовый результат.`
}

export function getDemoNotes(branch: DemoDocumentType) {
  if (branch === 'kp') {
    return 'КП собрать строго по перечню товаров. Строки с неполным составом и зависимостью от наличия оставить на проверку менеджера перед финальным выпуском.'
  }

  return 'При подготовке ТЗ важно учесть измеримые параметры, рабочее окно монтажа и обязательность нейтральных формулировок без персональных ссылок.'
}

export function getDemoMaterials(): DemoAsset[] {
  return [
    {
      id: 'asset-photo-entrance',
      title: 'Фото входной группы',
      subtitle: 'Общий ракурс объекта',
      kind: 'photo',
      source: 'upload',
      note: 'Помогает быстро показать конфигурацию зоны входа и опорные детали проекта.',
      addedAt: '2026-04-02T09:02:00.000Z',
      previewUrl: '/demo/clinic-entrance.svg',
    },
    {
      id: 'asset-photo-slope',
      title: 'Фото перепада высот',
      subtitle: 'Опорный ракурс для проектной оценки',
      kind: 'photo',
      source: 'upload',
      note: 'Используется как иллюстрация к измеримым параметрам будущего решения.',
      addedAt: '2026-04-02T09:05:00.000Z',
      previewUrl: '/demo/ramp-angle.svg',
    },
    {
      id: 'asset-note-measure',
      title: 'Лист измерений',
      subtitle: 'Рабочий файл',
      kind: 'file',
      source: 'office',
      note: 'Содержит пример нейтральных замеров без адресов, ФИО и контрагентов.',
      addedAt: '2026-04-02T09:11:00.000Z',
      previewUrl: '/demo/plan-sheet.svg',
      fileExtension: 'pdf',
    },
    {
      id: 'asset-photo-detail',
      title: 'Конструктивный узел',
      subtitle: 'Пример детализации для презентации',
      kind: 'photo',
      source: 'system',
      note: 'Показывает, как программа может учитывать важный фрагмент объекта в пакете материалов.',
      addedAt: '2026-04-02T09:16:00.000Z',
      previewUrl: '/demo/handrail-detail.svg',
    },
  ]
}

export function getDemoMeasurements(): DemoMeasurement[] {
  return [
    {
      id: 'measure-height',
      label: 'Перепад высот',
      value: '620',
      unit: 'мм',
      note: 'Ключевой параметр для расчёта конфигурации решения.',
    },
    {
      id: 'measure-width',
      label: 'Ширина прохода',
      value: '1820',
      unit: 'мм',
      note: 'Показывает доступную рабочую ширину зоны.',
    },
    {
      id: 'measure-door',
      label: 'Ширина проёма',
      value: '960',
      unit: 'мм',
      note: 'Нужна для проверки итоговой компоновки.',
    },
    {
      id: 'measure-platform',
      label: 'Длина площадки',
      value: '1480',
      unit: 'мм',
      note: 'Используется для описания зоны маневрирования.',
    },
  ]
}

export function getDemoSourceOptions(): DemoSourceOption[] {
  return [
    {
      id: 'source-route',
      title: 'Базовый сценарий входного маршрута',
      summary: 'Готовый пример КП, на базе которого можно показать переход к техническому заданию.',
      statusLabel: 'Подходит как основа',
      badgeTone: 'ready',
    },
    {
      id: 'source-campus',
      title: 'Общественная входная зона',
      summary: 'Нейтральный рабочий кейс с акцентом на измеримые параметры и структуру решения.',
      statusLabel: 'Рабочий шаблон',
      badgeTone: 'progress',
    },
  ]
}

export function getDemoDraftFields() {
  return blankDraftFields.map((field) => {
    if (field.id === 'dueDate') {
      return { ...field, value: demoFieldDefaults.dueDate }
    }

    return { ...field, value: demoFieldDefaults.specialTerms }
  })
}

export function getDemoDraftSections(
  branch: DemoDocumentType,
  pipelineName: string,
): DraftSection[] {
  void pipelineName

  if (branch === 'kp') {
    return [
      {
        id: 'kp-overview',
        title: '1. Потребность проекта',
        summary: 'Коротко фиксируем, зачем запускается пайплайн и какой результат ожидается.',
        documentType: 'kp',
        content: [
          'Документ собирается как рабочее коммерческое предложение на поставку товаров.',
          'В документе фиксируются исходная потребность, найденные товары, цены и строки, требующие проверки менеджером.',
          'Финальные реквизиты, контрагенты и персональные данные будут добавлены человеком на завершающем этапе.',
        ],
        table: {
          title: 'Сводка потребности',
          columns: ['Позиция', 'Характеристики', 'Ед.', 'Кол-во', 'Комментарий'],
          rows: [
            ['Мнемосхема', 'Полноцветная, рельеф и Брайль, 610x470 мм', 'шт', '1', 'Формат и исполнение заданы'],
            ['Тактильные пиктограммы', 'Комплект для входа и маршрута', 'шт', '4', 'Можно оставить без доп. уточнений'],
            ['Контрастная лента', 'Желтая, ширина 100 мм', 'м', '18', 'Метраж проверить перед выпуском'],
            ['Тактильная плитка', 'Предупреждающая, наружная, 300x300 мм', 'шт', '24', 'Цена требует сверки'],
            ['Поручни и накладки', 'Поручни 12,5 м, накладки 1000 мм - 11 шт.', 'набор', '1', 'Метраж и крепления на уточнение'],
          ],
        },
      },
      {
        id: 'kp-materials',
        title: '2. Подбор товаров',
        summary: 'Отмечаем, какие вводные использовались при подготовке черновика.',
        documentType: 'kp',
        stats: [
          { label: 'Товарные строки', value: '8 позиций' },
          { label: 'Формат', value: 'рабочая таблица КП' },
        ],
        content: [
          'В основу предложения вошел список товаров, количества и ключевые характеристики из потребности.',
          'Система подобрала позиции на Вертикаль и отметила строки, где требуется проверить цену, наличие или состав комплекта.',
        ],
      },
      {
        id: 'kp-conditions',
        title: '3. Коммерческие вводные',
        summary: 'Свободные вводные, которые нужно учесть при генерации и согласовании.',
        documentType: 'kp',
        stats: [
          { label: 'Срок', value: '{{dueDate}}' },
          { label: 'Условия', value: '{{specialTerms}}' },
        ],
        content: [
          'Коммерческая часть собирается в нейтральной форме и ориентируется на внутреннее согласование.',
          'До финального экспорта человек вручную добавляет реквизиты и другие чувствительные данные.',
        ],
      },
    ]
  }

  return [
    {
      id: 'tz-overview',
      title: '1. Основа и техническая цель',
      summary: 'Показываем, из каких вводных строится техническое задание.',
      documentType: 'tz',
      content: [
        'Документ переводится в формат технического задания на базе нейтральной проектной основы.',
        'Документ описывает цель, измеримые параметры и требования к структуре итогового решения.',
      ],
      table: {
        title: 'Контрольные параметры',
        columns: ['Параметр', 'Текущее значение', 'Целевое состояние', 'Примечание'],
        rows: [
          ['Ширина прохода', '1,24 м', 'не уже 1,20 м', 'Оставляем безопасный запас'],
          ['Высота подъема', '0,42 м', 'с плавным набором', 'Без резкого перелома по траектории'],
          ['Площадка перед входом', '1,56 x 1,68 м', 'достаточно для разворота', 'Используется как опорная зона'],
          ['Поручни', 'отсутствуют', 'с двух сторон', 'Закладывается в базовое решение'],
        ],
      },
    },
    {
      id: 'tz-parameters',
      title: '2. Измеримые параметры',
      summary: 'Собираем ключевые значения, которые влияют на проектное решение.',
      documentType: 'tz',
      stats: [
        { label: 'Замеры', value: '4 контрольных параметра' },
        { label: 'Формат', value: 'структурированный черновик ТЗ' },
      ],
      content: [
        'В рабочую версию ТЗ включены ключевые размеры, необходимые для проектной проработки.',
        'Значения остаются обезличенными и используются как пример структуры будущего документа.',
      ],
    },
    {
      id: 'tz-conditions',
      title: '3. Ограничения и вводные',
      summary: 'Фиксируем условия, которые влияют на подготовку и последующую реализацию.',
      documentType: 'tz',
      stats: [
        { label: 'Срок', value: 'до 10 рабочих дней после подтверждения сценария' },
        { label: 'Условия', value: 'работы планируются по согласованному окну без раскрытия персональных данных' },
      ],
      content: [
        'Документ формулируется без упоминания заказчика, контрагента и иных персональных атрибутов.',
        'Чувствительные данные добавляются человеком только после внутренней проверки черновика.',
      ],
    },
  ]
}

export function getDemoDraftIssues(branch: DemoDocumentType): QAFlag[] {
  if (branch === 'kp') {
    return [
      {
        id: 'issue-availability',
        title: 'Подтвердить наличие',
        severity: 'medium',
        summary: 'Стоит ещё раз проверить наличие тактильной плитки, индукционной системы и поручней перед отправкой КП.',
        relatedSectionId: 'kp-conditions',
      },
      {
        id: 'issue-handrail-length',
        title: 'Проверить метраж поручней',
        severity: 'low',
        summary: 'Метраж поручней лучше подтвердить по объекту до финального выпуска.',
        relatedSectionId: 'kp-conditions',
      },
    ]
  }

  return [
    {
      id: 'issue-measurements',
      title: 'Сверить измеримые параметры',
      severity: 'medium',
      summary: 'Перед экспортом ТЗ стоит ещё раз подтвердить комплект контрольных значений.',
      relatedSectionId: 'tz-parameters',
    },
    {
      id: 'issue-limits',
      title: 'Проверить ограничения монтажа',
      severity: 'low',
      summary: 'Рекомендуется перепроверить формулировки условий, влияющих на реализацию проекта.',
      relatedSectionId: 'tz-conditions',
    },
  ]
}

export function getDemoDraftSources(branch: DemoDocumentType): SourceLink[] {
  if (branch === 'kp') {
    return [
      {
        id: 'source-need-list',
        label: 'Потребность',
        sourceType: 'note',
        excerpt: 'Список товаров и количеств использован как основа для рабочей таблицы КП.',
        relatedSectionId: 'kp-overview',
        confidence: 'high',
      },
      {
        id: 'source-vertical',
        label: 'Подбор на Вертикаль',
        sourceType: 'note',
        excerpt: 'Товары, коды и представительские цены подтянуты из рабочего источника Вертикаль.',
        relatedSectionId: 'kp-materials',
        confidence: 'medium',
      },
      {
        id: 'source-terms',
        label: 'Вводные по условиям',
        sourceType: 'note',
        excerpt: 'Комментарий пользователя учитывается в коммерческой части и статусах проверки.',
        relatedSectionId: 'kp-conditions',
        confidence: 'medium',
      },
    ]
  }

  return [
    {
      id: 'source-base',
      label: 'Основа из КП',
      sourceType: 'note',
      excerpt: 'Используется как нейтральная проектная база для формирования ТЗ.',
      relatedSectionId: 'tz-overview',
      confidence: 'high',
    },
    {
      id: 'source-measurements',
      label: 'Контрольные параметры',
      sourceType: 'photo',
      excerpt: 'Замеры и материалы собраны как пример структуры будущего технического пакета.',
      relatedSectionId: 'tz-parameters',
      confidence: 'high',
    },
    {
      id: 'source-limits',
      label: 'Рабочие вводные',
      sourceType: 'norm',
      excerpt: 'Свободные условия помогают показать, как дополнительные ограничения влияют на текст ТЗ.',
      relatedSectionId: 'tz-conditions',
      confidence: 'medium',
    },
  ]
}

export function createInitialDemoState(): DemoState {
  const initialPipelineName = 'Товарное КП'

  return {
    cases: [
      {
        id: 'case-main',
        kpRequestSummary: '',
        kpContextNotes: '',
        kpMaterials: [],
        tzRequestSummary: '',
        tzTechnicalNotes: '',
        tzMeasurements: [],
        runId: 'run-main',
        draftId: 'draft-main',
        exportId: 'export-main',
        isAnchor: true,
      },
    ],
    run: {
      id: 'run-main',
      caseId: 'case-main',
      status: 'idle',
      startedAt: null,
      completedAt: null,
      stages: getRunStageBlueprints('kp'),
    },
    draft: {
      ...(JSON.parse(JSON.stringify(emptyDraft)) as DemoDraft),
      fields: getDemoDraftFields(),
      sections: getDemoDraftSections('kp', initialPipelineName),
      offerTable: getInitialKpOfferTable(),
      cellAnnotations: {},
      issues: [],
      sources: [],
    },
    nextPipelineNumber: 1,
    selectedDocumentType: 'kp',
    selectedSectionId: getDefaultSectionId('kp'),
    focusedIssueId: null,
    exportForm: createEmptyExportForm(),
    exportGeneration: createEmptyExportGeneration(),
    recentOperations: [],
    currentBranchStage: {
      kp: 'editor',
      tz: 'source',
    },
    branchProgress: {
      kp: {
        currentStageId: 'editor',
        completedStageIds: ['need', 'materials', 'comments', 'run'],
      },
      tz: {
        currentStageId: 'source',
        completedStageIds: [],
      },
    },
    selectedSourceKpId: null,
    branchLaunch: {
      kp: {
        started: true,
        pipelineName: initialPipelineName,
      },
      tz: {
        started: false,
        pipelineName: '',
      },
    },
    demoAppliedByPage: {
      'kp-draft': true,
    },
  } satisfies DemoState
}

export function resolveRunStages(run: DemoRun, branch: DemoDocumentType, now = Date.now()) {
  const elapsed =
    run.status === 'completed' || run.completedAt
      ? totalRunDurationMs
      : run.startedAt
        ? Math.max(now - run.startedAt, 0)
        : 0

  let cursor = 0
  const stages = getRunStageBlueprints(branch).map((stage) => {
    const stageStart = cursor
    const stageEnd = stageStart + stage.durationMs
    let status: StageStatus = 'pending'
    let progress = 0

    if (run.status !== 'idle' && run.status !== 'aborted' && elapsed >= stageEnd) {
      status = 'completed'
      progress = 1
    } else if (run.status !== 'idle' && run.status !== 'aborted' && elapsed >= stageStart) {
      status = 'in_progress'
      progress = Math.min((elapsed - stageStart) / stage.durationMs, 1)
    }

    cursor = stageEnd

    return {
      ...stage,
      status,
      progress,
    }
  })

  return {
    stages,
    totalProgress: Math.min(elapsed / totalRunDurationMs, 1),
    activeStage: stages.find((stage) => stage.status === 'in_progress') ?? null,
    isComplete: stages.every((stage) => stage.status === 'completed'),
  }
}

export function createExportArtifact(format: ExportArtifact['format']) {
  const timestamp = new Date().toISOString()
  const stamp = timestamp.replace(/[:.]/g, '-')
  const extension = format === 'XLSX' ? 'xlsx' : format.toLowerCase()

  return {
    id: `export-${format.toLowerCase()}-${stamp}`,
    format,
    fileName: `Вертикаль-КП-${format.toLowerCase()}-${stamp}.${extension}`,
    createdAt: timestamp,
    status: 'generated',
  } satisfies ExportArtifact
}
