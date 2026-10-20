/** @jest-environment jsdom */

import { act, renderHook } from '@testing-library/react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EModalRoutes, ETabRoutes } from '@onekeyhq/shared/src/routes';
import { EModalPerpRoutes } from '@onekeyhq/shared/src/routes/perp';

import { usePerpsNavigation } from './usePerpsNavigation';

const mockNavigation = {
  switchTab: jest.fn(),
  pushModal: jest.fn(),
};
const mockConfig = { perpDisabled: false, perpTabShowWeb: false };
const mockMedia = { gtMd: false };
const mockSettings = {
  ready: jest.fn(async () => undefined),
  get: jest.fn(async () => ({ mobileTradingMode: 'simple' })),
};
const mockService = {
  setPendingInitialTradeInstrument: jest.fn(async () => undefined),
  changeActiveAsset: jest.fn(async () => undefined),
};
const mockSetTradeTarget = jest
  .fn<Promise<void>, [{ coin: string; requestId: string }]>()
  .mockResolvedValue(undefined);
const mockCommitTradeTarget = jest.fn(async () => true);
const mockEmit = jest.fn<void, unknown[]>();

jest.mock('../utils/marketDetailNavigation', () => ({
  dismissDiscoveryMarketDetailForTrade: jest.fn(),
}));
jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('@onekeyhq/components', () => ({
  Toast: { error: jest.fn() },
  useMedia: () => mockMedia,
  rootNavigationRef: { current: null },
}));
jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => mockNavigation,
}));
jest.mock('@onekeyhq/kit/src/hooks/usePerpTabConfig', () => ({
  usePerpTabConfig: () => mockConfig,
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  get perpsCustomSettingsAtom() {
    return mockSettings;
  },
}));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    get serviceHyperliquid() {
      return mockService;
    },
    get serviceWebviewPerp() {
      return {
        setTradeTarget: mockSetTradeTarget,
        commitTradeTarget: mockCommitTradeTarget,
      };
    },
  },
}));
jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  appEventBus: { emit: (...args: unknown[]) => mockEmit(...args) },
}));
jest.mock('@onekeyhq/shared/src/logger/scopes/perp/perpPageSource', () => ({
  EPerpPageEnterSource: { MarketList: 'MarketList' },
  setPerpPageEnterSource: jest.fn(),
}));
jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: { app: { error: { log: jest.fn() } } },
}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: true },
}));

async function navigate(coin = 'STRK') {
  const { result } = renderHook(() => usePerpsNavigation());
  await act(async () => {
    result.current.navigateToPerps(coin);
    await jest.runAllTimersAsync();
  });
}

describe('market entry into Perps', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockConfig.perpDisabled = false;
    mockConfig.perpTabShowWeb = false;
    mockMedia.gtMd = false;
    platformEnv.isNative = true;
    mockSettings.get.mockResolvedValue({ mobileTradingMode: 'simple' });
  });

  afterEach(() => jest.useRealTimers());

  it('opens the selected Easy market after switching tab and asset', async () => {
    await navigate('xyz:TSLA');
    expect(mockNavigation.switchTab).toHaveBeenCalledWith(ETabRoutes.Perp);
    expect(mockService.changeActiveAsset).toHaveBeenCalledWith({
      coin: 'xyz:TSLA',
    });
    expect(mockNavigation.pushModal).toHaveBeenCalledWith(
      EModalRoutes.PerpModal,
      {
        screen: EModalPerpRoutes.MobilePerpSimpleMarket,
        params: { coin: 'xyz:TSLA' },
      },
    );
    expect(mockSettings.ready).toHaveBeenCalledTimes(1);
    expect(
      mockService.changeActiveAsset.mock.invocationCallOrder[0],
    ).toBeLessThan(mockNavigation.pushModal.mock.invocationCallOrder[0]);
  });

  it('keeps Pro on its trading page', async () => {
    mockSettings.get.mockResolvedValue({ mobileTradingMode: 'pro' });
    await navigate();
    expect(mockService.changeActiveAsset).toHaveBeenCalledWith({
      coin: 'STRK',
    });
    expect(mockNavigation.pushModal).not.toHaveBeenCalled();
  });

  it('does not open mobile Easy details on wide web', async () => {
    platformEnv.isNative = false;
    mockMedia.gtMd = true;
    await navigate();
    expect(mockNavigation.pushModal).not.toHaveBeenCalled();
  });

  it('opens Easy details on narrow web', async () => {
    platformEnv.isNative = false;
    await navigate();
    expect(mockNavigation.pushModal).toHaveBeenCalledTimes(1);
  });

  it('preserves the Web Perps target flow', async () => {
    mockConfig.perpTabShowWeb = true;
    await navigate();
    expect(mockSetTradeTarget).toHaveBeenCalledWith({
      coin: 'STRK',
      requestId: expect.any(String),
    });
    expect(mockNavigation.switchTab).toHaveBeenCalledWith(
      ETabRoutes.WebviewPerpTrade,
      expect.objectContaining({
        screen: ETabRoutes.WebviewPerpTrade,
        params: {
          tradeRequest: {
            requestId: expect.any(String),
            expiresAt: expect.any(Number),
          },
        },
      }),
    );
    expect(mockCommitTradeTarget).toHaveBeenCalledWith({
      requestId: mockSetTradeTarget.mock.calls[0][0].requestId,
    });
    expect(mockNavigation.pushModal).not.toHaveBeenCalled();
    expect(mockService.changeActiveAsset).not.toHaveBeenCalled();
  });

  it('does not open details when switching the asset fails', async () => {
    const log = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    try {
      mockService.changeActiveAsset.mockRejectedValueOnce(
        new Error('unavailable'),
      );
      await navigate();
      expect(mockNavigation.pushModal).not.toHaveBeenCalled();
    } finally {
      log.mockRestore();
    }
  });

  it('ignores disabled Perps and empty targets', async () => {
    await navigate(' ');
    mockConfig.perpDisabled = true;
    await navigate();
    expect(mockNavigation.switchTab).not.toHaveBeenCalled();
    expect(mockNavigation.pushModal).not.toHaveBeenCalled();
  });
});
