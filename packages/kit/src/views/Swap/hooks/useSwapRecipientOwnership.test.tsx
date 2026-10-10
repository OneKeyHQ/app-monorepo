/** @jest-environment jsdom */

import {
  type PropsWithChildren,
  type SetStateAction,
  createContext,
  useContext,
  useSyncExternalStore,
} from 'react';

import { act, renderHook } from '@testing-library/react';

import type { IAddressQueryResult } from '@onekeyhq/kit/src/components/AddressInput';
import type { IAccountSelectorActiveAccountInfo } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { ENetworkStatus } from '@onekeyhq/shared/types';
import type { IQueryCheckAddressArgs } from '@onekeyhq/shared/types/address';
import {
  ESwapDirectionType,
  ESwapTabSwitchType,
} from '@onekeyhq/shared/types/swap/types';

import { useSwapAddressInfo } from './useSwapAccount';
import {
  getSwapRecipientValidationAccountId,
  shouldShowSwapRecipientEntry,
} from './useSwapAccount.utils';
import {
  shouldEnableSwapIncognitoRecipientValidation,
  shouldShowSwapIncognitoRecipientInput,
  useSwapIncognitoRecipientInput,
} from './useSwapIncognitoRecipientInput';

type ISurface = 'tab' | 'modal';
type ISiblingMode = 'unsupported' | 'ready';
type ISettings = {
  swapIncognitoMode: boolean;
  swapEnableRecipientAddress: boolean;
  swapToAnotherAccountSwitchOn: boolean;
};
type IRecipient = {
  address?: string;
  networkId?: string;
  accountInfo?: IAccountSelectorActiveAccountInfo;
};
const NETWORK = 'sol--101';
const RECIPIENT = 'synthetic-recipient';
const mockSurfaceContext = createContext<ISurface>('modal');
const mockGlobalListeners = new Set<() => void>();
const mockRecipientListeners: Record<ISurface, Set<() => void>> = {
  tab: new Set(),
  modal: new Set(),
};
const mockSettingWrites: ISurface[] = [];
let mockSettings: ISettings;
let mockRecipients: Record<ISurface, IRecipient>;
let mockSiblingMode: ISiblingMode;
let mockActiveSurfaces: Record<ISurface, boolean>;
let mockAccounts: Record<ISurface, IAccountSelectorActiveAccountInfo>;

// Stable source objects reproduce the production memo dependencies. The
// accountInfo clones below come only from the real useSwapAddressInfo hook.
const mockStableActiveAccount: IAccountSelectorActiveAccountInfo = {
  ready: true,
  account: {
    id: 'synthetic-source-account',
    name: 'Source account',
    type: undefined,
    path: '',
    coinType: '501',
    impl: 'sol',
    pub: 'synthetic-source-public-key',
    address: 'synthetic-source-address',
    addressDetail: {
      isValid: true,
      networkId: NETWORK,
      address: 'synthetic-source-address',
      baseAddress: 'synthetic-source-address',
      normalizedAddress: 'synthetic-source-address',
      displayAddress: 'synthetic-source-address',
      allowEmptyAddress: false,
    },
  },
  indexedAccount: undefined,
  dbAccount: undefined,
  accountName: '',
  wallet: undefined,
  device: undefined,
  network: {
    id: NETWORK,
    impl: 'sol',
    chainId: '101',
    name: 'Solana',
    code: 'solana',
    shortname: 'Solana',
    shortcode: 'sol',
    symbol: 'SOL',
    logoURI: '',
    decimals: 9,
    feeMeta: { symbol: 'SOL', decimals: 9 },
    defaultEnabled: true,
    status: ENetworkStatus.LISTED,
    isTestnet: false,
  },
  vaultSettings: undefined,
  deriveType: 'default',
  deriveInfoItems: [],
};
const mockFromToken = { networkId: NETWORK, symbol: 'USDC' };
const mockToToken = { networkId: NETWORK, symbol: 'SOL' };
const mockMainFromToken = { networkId: NETWORK, symbol: 'SOL' };
const mockMainToToken = { networkId: NETWORK, symbol: 'wSOL' };
const mockQueryAddress = jest.fn<
  Promise<IAddressQueryResult>,
  [IQueryCheckAddressArgs]
>();

function applyUpdate<T>(state: T, update: SetStateAction<T>) {
  return typeof update === 'function'
    ? (update as (previous: T) => T)(state)
    : update;
}

const mockSettingsSetters = Object.fromEntries(
  (['tab', 'modal'] as const).map((surface) => [
    surface,
    (update: SetStateAction<ISettings>) => {
      mockSettings = applyUpdate(mockSettings, update);
      mockSettingWrites.push(surface);
      mockGlobalListeners.forEach((listener) => listener());
    },
  ]),
) as Record<ISurface, (update: SetStateAction<ISettings>) => void>;

const mockRecipientSetters = Object.fromEntries(
  (['tab', 'modal'] as const).map((surface) => [
    surface,
    (update: SetStateAction<IRecipient>) => {
      mockRecipients[surface] = applyUpdate(mockRecipients[surface], update);
      mockRecipientListeners[surface].forEach((listener) => listener());
    },
  ]),
) as Record<ISurface, (update: SetStateAction<IRecipient>) => void>;

function useMockSettingsAtom() {
  const surface = useContext(mockSurfaceContext);
  const settings = useSyncExternalStore(
    (listener) => {
      mockGlobalListeners.add(listener);
      return () => mockGlobalListeners.delete(listener);
    },
    () => mockSettings,
  );
  return [settings, mockSettingsSetters[surface]] as const;
}

function useMockRecipientAtom() {
  const surface = useContext(mockSurfaceContext);
  const recipient = useSyncExternalStore(
    (listener) => {
      mockRecipientListeners[surface].add(listener);
      return () => mockRecipientListeners[surface].delete(listener);
    },
    () => mockRecipients[surface],
  );
  return [recipient, mockRecipientSetters[surface]] as const;
}

function useMockSurfaceTokens() {
  const surface = useContext(mockSurfaceContext);
  return surface === 'tab'
    ? [mockMainFromToken, mockMainToToken]
    : [mockFromToken, mockToToken];
}

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useSettingsAtom: () => useMockSettingsAtom(),
}));
jest.mock('../../../states/jotai/contexts/accountSelector', () => ({
  useActiveAccount: () => ({
    activeAccount: mockAccounts[useContext(mockSurfaceContext)],
  }),
}));
jest.mock('../../../background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceNetwork: { getGlobalDeriveTypeOfNetwork: jest.fn() },
    serviceAccount: { getNetworkAccount: jest.fn() },
  },
}));
jest.mock('../../../states/jotai/contexts/swap', () => ({
  useSwapSelectFromTokenAtom: () => [useMockSurfaceTokens()[0]],
  useSwapSelectToTokenAtom: () => [useMockSurfaceTokens()[1]],
  useSwapSelectTokenNetworkAtom: () => [undefined],
  useSwapTypeSwitchAtom: () => [ESwapTabSwitchType.SWAP],
  useSwapProDirectionAtom: () => ['buy'],
  useSwapProSelectTokenAtom: () => [undefined],
  useSwapProUseSelectBuyTokenAtom: () => [undefined],
  useSwapProSellToTokenAtom: () => [undefined],
  useSwapToAnotherAccountAddressAtom: () => useMockRecipientAtom(),
}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: true },
}));
jest.mock('@onekeyhq/kit/src/components/AddressInput/utils', () => ({
  getAddressQueryResolvedAddress: (result: IAddressQueryResult) =>
    result.resolveAddress ?? result.validAddress,
  getAddressValidateTranslationId: () => undefined,
  queryAddressWithFallback: (params: IQueryCheckAddressArgs) =>
    mockQueryAddress(params),
}));
jest.mock('../../../hooks/useRouteIsFocused', () => ({
  useRouteIsFocused: jest.fn(),
}));
jest.mock('../../../hooks/useListenTabFocusState', () => ({
  __esModule: true,
  default: jest.fn(),
}));
jest.mock('../../../hooks/usePromiseResult', () => ({
  usePromiseResult: jest.fn(),
}));
jest.mock('../../../states/jotai/contexts/accountSelector/actions', () => ({
  useAccountSelectorActions: jest.fn(),
}));
jest.mock(
  '../../Market/MarketDetailV2/components/SwapPanel/hooks/useTradeType',
  () => ({ ESwapDirection: { BUY: 'buy', SELL: 'sell' } }),
);

function useRealSurfaceHooks() {
  const surface = useContext(mockSurfaceContext);
  const [settings] = useMockSettingsAtom();
  const [recipient] = useMockRecipientAtom();
  const [fromToken, toToken] = useMockSurfaceTokens();
  const swapType = ESwapTabSwitchType.SWAP;
  const providerSupportsRecipient =
    surface === 'modal' || mockSiblingMode === 'ready';
  const validation = useSwapAddressInfo(ESwapDirectionType.TO, {
    useCustomRecipientAddress: false,
  });
  const visible = shouldShowSwapIncognitoRecipientInput({
    incognitoMode: settings.swapIncognitoMode,
    providerSupportsRecipient,
    swapType,
  });
  const showRecipient = shouldShowSwapRecipientEntry({
    swapType,
    incognitoMode: settings.swapIncognitoMode,
    recipientAddressSettingOn: settings.swapEnableRecipientAddress,
    recipientRequired: false,
    providerSupportReceiveAddress: providerSupportsRecipient,
    hasFromToken: Boolean(fromToken),
    hasToToken: Boolean(toToken),
  });
  const networkId = toToken?.networkId ?? validation.networkId;
  const clearOnHide = settings.swapIncognitoMode && !showRecipient;
  const input = useSwapIncognitoRecipientInput({
    isActive: mockActiveSurfaces[surface],
    visible,
    validationEnabled: shouldEnableSwapIncognitoRecipientValidation({
      visible,
      hasFromToken: Boolean(fromToken),
      hasToToken: Boolean(toToken),
      networkId,
      providerSupportsRecipient,
      isAddressInfoReady: validation.isRecipientValidationReady,
    }),
    clearRecipientAddressOnHide: clearOnHide,
    networkId,
    validationScopeKey: validation.validationScopeKey,
    accountId: getSwapRecipientValidationAccountId({
      accountId: validation.accountInfo?.account?.id,
      accountAddress: validation.accountInfo?.account?.addressDetail?.address,
      recipientAddress: validation.address,
    }),
    accountInfo: validation.accountInfo ?? validation.activeAccount,
    address: recipient.address,
    swapToAnotherAccountSwitchOn: settings.swapToAnotherAccountSwitchOn,
  });
  return { input, validation };
}

function wrapperFor(surface: ISurface) {
  return function Wrapper({ children }: PropsWithChildren) {
    return (
      <mockSurfaceContext.Provider value={surface}>
        {children}
      </mockSurfaceContext.Provider>
    );
  };
}

async function advance(ms: number) {
  await act(async () => jest.advanceTimersByTimeAsync(ms));
}

function confirmModalRecipient() {
  mockSettingsSetters.modal((value) => ({
    ...value,
    swapEnableRecipientAddress: true,
    swapToAnotherAccountSwitchOn: true,
  }));
  mockRecipientSetters.modal((value) => ({
    ...value,
    address: RECIPIENT,
    networkId: NETWORK,
  }));
}

describe('recipient ownership across mounted Swap surfaces', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockSettings = {
      swapIncognitoMode: true,
      swapEnableRecipientAddress: false,
      swapToAnotherAccountSwitchOn: false,
    };
    mockRecipients = { tab: {}, modal: {} };
    mockSiblingMode = 'unsupported';
    mockActiveSurfaces = { tab: false, modal: true };
    mockAccounts = {
      tab: mockStableActiveAccount,
      modal: mockStableActiveAccount,
    };
    mockSettingWrites.length = 0;
    mockGlobalListeners.clear();
    mockRecipientListeners.tab.clear();
    mockRecipientListeners.modal.clear();
    mockQueryAddress.mockReset().mockResolvedValue({
      validStatus: 'valid',
      validAddress: RECIPIENT,
    });
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it.each([false, true])(
    'keeps the confirmed modal recipient while an inactive unsupported tab has an old recipient: %s',
    async (hasOldRecipient) => {
      if (hasOldRecipient) {
        mockRecipients.tab = { address: 'old-recipient', networkId: NETWORK };
      }
      const tab = renderHook(useRealSurfaceHooks, {
        wrapper: wrapperFor('tab'),
      });
      const modal = renderHook(useRealSurfaceHooks, {
        wrapper: wrapperFor('modal'),
      });
      const tabAccountInfoBefore = tab.result.current.validation.accountInfo;
      act(confirmModalRecipient);

      // The real address hook still recreates accountInfo when global settings
      // change; the inactive surface must not publish a recipient reset.
      expect(tab.result.current.validation.accountInfo).not.toBe(
        tabAccountInfoBefore,
      );
      expect(modal.result.current.input.inputText).toBe(RECIPIENT);
      await advance(300);
      expect(modal.result.current.input.queryResult.validStatus).toBe('valid');
      expect(mockSettings.swapToAnotherAccountSwitchOn).toBe(true);
      expect(mockRecipients.modal.address).toBe(RECIPIENT);
      expect(modal.result.current.input.inputText).toBe(RECIPIENT);
      expect(mockSettingWrites).not.toContain('tab');

      mockAccounts.tab = {
        ...mockStableActiveAccount,
        account: mockStableActiveAccount.account
          ? { ...mockStableActiveAccount.account, id: 'changed-source' }
          : undefined,
      };
      tab.rerender();
      expect(mockSettings.swapToAnotherAccountSwitchOn).toBe(true);
      expect(modal.result.current.input.inputText).toBe(RECIPIENT);
      expect(mockSettingWrites).not.toContain('tab');

      // On return, the unsupported tab resumes its own normal cleanup.
      mockActiveSurfaces = { tab: true, modal: false };
      modal.rerender();
      tab.rerender();
      expect(mockSettings.swapToAnotherAccountSwitchOn).toBe(false);
      expect(mockRecipients.tab.address).toBeUndefined();
      expect(mockRecipients.modal.address).toBe(RECIPIENT);
    },
  );

  it.each(['valid', 'invalid'] as const)(
    'ignores a late %s tab validation after focus moves to the modal',
    async (validStatus) => {
      mockSiblingMode = 'ready';
      mockActiveSurfaces = { tab: true, modal: false };
      let resolveTabValidation!: (value: IAddressQueryResult) => void;
      mockQueryAddress.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveTabValidation = resolve;
          }),
      );
      const tab = renderHook(useRealSurfaceHooks, {
        wrapper: wrapperFor('tab'),
      });
      const modal = renderHook(useRealSurfaceHooks, {
        wrapper: wrapperFor('modal'),
      });
      act(() => tab.result.current.input.onInputChange('tab-draft'));
      await advance(300);

      mockActiveSurfaces = { tab: false, modal: true };
      tab.rerender();
      modal.rerender();
      act(confirmModalRecipient);
      await act(async () => {
        resolveTabValidation({
          validStatus,
          validAddress: 'late-tab-recipient',
        });
      });
      await advance(300);
      expect(mockSettings.swapToAnotherAccountSwitchOn).toBe(true);
      expect(mockRecipients.modal.address).toBe(RECIPIENT);
      expect(modal.result.current.input.inputText).toBe(RECIPIENT);
      expect(tab.result.current.input.inputText).toBe('tab-draft');
      expect(mockRecipients.tab.address).toBeUndefined();
    },
  );

  it('preserves a modal recipient while its editor is open and revalidates on return', async () => {
    const modal = renderHook(useRealSurfaceHooks, {
      wrapper: wrapperFor('modal'),
    });
    act(confirmModalRecipient);
    await advance(300);
    mockActiveSurfaces.modal = false;
    modal.rerender();
    expect(mockSettings.swapToAnotherAccountSwitchOn).toBe(true);
    expect(modal.result.current.input.inputText).toBe(RECIPIENT);
    expect(modal.result.current.input.enabled).toBe(false);

    mockActiveSurfaces.modal = true;
    modal.rerender();
    await advance(300);
    expect(modal.result.current.input.queryResult.validStatus).toBe('valid');
    expect(modal.result.current.input.inputText).toBe(RECIPIENT);
    expect(mockSettings.swapToAnotherAccountSwitchOn).toBe(true);
  });
});
