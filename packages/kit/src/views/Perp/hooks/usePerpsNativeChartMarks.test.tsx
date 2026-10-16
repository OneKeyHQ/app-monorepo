/** @jest-environment jsdom */
import type { ReactNode } from 'react';

import { act, renderHook } from '@testing-library/react';
import { IntlProvider } from 'react-intl';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import enMessages from '@onekeyhq/shared/src/locale/json/en_US.json';
import zhMessages from '@onekeyhq/shared/src/locale/json/zh_CN.json';
import type { IFill } from '@onekeyhq/shared/types/hyperliquid/sdk';
import {
  EPerpsSubscriptionCategory,
  ESubscriptionType,
} from '@onekeyhq/shared/types/hyperliquid/types';

import { usePerpsNativeChartMarks } from './usePerpsNativeChartMarks';

const mockAccountAddress = '0x0000000000000000000000000000000000000001';

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: { serviceHyperliquid: { loadTradesHistory: jest.fn() } },
}));

jest.mock('@onekeyhq/kit/src/hooks/useNetworkRestore', () => ({
  useNetworkRestore: () => ({ restoreNonce: 0 }),
}));

jest.mock('@onekeyhq/kit/src/states/jotai/contexts/hyperliquid', () => ({
  useActiveTradeInstrumentAtom: () => [{ mode: 'perp', coin: 'SOL' }],
}));

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  usePerpsActiveAccountAtom: () => [{ accountAddress: mockAccountAddress }],
  usePerpsCustomSettingsAtom: () => [{ showTradeMarks: true }],
  usePerpsTradesHistoryRefreshHookAtom: () => [{ refreshHook: 0 }],
}));

jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => {
  const { EventEmitter } =
    jest.requireActual<typeof import('events')>('events');
  return {
    appEventBus: new EventEmitter(),
    EAppEventBusNames: {
      HyperliquidDataUpdate: 'HyperliquidDataUpdate',
      PerpsWebSocketRecovered: 'PerpsWebSocketRecovered',
    },
  };
});

function fill(dir: string, side: IFill['side'], tid: number): IFill {
  return {
    coin: 'SOL',
    px: '146.75',
    sz: '1.25',
    side,
    time: 1_800_000_000_000 + tid * 1000,
    startPosition: '0',
    dir,
    closedPnl: '0',
    hash: '0x1234',
    oid: tid,
    tid,
    crossed: false,
    fee: '0.01',
    feeToken: 'USDC',
    twapId: null,
  };
}

it('relocalizes loaded and live fills immediately without reloading history', async () => {
  let locale = 'en-US';
  let messages: Record<string, string> = enMessages;
  const loadHistory = jest.spyOn(
    backgroundApiProxy.serviceHyperliquid,
    'loadTradesHistory',
  );
  const fills = [
    fill('Open Long', 'B', 1),
    fill('Open Short', 'A', 2),
    fill('Close Long', 'A', 3),
    fill('Close Short', 'B', 4),
  ];
  loadHistory.mockResolvedValue(fills);
  const { result, rerender } = renderHook(usePerpsNativeChartMarks, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <IntlProvider locale={locale} messages={messages}>
        <>{children}</>
      </IntlProvider>
    ),
  });
  await act(async () => {
    await Promise.resolve();
  });
  const originalMarks = result.current[0].props.marks;
  expect(originalMarks.map((mark) => mark.text)).toEqual([
    'Long\n1.25 @ 146.75',
    'Short\n1.25 @ 146.75',
    'Close Long\n1.25 @ 146.75',
    'Close Short\n1.25 @ 146.75',
  ]);

  locale = 'zh-CN';
  messages = zhMessages;
  rerender();
  expect(result.current[0].props.marks.map((mark) => mark.text)).toEqual([
    '做多\n1.25 @ 146.75',
    '做空\n1.25 @ 146.75',
    '平多\n1.25 @ 146.75',
    '平空\n1.25 @ 146.75',
  ]);
  expect(
    result.current[0].props.marks.map(({ text, ...mark }) => mark),
  ).toEqual(originalMarks.map(({ text, ...mark }) => mark));
  const liveFill = fill('Open Long', 'B', 5);
  act(() => {
    appEventBus.emit(EAppEventBusNames.HyperliquidDataUpdate, {
      type: EPerpsSubscriptionCategory.ACCOUNT,
      subType: ESubscriptionType.USER_FILLS,
      data: { user: mockAccountAddress, fills: [fills[3], liveFill] },
    });
  });
  expect(result.current[0].props.marks).toHaveLength(5);
  expect(result.current[0].props.marks[4].text).toBe('做多\n1.25 @ 146.75');
  expect(loadHistory).toHaveBeenCalledTimes(1);
});
