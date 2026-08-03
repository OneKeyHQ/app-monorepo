import {
  executeHomePerpsOpenAsset,
  resolveHomePerpsOpenAssetCommand,
} from './homePerpsActionExecutor';

import type { IHomePerpsLegacyPayload } from '../sections/perps/homePerpsSourceAdapter';

jest.mock('@onekeyhq/components', () => ({
  rootNavigationRef: { current: { navigate: jest.fn() } },
}));

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceNetwork: {
      getGlobalDeriveTypeOfNetwork: jest.fn(),
    },
    serviceHyperliquid: {
      changeActivePerpsAccount: jest.fn(),
      changeActiveAsset: jest.fn(),
    },
  },
}));

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  perpsPendingInfoPanelTabAtom: { set: jest.fn() },
  spotActiveAssetAtom: { set: jest.fn() },
  tradingModeAtom: { set: jest.fn() },
}));

jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  EAppEventBusNames: {
    PerpSwitchActiveInstrument: 'PerpSwitchActiveInstrument',
    PerpSwitchInfoPanelTab: 'PerpSwitchInfoPanelTab',
  },
  appEventBus: { emit: jest.fn() },
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: true },
}));

const mockedBackgroundApiProxy = jest.requireMock<{
  default: {
    serviceHyperliquid: {
      changeActiveAsset: jest.Mock;
      changeActivePerpsAccount: jest.Mock;
    };
    serviceNetwork: { getGlobalDeriveTypeOfNetwork: jest.Mock };
  };
}>('@onekeyhq/kit/src/background/instance/backgroundApiProxy').default;
const mockedAtoms = jest.requireMock<{
  perpsPendingInfoPanelTabAtom: { set: jest.Mock };
  spotActiveAssetAtom: { set: jest.Mock };
  tradingModeAtom: { set: jest.Mock };
}>('@onekeyhq/kit-bg/src/states/jotai/atoms');
const mockedAppEventBus = jest.requireMock<{
  appEventBus: { emit: jest.Mock };
}>('@onekeyhq/shared/src/eventBus/appEventBus').appEventBus;
const mockGetGlobalDeriveTypeOfNetwork =
  mockedBackgroundApiProxy.serviceNetwork.getGlobalDeriveTypeOfNetwork;
const mockChangeActivePerpsAccount =
  mockedBackgroundApiProxy.serviceHyperliquid.changeActivePerpsAccount;
const mockChangeActiveAsset =
  mockedBackgroundApiProxy.serviceHyperliquid.changeActiveAsset;
const mockSetPendingInfoPanelTab = mockedAtoms.perpsPendingInfoPanelTabAtom.set;
const mockSetSpotActiveAsset = mockedAtoms.spotActiveAssetAtom.set;
const mockSetTradingMode = mockedAtoms.tradingModeAtom.set;
const mockEmit = mockedAppEventBus.emit;

const payload: IHomePerpsLegacyPayload = {
  address: '0xaccount',
  scopeKey: 'owner-a',
  view: {
    accountValueUsd: 100,
    holdings: [
      {
        balance: '10',
        displaySymbol: 'USDC',
        pnlUsd: 0,
        symbol: 'USDC',
        valueUsd: 10,
      },
      {
        balance: '2',
        displaySymbol: 'PURR',
        pnlUsd: 1,
        spotUniverseName: '@1',
        symbol: 'PURR',
        valueUsd: 20,
      },
    ],
    isDegraded: false,
    isEmpty: false,
    positions: [
      {
        coin: 'BTC',
        entryPx: '100',
        fundingUsd: 0,
        leverageType: 'cross',
        leverageValue: 2,
        liqPx: null,
        marginUsd: 10,
        markPx: '110',
        pnlUsd: 2,
        roi: 0.2,
        side: 'long',
        sizeCoin: '0.1',
      },
    ],
  },
};

describe('Home Perps action executor parity', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetGlobalDeriveTypeOfNetwork.mockResolvedValue('derive-a');
    mockChangeActivePerpsAccount.mockResolvedValue({
      accountAddress: '0xperps',
    });
    mockChangeActiveAsset.mockResolvedValue(undefined);
    mockSetPendingInfoPanelTab.mockResolvedValue(undefined);
    mockSetSpotActiveAsset.mockResolvedValue(undefined);
    mockSetTradingMode.mockResolvedValue(undefined);
  });

  it('resolves Native position and tradable holding ids to React action semantics', () => {
    expect(
      resolveHomePerpsOpenAssetCommand({
        itemId: 'position:BTC:0',
        payload,
      }),
    ).toEqual({
      coin: 'BTC',
      infoPanelTab: 'Positions',
      mode: 'perp',
      openMarket: false,
    });
    expect(
      resolveHomePerpsOpenAssetCommand({
        itemId: 'holding:PURR:1',
        payload,
      }),
    ).toEqual({
      coin: '@1',
      infoPanelTab: 'Balances',
      mode: 'spot',
      openMarket: false,
    });
    expect(
      resolveHomePerpsOpenAssetCommand({
        itemId: 'holding:USDC:0',
        payload,
      }),
    ).toBeUndefined();
  });

  it('activates the Perps account and instrument before switching tabs', async () => {
    const switchToPerps = jest.fn();
    const scheduled: Array<{ callback: () => void; delayMs: number }> = [];
    let current = true;

    await expect(
      executeHomePerpsOpenAsset({
        accountIdentity: {
          accountId: 'account-a',
          indexedAccountId: 'indexed-a',
          walletId: 'wallet-a',
        },
        coin: 'BTC',
        infoPanelTab: 'Positions',
        isCurrent: () => current,
        mode: 'perp',
        openMarket: false,
        scheduleDeferred: (callback, delayMs) => {
          scheduled.push({ callback, delayMs });
        },
        switchToPerps,
      }),
    ).resolves.toBe(true);

    expect(mockGetGlobalDeriveTypeOfNetwork).toHaveBeenCalledTimes(1);
    expect(mockChangeActivePerpsAccount).toHaveBeenCalledWith({
      accountId: 'account-a',
      deriveType: 'derive-a',
      indexedAccountId: 'indexed-a',
      walletId: 'wallet-a',
    });
    expect(mockChangeActiveAsset).toHaveBeenCalledWith({ coin: 'BTC' });
    expect(mockSetTradingMode).toHaveBeenCalledWith('perp');
    expect(mockSetPendingInfoPanelTab).toHaveBeenCalledWith('Positions');
    expect(switchToPerps).toHaveBeenCalledTimes(1);
    expect(mockEmit).toHaveBeenCalledWith('PerpSwitchActiveInstrument', {
      coin: 'BTC',
      mode: 'perp',
    });
    expect(scheduled).toHaveLength(1);
    expect(scheduled[0]?.delayMs).toBe(0);

    current = false;
    scheduled[0]?.callback();
    expect(mockEmit).not.toHaveBeenCalledWith('PerpSwitchInfoPanelTab', {
      tab: 'Positions',
    });
  });

  it('uses spot state for a Native holding command', async () => {
    const command = resolveHomePerpsOpenAssetCommand({
      itemId: 'holding:PURR:1',
      payload,
    });
    expect(command).toBeDefined();
    if (!command) {
      return;
    }

    await executeHomePerpsOpenAsset({
      accountIdentity: { indexedAccountId: 'indexed-a' },
      ...command,
      switchToPerps: jest.fn(),
    });

    expect(mockSetSpotActiveAsset).toHaveBeenCalledWith({
      assetId: undefined,
      coin: '@1',
      universe: undefined,
    });
    expect(mockSetTradingMode).toHaveBeenCalledWith('spot');
    expect(mockChangeActiveAsset).not.toHaveBeenCalled();
  });
});
