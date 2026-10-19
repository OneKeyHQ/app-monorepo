import { ENotificationPushMessageMode } from '../../types/notification';
import appGlobals from '../appGlobals';
import { EAppEventBusNames, appEventBus } from '../eventBus/appEventBus';
import { ETranslations } from '../locale';
import platformEnv from '../platformEnv';
import {
  ERootRoutes,
  ETabDiscoveryRoutes,
  ETabMarketRoutes,
  ETabRoutes,
} from '../routes';

import {
  navigateToNotificationDetailByLocalParams,
  parseNotificationPayload,
} from './notificationsUtils';
import timerUtils from './timerUtils';

const mockLog = jest.fn<void, unknown[]>();

jest.mock('../logger/logger', () => ({
  defaultLogger: {
    app: { error: { log: (...args: unknown[]) => mockLog(...args) } },
  },
}));

jest.mock('@react-navigation/native', () => ({
  CommonActions: {
    reset: jest.fn((state: unknown) => ({ type: 'RESET', payload: state })),
  },
  StackActions: {
    push: jest.fn((screen: string, params: unknown) => ({
      type: 'PUSH',
      payload: { screen, params },
    })),
  },
}));

jest.mock('../eventBus/appEventBus', () => ({
  EAppEventBusNames: {
    ShowNotificationInDappPage: 'show-dapp',
    SwitchDiscoveryTabInNative: 'SwitchDiscoveryTabInNative',
    ShowNotificationPageNavigation: 'ShowNotificationPageNavigation',
  },
  appEventBus: {
    emit: jest.fn(),
    on: jest.fn(),
  },
}));

jest.mock('./openUrlUtils', () => ({
  openUrlExternal: jest.fn(),
}));

jest.mock('./timerUtils', () => ({
  __esModule: true,
  default: {
    wait: jest.fn(async () => undefined),
  },
}));

const mockAppEventBus = appEventBus as typeof appEventBus & {
  emit: jest.Mock;
};

describe('navigateToNotificationDetailByLocalParams (Native Market & Discovery routing)', () => {
  const navigateMock = jest.fn();
  const getRootStateMock = jest.fn(() => ({
    routes: [{ name: ERootRoutes.Main }],
    index: 0,
  }));
  const getEarnAccountMock = jest.fn(async () => null);
  const originalNavigationRef = appGlobals.$navigationRef;
  const originalTabletMainViewNavigationRef =
    appGlobals.$tabletMainViewNavigationRef;
  const originalIsNative = platformEnv.isNative;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    platformEnv.isNative = true;
    (timerUtils.wait as jest.Mock).mockResolvedValue(undefined);
    appGlobals.$tabletMainViewNavigationRef = undefined as never;
    appGlobals.$navigationRef = {
      current: {
        navigate: navigateMock,
        getRootState: getRootStateMock,
        dispatch: jest.fn(),
      },
    } as never;
  });

  afterEach(() => {
    jest.useRealTimers();
    platformEnv.isNative = originalIsNative;
    appGlobals.$navigationRef = originalNavigationRef;
    appGlobals.$tabletMainViewNavigationRef =
      originalTabletMainViewNavigationRef;
  });

  it('keeps ETabRoutes.Market payloads on the standalone Market tab on native', async () => {
    await navigateToNotificationDetailByLocalParams({
      payload: {
        screen: ERootRoutes.Main,
        params: {
          screen: ETabRoutes.Market,
          params: {
            screen: ETabMarketRoutes.MarketDetailV2,
            params: { marketTokenId: 'bitcoin' },
          },
        },
      },
      localParams: {},
      getEarnAccount: getEarnAccountMock,
    });

    jest.runAllTimers();

    expect(navigateMock).toHaveBeenCalledWith(
      ERootRoutes.Main,
      {
        screen: ETabRoutes.Market,
        params: {
          screen: ETabMarketRoutes.MarketDetailV2,
          params: { marketTokenId: 'bitcoin' },
        },
      },
      { pop: true },
    );
    expect(mockAppEventBus.emit).not.toHaveBeenCalled();
  });

  it('redirects legacy Discovery-embedded Market detail notification payloads to ETabRoutes.Market on native', async () => {
    await navigateToNotificationDetailByLocalParams({
      payload: {
        screen: ERootRoutes.Main,
        params: {
          screen: ETabRoutes.Discovery,
          params: {
            screen: ETabMarketRoutes.MarketDetailV2,
            params: { marketTokenId: 'ethereum' },
          },
        },
      },
      localParams: {},
      getEarnAccount: getEarnAccountMock,
    });

    jest.runAllTimers();

    expect(navigateMock).toHaveBeenCalledWith(
      ERootRoutes.Main,
      {
        screen: ETabRoutes.Market,
        params: {
          screen: ETabMarketRoutes.MarketDetailV2,
          params: { marketTokenId: 'ethereum' },
        },
      },
      { pop: true },
    );
    expect(mockAppEventBus.emit).not.toHaveBeenCalled();
  });

  it('redirects legacy Discovery defaultTab=global_market notification payloads to ETabRoutes.Market -> TabMarket on native', async () => {
    await navigateToNotificationDetailByLocalParams({
      payload: {
        screen: ERootRoutes.Main,
        params: {
          screen: ETabRoutes.Discovery,
          params: {
            screen: ETabDiscoveryRoutes.TabDiscovery,
            params: { defaultTab: ETranslations.global_market },
          },
        },
      },
      localParams: {},
      getEarnAccount: getEarnAccountMock,
    });

    jest.runAllTimers();

    expect(navigateMock).toHaveBeenCalledWith(
      ERootRoutes.Main,
      {
        screen: ETabRoutes.Market,
        params: {
          screen: ETabMarketRoutes.TabMarket,
          pop: true,
        },
      },
      { pop: true },
    );
    expect(mockAppEventBus.emit).not.toHaveBeenCalled();
  });

  it('still redirects ETabRoutes.Earn to ETabRoutes.Discovery and emits SwitchDiscoveryTabInNative(global_earn)', async () => {
    await navigateToNotificationDetailByLocalParams({
      payload: {
        screen: ERootRoutes.Main,
        params: {
          screen: ETabRoutes.Earn,
        },
      },
      localParams: {},
      getEarnAccount: getEarnAccountMock,
    });

    jest.runAllTimers();

    expect(navigateMock).toHaveBeenCalledWith(
      ERootRoutes.Main,
      {
        screen: ETabRoutes.Discovery,
      },
      { pop: true },
    );
    expect(mockAppEventBus.emit).toHaveBeenCalledWith(
      EAppEventBusNames.SwitchDiscoveryTabInNative,
      { tab: ETranslations.global_earn },
    );
  });
});

describe('notification DApp URL rejection', () => {
  beforeEach(() => jest.clearAllMocks());

  test.each([
    'http://example.com/private-path?token=private-value',
    'https://localhost/private-path?token=private-value',
    'https://user:private-value@example.com/private-path',
  ])('rejects %s without including the payload in diagnostics', (url) => {
    const fallback = jest.fn();
    expect(
      parseNotificationPayload(
        ENotificationPushMessageMode.openInDapp,
        url,
        fallback,
      ),
    ).toBe(false);
    expect(mockLog).toHaveBeenCalledWith(
      'parseNotificationPayload: blocked unsafe url in openInDapp',
    );
    expect(mockLog).toHaveBeenCalledTimes(1);
    expect(mockAppEventBus.emit).not.toHaveBeenCalled();
    expect(fallback).not.toHaveBeenCalled();
  });

  test('continues opening an allowed DApp URL', () => {
    const url = 'https://example.com/dapp';
    expect(
      parseNotificationPayload(
        ENotificationPushMessageMode.openInDapp,
        url,
        jest.fn(),
      ),
    ).toBe(true);
    expect(mockAppEventBus.emit).toHaveBeenCalledWith('show-dapp', url);
    expect(mockLog).not.toHaveBeenCalled();
  });
});
