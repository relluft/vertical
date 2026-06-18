import { getSaleUnitPriceFromPurchase, roundMoneyAmount } from './kpPricing'

export interface VerticalProductLike {
  productCode?: string
  productUrl?: string
  description?: string
  sourceNeed?: string
  unit?: string
  quantity?: number
  unitPrice?: number
  installationUnitPrice?: number
  minSalePrice?: number
  maxSalePrice?: number
  marketBenchmark?: number
}

interface VerticalProductCatalogItem {
  url: string
  name: string
  price: number
  unit: string
  quantity: number
}

export const verticalProductCatalogByCode: Record<string, VerticalProductCatalogItem> = {
  'VRT-610-470-BR': {
    url: 'https://tiflocentre.ru/magazin/view_product.php?id=2318',
    name: 'Тактильная мнемосхема на основании из ABS пластика с имитацией «серебро» и защитным покрытием',
    price: 14458,
    unit: 'шт',
    quantity: 1,
  },
  'VRT-PIC-SET-04': {
    url: 'https://tiflocentre.ru/magazin/view_product.php?id=1772',
    name: 'СП-01 Пиктограмма с дублированием информации по системе Брайля. Доступность для инвалидов всех категорий, полноцвет, ПВХ',
    price: 868,
    unit: 'шт',
    quantity: 4,
  },
  'VRT-TAPE-100-Y': {
    url: 'https://tiflocentre.ru/magazin/view_product.php?id=6261',
    name: 'Лента контрастная для маркировки ступеней и дверей, самоклеящаяся, на подложке, ширина 100мм, (рулон 10 м)',
    price: 939,
    unit: 'шт',
    quantity: 2,
  },
  'VRT-TILE-PU-300': {
    url: 'https://tiflocentre.ru/magazin/view_product.php?id=2483',
    name: 'Плитка тактильная (непреодолимое препятствие, конусы шахматные) 300x300x4, ПУ, желтый, самоклей',
    price: 453,
    unit: 'шт',
    quantity: 24,
  },
  'VRT-NOS-AL-1000': {
    url: 'https://tiflocentre.ru/magazin/view_product.php?id=3893',
    name: 'Накладка светонакопительная, противоскользящая в AL профиле шириной 100мм, с тремя контраст вставками фотолюм/ж/ж',
    price: 1173,
    unit: 'шт',
    quantity: 11,
  },
  'VRT-CALL-AV-STD': {
    url: 'https://tiflocentre.ru/magazin/view_product.php?id=5754',
    name: 'Кнопка для вызова персонала антивандальная из нержавеющей стали с порошковой покраской, K1',
    price: 14814,
    unit: 'шт',
    quantity: 1,
  },
  'VRT-LOOP-MOB': {
    url: 'https://tiflocentre.ru/magazin/view_product.php?id=1526',
    name: 'Портативная индукционная система "VERT-1 MP3"',
    price: 20547,
    unit: 'шт',
    quantity: 1,
  },
  'VRT-HR-SS-2L': {
    url: 'https://tiflocentre.ru/magazin/view_product.php?id=8368',
    name: 'Поручень отбойник пристенный, нержавеющий',
    price: 15361,
    unit: 'шт',
    quantity: 13,
  },
  'VRT-SIGN-ENTRY-BR': {
    url: 'https://tiflocentre.ru/magazin/view_product.php?id=1772',
    name: 'СП-01 Пиктограмма с дублированием информации по системе Брайля. Доступность для инвалидов всех категорий, полноцвет, ПВХ',
    price: 868,
    unit: 'шт',
    quantity: 2,
  },
  'VRT-RAMP-AL-MOB-1200': {
    url: 'https://tiflocentre.ru/magazin/view_product.php?id=277',
    name: 'Пандус перекатной с безопасными бортиками, 50х900х700мм',
    price: 12880,
    unit: 'шт',
    quantity: 1,
  },
  'VRT-HND-FOLD-800': {
    url: 'https://tiflocentre.ru/magazin/view_product.php?id=2430',
    name: 'Поручень опорный для санузла, откидной, со стопорным механизмом, бумагодержателем, креплением к стене, нержавеющая сталь, D38 мм',
    price: 7230,
    unit: 'шт',
    quantity: 2,
  },
  'VRT-HND-WALL-600': {
    url: 'https://tiflocentre.ru/magazin/view_product.php?id=110',
    name: 'Поручень опорный для санузла, без откидного механизма, пристенный, нержавеющая сталь, D38 мм',
    price: 4687,
    unit: 'шт',
    quantity: 4,
  },
  'VRT-HND-COR-700': {
    url: 'https://tiflocentre.ru/magazin/view_product.php?id=7674',
    name: 'Поручень интерьерный угловой, опорный, нержавеющая сталь, D38 мм',
    price: 6682,
    unit: 'шт',
    quantity: 1,
  },
  'VRT-SEAT-SH-FOLD': {
    url: 'https://tiflocentre.ru/magazin/view_product.php?id=4711',
    name: 'Сиденье откидное для душа, с упорами для крепления к стене, нержавеющая сталь',
    price: 13842,
    unit: 'шт',
    quantity: 1,
  },
  'VRT-MIR-TILT-600-800': {
    url: 'https://tiflocentre.ru/magazin/view_product.php?id=7897',
    name: 'Зеркало поворотное для МГН, травмобезопасное, нержавеющая сталь, 800x600 мм',
    price: 17133,
    unit: 'шт',
    quantity: 1,
  },
  'VRT-CALL-WC-CORD': {
    url: 'https://tiflocentre.ru/magazin/view_product.php?id=8378',
    name: 'Кнопка вызова персонала ГОСТ, со шнурком, антивандальная, нержавеющая сталь с порошковой покраской белого цвета',
    price: 8838,
    unit: 'шт',
    quantity: 1,
  },
  'VRT-SIGN-WC-BR': {
    url: 'https://tiflocentre.ru/magazin/view_product.php?id=1789',
    name: 'СП-18 Пиктограмма с дублированием информации по системе Брайля. Туалет для инвалидов, ПВХ',
    price: 868,
    unit: 'шт',
    quantity: 2,
  },
  'VRT-HOLD-CRUTCH': {
    url: 'https://tiflocentre.ru/magazin/view_product.php?id=8090',
    name: 'Крючок-держатель для трости и костылей, М16, нержавеющая сталь',
    price: 1218,
    unit: 'шт',
    quantity: 1,
  },
  'VRT-MIX-ELBOW': {
    url: 'https://tiflocentre.ru/magazin/view_product.php?id=1185',
    name: 'Смеситель локтевой «Локоток» для МГН, с удлиненной рукояткой',
    price: 10843,
    unit: 'шт',
    quantity: 1,
  },
  'VRT-FLOOR-AS-WET': {
    url: 'https://tiflocentre.ru/magazin/view_product.php?id=6734',
    name: 'Покрытие из ПВХ «ТифлоПол-15» грязезащитное противоскользящее, тип 1, размер 300x300х15 мм, цвет жёлтый',
    price: 520,
    unit: 'шт',
    quantity: 8,
  },
  'VRT-WC-MGN-LONG': {
    url: 'https://tiflocentre.ru/magazin/view_product.php?id=2936',
    name: 'Унитаз-компакт керамический с косым выпуском, с увеличенной высотой, белый',
    price: 16541,
    unit: 'шт',
    quantity: 1,
  },
  'VRT-SINK-MGN-FRONT': {
    url: 'https://tiflocentre.ru/magazin/view_product.php?id=1180',
    name: 'Раковина для МГН санитарная керамика с отверстием под смеситель, белая',
    price: 6936,
    unit: 'шт',
    quantity: 1,
  },
  'VRT-SIPHON-FLAT-MGN': {
    url: 'https://tiflocentre.ru/magazin/view_product.php?id=5256',
    name: 'Поручень опорный для защиты слива раковины, нержавеющая сталь с полиамидными окончаниями, D32 мм',
    price: 9153,
    unit: 'шт',
    quantity: 1,
  },
  'VRT-DISP-SOAP-SENS': {
    url: 'https://tiflocentre.ru/magazin/view_product.php?id=1189',
    name: 'Дозатор сенсорный для жидкого мыла и антисептика, ABS пластик, объем 1100 мл, белый',
    price: 4250,
    unit: 'шт',
    quantity: 1,
  },
  'VRT-HOLD-PAPER-WC': {
    url: 'https://tiflocentre.ru/magazin/view_product.php?id=5762',
    name: 'Поручень для унитаза напольный съёмный, со стопорным откидным механизмом и бумагодержателем, нержавеющая сталь, D38 мм',
    price: 21797,
    unit: 'шт',
    quantity: 1,
  },
  'VRT-HOOK-WALL-MGN': {
    url: 'https://tiflocentre.ru/magazin/view_product.php?id=1197',
    name: 'Крючок-держатель для костылей, трости, одежды, М2, силумин',
    price: 316,
    unit: 'шт',
    quantity: 2,
  },
  'VRT-DRYER-HAND-SENS': {
    url: 'https://tiflocentre.ru/magazin/view_product.php?id=5555',
    name: 'Сушилка для рук автоматическая, адаптивная, с голосовым сопровождением, VRT-2000, нержавеющая сталь, белая',
    price: 39218,
    unit: 'шт',
    quantity: 1,
  },
  'VRT-HANDLE-DOOR-400': {
    url: 'https://tiflocentre.ru/magazin/view_product.php?id=400',
    name: 'Поручень опорный, двойной, настенно-напольный, сталь, D38 мм',
    price: 6167,
    unit: 'шт',
    quantity: 1,
  },
  'VRT-GUIDE-PVC-35': {
    url: 'https://tiflocentre.ru/magazin/view_product.php?id=1445',
    name: 'Лента тактильная направляющая, ВхШхГ 3х29х1000, материал - ПВХ, желтого цвета',
    price: 98,
    unit: 'м',
    quantity: 46,
  },
  'VRT-IND-CONE-INT': {
    url: 'https://tiflocentre.ru/magazin/view_product.php?id=5011',
    name: 'Конус гладкий, без штифта, D35x35, H-4мм, I-0мм, PU, желтый (преодолимое препятствие, непреодолимое препятствие)',
    price: 15,
    unit: 'шт',
    quantity: 350,
  },
  'VRT-MNEMO-800-600-BR': {
    url: 'https://tiflocentre.ru/magazin/view_product.php?id=4040',
    name: 'Мнемосхема тактильная для установки внутри помещений, на основе ПВХ 3мм',
    price: 9752,
    unit: 'шт',
    quantity: 1,
  },
  'VRT-SIGN-ROOM-BR': {
    url: 'https://tiflocentre.ru/magazin/view_product.php?id=2737',
    name: 'Тактильная табличка Брайлем (монохром) на ПВХ 3 мм. Размер 100 х 300 мм',
    price: 936,
    unit: 'шт',
    quantity: 18,
  },
  'VRT-GLASS-MARK-06': {
    url: 'https://tiflocentre.ru/magazin/view_product.php?id=2829',
    name: 'Круг для контрастной маркировки дверных проемов, 100мм, желтый',
    price: 28,
    unit: 'шт',
    quantity: 12,
  },
  'VRT-RAMP-RUB-25-900': {
    url: 'https://tiflocentre.ru/magazin/view_product.php?id=6817',
    name: 'Наклонный модульный пандус для инвалидов колясочников, 20х700х200 мм',
    price: 2121,
    unit: 'шт',
    quantity: 3,
  },
  'VRT-CALL-WL-ENTRY': {
    url: 'https://tiflocentre.ru/magazin/view_product.php?id=5754',
    name: 'Кнопка для вызова персонала антивандальная из нержавеющей стали с порошковой покраской, K1',
    price: 14814,
    unit: 'шт',
    quantity: 1,
  },
  'VRT-BEACON-AUDIO': {
    url: 'https://tiflocentre.ru/magazin/view_product.php?id=497',
    name: 'Звуковой маяк «VERTICAL-1/14/IR»',
    price: 20259,
    unit: 'шт',
    quantity: 1,
  },
}

export const verticalProductUrlsByCode = Object.fromEntries(
  Object.entries(verticalProductCatalogByCode).map(([code, item]) => [code, item.url]),
)

const dirtyProductNeedsByCode: Record<string, string> = {
  'VRT-610-470-BR': 'мнемосхема серебристая с брайлем - 1 шт',
  'VRT-PIC-SET-04': 'пиктограмма доступность СП-01 - 4 шт',
  'VRT-TAPE-100-Y': 'желтая контрастная лента 100 мм, рулоны - 2 шт',
  'VRT-TILE-PU-300': 'плитка тактильная желтая 300 на 300 самоклей - 24 шт',
  'VRT-NOS-AL-1000': 'накладки на ступени светящиеся желтые - 11 шт',
  'VRT-CALL-AV-STD': 'кнопка вызова антивандальная K1 - 1 шт',
  'VRT-LOOP-MOB': 'переносная индукционная система верт 1 - 1 шт',
  'VRT-HR-SS-2L': 'нержавеющий отбойник-поручень на стену - 13 шт',
  'VRT-SIGN-ENTRY-BR': 'табличка доступность для инвалидов СП-01 - 2 шт',
  'VRT-RAMP-AL-MOB-1200': 'перекатной пандус маленький 900 на 700 - 1 шт',
  'VRT-HND-FOLD-800': 'откидной поручень в санузел с держателем бумаги - 2 шт',
  'VRT-HND-WALL-600': 'обычный пристенный поручень нерж для санузла - 4 шт',
  'VRT-HND-COR-700': 'угловой поручень нержавейка - 1 шт',
  'VRT-SEAT-SH-FOLD': 'сиденье в душ откидное - 1 шт',
  'VRT-MIR-TILT-600-800': 'зеркало поворотное 800 на 600 - 1 шт',
  'VRT-CALL-WC-CORD': 'кнопка вызова со шнурком белая - 1 шт',
  'VRT-SIGN-WC-BR': 'пиктограмма туалет для инвалидов СП-18 - 2 шт',
  'VRT-HOLD-CRUTCH': 'крючок под трость и костыли - 1 шт',
  'VRT-MIX-ELBOW': 'смеситель локтевой локоток - 1 шт',
  'VRT-FLOOR-AS-WET': 'желтый тифлопол модуль 300х300 - 8 шт',
  'VRT-WC-MGN-LONG': 'унитаз высокий для МГН - 1 шт',
  'VRT-SINK-MGN-FRONT': 'раковина МГН белая с отверстием - 1 шт',
  'VRT-SIPHON-FLAT-MGN': 'поручень защита слива под раковиной - 1 шт',
  'VRT-DISP-SOAP-SENS': 'сенсорный дозатор мыла белый - 1 шт',
  'VRT-HOLD-PAPER-WC': 'поручень с бумагодержателем к унитазу - 1 шт',
  'VRT-HOOK-WALL-MGN': 'крючки для костылей/одежды М2 - 2 шт',
  'VRT-DRYER-HAND-SENS': 'сушилка для рук автоматическая белая - 1 шт',
  'VRT-HANDLE-DOOR-400': 'двойной опорный поручень стальной - 1 шт',
  'VRT-GUIDE-PVC-35': 'желтая направляющая лента ПВХ по коридору - 46 м',
  'VRT-IND-CONE-INT': 'желтые конусы тактильные без штифта - 350 шт',
  'VRT-MNEMO-800-600-BR': 'мнемосхема внутренняя на ПВХ - 1 шт',
  'VRT-SIGN-ROOM-BR': 'таблички Брайлем на кабинеты 100х300 - 18 шт',
  'VRT-GLASS-MARK-06': 'желтые круги на стеклянные двери 100 мм - 12 шт',
  'VRT-RAMP-RUB-25-900': 'модульный пандус наклонный 20 мм - 3 шт',
  'VRT-CALL-WL-ENTRY': 'кнопка вызова K1 на вход - 1 шт',
  'VRT-BEACON-AUDIO': 'звуковой маяк vertical вход - 1 шт',
}

function formatQuantityForSource(value: number) {
  return Number.isInteger(value) ? String(value) : String(value).replace('.', ',')
}

function getSourceNeed(code: string | undefined, catalogItem: VerticalProductCatalogItem) {
  if (code && dirtyProductNeedsByCode[code]) {
    return dirtyProductNeedsByCode[code]
  }

  return `${catalogItem.name} - ${formatQuantityForSource(catalogItem.quantity)} ${catalogItem.unit}.`
}

export function resolveVerticalProductUrl(item: VerticalProductLike, index = 0) {
  const mappedUrl = item.productCode ? verticalProductCatalogByCode[item.productCode]?.url : undefined

  if (mappedUrl) {
    return mappedUrl
  }

  if (item.productUrl) {
    return item.productUrl
  }

  const query = item.description || item.productCode || `позиция ${index + 1}`
  return `https://tiflocentre.ru/magazin/search.php?q=${encodeURIComponent(query)}`
}

export function attachVerticalProductData<T extends VerticalProductLike>(item: T): T {
  const catalogItem = item.productCode ? verticalProductCatalogByCode[item.productCode] : undefined

  if (!catalogItem) {
    return item
  }

  const currentSaleUnitPrice = Number.isFinite(item.installationUnitPrice)
    ? Math.max(0, item.installationUnitPrice ?? 0)
    : 0
  const currentPurchaseUnitPrice = Number.isFinite(item.unitPrice) ? Math.max(0, item.unitPrice ?? 0) : 0
  const purchaseUnitPrice =
    currentPurchaseUnitPrice > 0 && (!currentSaleUnitPrice || currentPurchaseUnitPrice < currentSaleUnitPrice)
      ? currentPurchaseUnitPrice
      : catalogItem.price
  const saleUnitPrice =
    currentSaleUnitPrice > purchaseUnitPrice
      ? currentSaleUnitPrice
      : getSaleUnitPriceFromPurchase(purchaseUnitPrice)
  const minSalePrice =
    item.minSalePrice && item.minSalePrice > purchaseUnitPrice
      ? item.minSalePrice
      : roundMoneyAmount(saleUnitPrice * 0.92)
  const maxSalePrice =
    item.maxSalePrice && item.maxSalePrice > minSalePrice
      ? item.maxSalePrice
      : roundMoneyAmount(saleUnitPrice * 1.14)
  const marketBenchmark =
    item.marketBenchmark && item.marketBenchmark > purchaseUnitPrice ? item.marketBenchmark : saleUnitPrice

  return {
    ...item,
    productUrl: catalogItem.url,
    sourceNeed: getSourceNeed(item.productCode, catalogItem),
    description: catalogItem.name,
    unit: item.unit || catalogItem.unit,
    quantity: item.quantity && item.quantity > 0 ? item.quantity : catalogItem.quantity,
    unitPrice: purchaseUnitPrice,
    installationUnitPrice: saleUnitPrice,
    minSalePrice,
    maxSalePrice,
    marketBenchmark,
  }
}
