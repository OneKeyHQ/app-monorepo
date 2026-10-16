/** @jest-environment jsdom */
import type { ReactNode } from 'react';

import { act, renderHook } from '@testing-library/react';
import { IntlProvider } from 'react-intl';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IWebViewRef } from '@onekeyhq/kit/src/components/WebView/types';
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

import { EMarksUpdateOperationEnum } from '../types';

import { usePerpsTradingViewMessageHandler } from './usePerpsTradingViewMessageHandler';

import type { ITradingMark } from '../types';

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: { serviceHyperliquid: { loadTradesHistory: jest.fn() } },
}));

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms/perps', () => ({
  usePerpsCustomSettingsAtom: () => [{ showTradeMarks: true }],
  usePerpsTradesHistoryRefreshHookAtom: () => [{ refreshHook: 0 }],
  usePerpsLayoutStateAtom: () => [{}, jest.fn()],
}));

jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => {
  const { EventEmitter } =
    jest.requireActual<typeof import('events')>('events');
  return {
    appEventBus: new EventEmitter(),
    EAppEventBusNames: { HyperliquidDataUpdate: 'HyperliquidDataUpdate' },
  };
});

function fill(dir: string, side: IFill['side'], tid: number): IFill {
  return {
    coin: 'SOL',
    px: '146.75',
    sz: '1.25',
    side,
    time: 1_800_000_000_000,
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

it('localizes embedded history, request responses and live marks without losing special directions', async () => {
  let locale = 'en-US';
  let messages: Record<string, string> = enMessages;
  const userAddress = '0x0000000000000000000000000000000000000001';
  const fills = [
    fill('Open Long', 'B', 1),
    fill('Open Short', 'A', 2),
    fill('Close Long', 'A', 3),
    fill('Close Short', 'B', 4),
    fill('Long > Short', 'A', 5),
    fill('Short > Long', 'B', 6),
    fill('Liquidated Cross Long', 'A', 7),
    { ...fill('Open Long', 'B', 8), coin: 'BTC' },
  ];
  jest
    .spyOn(backgroundApiProxy.serviceHyperliquid, 'loadTradesHistory')
    .mockResolvedValue(fills);
  const sendMessage = jest.fn<
    void,
    [
      {
        type: string;
        payload: {
          marks: ITradingMark[];
          operation?: EMarksUpdateOperationEnum;
          requestId?: string;
          symbol?: string;
        };
      },
    ]
  >();
  const webRef: { current: IWebViewRef } = {
    current: {
      sendMessageViaInjectedScript: sendMessage,
      reload: jest.fn(),
      loadURL: jest.fn(),
    },
  };
  const { result, rerender, unmount } = renderHook(
    () =>
      usePerpsTradingViewMessageHandler({ symbol: 'SOL', userAddress, webRef }),
    {
      wrapper: ({ children }: { children: ReactNode }) => (
        <IntlProvider locale={locale} messages={messages}>
          <>{children}</>
        </IntlProvider>
      ),
    },
  );
  await act(async () => {
    await Promise.resolve();
  });
  const englishMarks = sendMessage.mock.calls.at(-1)?.[0].payload.marks;
  expect(englishMarks?.map((mark) => mark.text)).toEqual([
    'Long @ 146.75',
    'Short @ 146.75',
    'Close Long @ 146.75',
    'Close Short @ 146.75',
    'Long > Short @ 146.75',
    'Short > Long @ 146.75',
    'Liquidated Cross Long @ 146.75',
  ]);

  locale = 'zh-CN';
  messages = zhMessages;
  await act(async () => {
    rerender();
    await Promise.resolve();
  });
  const localizedMarks = sendMessage.mock.calls.at(-1)?.[0].payload.marks;
  expect(localizedMarks?.map((mark) => mark.text)).toEqual([
    '做多 @ 146.75',
    '做空 @ 146.75',
    '平多 @ 146.75',
    '平空 @ 146.75',
    'Long > Short @ 146.75',
    'Short > Long @ 146.75',
    'Liquidated Cross Long @ 146.75',
  ]);
  expect(localizedMarks?.map(({ text, ...mark }) => mark)).toEqual(
    englishMarks?.map(({ text, ...mark }) => mark),
  );
  expect(sendMessage).toHaveBeenLastCalledWith({
    type: 'MARKS_UPDATE',
    payload: {
      symbol: 'SOL',
      operation: EMarksUpdateOperationEnum.REPLACE,
      marks: localizedMarks,
    },
  });

  await act(async () => {
    await result.current.customReceiveHandler({
      data: {
        scope: '$private',
        method: 'tradingview_getMarks',
        data: { requestId: 'marks-1' },
      },
    });
  });
  expect(sendMessage).toHaveBeenLastCalledWith({
    type: 'MARKS_RESPONSE',
    payload: { requestId: 'marks-1', marks: localizedMarks },
  });

  sendMessage.mockClear();
  const update = {
    type: EPerpsSubscriptionCategory.ACCOUNT,
    subType: ESubscriptionType.USER_FILLS,
    data: { user: userAddress, fills },
  };
  act(() => {
    appEventBus.emit(EAppEventBusNames.HyperliquidDataUpdate, update);
  });
  expect(sendMessage).toHaveBeenCalledTimes(1);
  expect(sendMessage).toHaveBeenLastCalledWith({
    type: 'MARKS_UPDATE',
    payload: {
      symbol: 'SOL',
      operation: EMarksUpdateOperationEnum.INCREMENTAL,
      marks: localizedMarks,
    },
  });
  unmount();
  appEventBus.emit(EAppEventBusNames.HyperliquidDataUpdate, update);
  expect(sendMessage).toHaveBeenCalledTimes(1);
});
