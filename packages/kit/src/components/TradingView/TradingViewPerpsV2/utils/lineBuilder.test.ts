import { createIntl } from 'react-intl';

import enCatalog from '@onekeyhq/shared/src/locale/json/en_US.json';
import zhCatalog from '@onekeyhq/shared/src/locale/json/zh_CN.json';
import type {
  IPerpsAssetPosition,
  IPerpsFrontendOrder,
} from '@onekeyhq/shared/types/hyperliquid/sdk';

import { buildAllLinesForSymbol, buildTpSlLine } from './lineBuilder';

const enMessages: Record<string, string> = enCatalog;
const zhMessages: Record<string, string> = zhCatalog;
const en = createIntl({ locale: 'en-US', messages: enMessages });
const zh = createIntl({ locale: 'zh-CN', messages: zhMessages });
const position: IPerpsAssetPosition = {
  type: 'oneWay',
  position: {
    coin: 'SOL',
    szi: '1.25',
    entryPx: '145.50',
    liquidationPx: '120.25',
    unrealizedPnl: '-0.001',
    leverage: { type: 'cross', value: 5 },
    positionValue: '181.875',
    returnOnEquity: '0',
    marginUsed: '36.375',
    maxLeverage: 20,
    cumFunding: { allTime: '0', sinceOpen: '0', sinceChange: '0' },
  },
};

function order(overrides: Partial<IPerpsFrontendOrder>): IPerpsFrontendOrder {
  return {
    coin: 'SOL',
    side: 'A',
    limitPx: '146.75',
    sz: '1.25',
    origSz: '1.25',
    oid: 1,
    timestamp: 1_800_000_000_000,
    orderType: 'Limit',
    isTrigger: false,
    triggerCondition: '',
    triggerPx: '0',
    isPositionTpsl: false,
    reduceOnly: false,
    children: [],
    tif: 'Gtc',
    cloid: null,
    ...overrides,
  };
}

it('localizes all seven line labels while preserving prices, signed PnL and order identity', () => {
  const orders = [
    order({}),
    order({
      oid: 2,
      orderType: 'Take Profit Market',
      isTrigger: true,
      triggerCondition: 'Price above 146.75',
      triggerPx: '146.75',
    }),
    order({
      oid: 3,
      orderType: 'Stop Market',
      isTrigger: true,
      triggerCondition: 'Price below 143.85',
      triggerPx: '143.85',
    }),
    order({
      oid: 4,
      orderType: 'Take Profit Limit',
      isTrigger: true,
      triggerCondition: 'Price above 146.50',
      triggerPx: '146.50',
    }),
    order({
      oid: 5,
      orderType: 'Stop Limit',
      isTrigger: true,
      limitPx: '143.85',
      triggerCondition: 'Price below 144.00',
      triggerPx: '144.00',
    }),
  ];
  const english = buildAllLinesForSymbol([position], orders, 'SOL', 2, en);
  const chinese = buildAllLinesForSymbol([position], orders, 'SOL', 2, zh);

  expect(english.map((line) => line.label?.left)).toEqual([
    'Liq. Price',
    'PNL -$0.00',
    'Limit 146.75',
    'TP Price > 146.75',
    'SL Price < 143.85',
    'Take Profit Limit 146.75 Price > 146.50',
    'Stop Limit 143.85 Price < 144.00',
  ]);
  expect(chinese.map((line) => line.label?.left)).toEqual([
    '强平价格',
    '盈亏 -$0.00',
    '限价单 146.75',
    '止盈价格 > 146.75',
    '止损价格 < 143.85',
    '限价止盈 146.75 价格 > 146.50',
    '限价止损 143.85 价格 < 144.00',
  ]);
  expect(chinese.map(({ label, version, ...line }) => line)).toEqual(
    english.map(({ label, version, ...line }) => line),
  );
  expect(chinese.map((line) => line.price)).toEqual([
    '120.25',
    '145.5',
    '146.75',
    '146.75',
    '143.85',
    '146.5',
    '144',
  ]);
});

it.each([
  ['Trigger', '止盈价格 > 146.50'],
  ['Trigger Limit', '限价止盈 146.75 价格 > 146.50'],
])(
  'keeps %s position TP/SL labels consistent with their execution type',
  (orderType, label) => {
    // Hyperliquid can return Trigger types beyond the SDK's orderType union.
    const triggerOrder = {
      ...order({
        isTrigger: true,
        isPositionTpsl: true,
        sz: '0',
        triggerCondition: 'Price above 146.50',
        triggerPx: '146.50',
      }),
      orderType,
    } as IPerpsFrontendOrder;
    expect(buildTpSlLine(triggerOrder, 2, 'SOL', zh, '1.25')).toMatchObject({
      kind: 'tp',
      price: '146.5',
      qty: '1.25',
      label: { left: label },
    });
  },
);
