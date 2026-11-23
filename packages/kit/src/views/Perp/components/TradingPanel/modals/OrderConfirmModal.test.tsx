/** @jest-environment jsdom */

import { createContext, useContext } from 'react';
import type { PropsWithChildren, ReactNode } from 'react';

import { act, render } from '@testing-library/react';
import BigNumber from 'bignumber.js';
import { createIntl } from 'react-intl';

import type { ITradingFormData } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import { EPerpsSizeInputMode } from '@onekeyhq/shared/types/hyperliquid';

const accountAddress = '0x1111111111111111111111111111111111111111';
const AccountAddress = createContext(accountAddress);
const submitOrder = jest.fn().mockResolvedValue(undefined);
const checkInstrument = jest.fn<Promise<boolean>, []>();
const close = jest.fn();
const toastError = jest.fn();
let marketReady = true;
let dialogContent: ReactNode;
let confirm: () => Promise<void>;
const intl = createIntl({ locale: 'en', onError: () => {} });
const formData: ITradingFormData = {
  side: 'long',
  type: 'market',
  orderMode: 'standard',
  price: '100',
  size: '1',
  sizeInputMode: EPerpsSizeInputMode.MANUAL,
  sizePercent: 0,
  hasTpsl: false,
  tpTriggerPx: '',
  tpGainPercent: '',
  slTriggerPx: '',
  slLossPercent: '',
};
const Container = ({ children }: PropsWithChildren) => <>{children}</>;
const Empty = () => null;
const mocks = {
  '@onekeyhq/components': {
    Badge: Container,
    Checkbox: Empty,
    DashText: Container,
    SizableText: Container,
    XStack: Container,
    YStack: Container,
    Toast: { error: toastError },
    Button: ({
      onPress,
      disabled,
      children,
    }: PropsWithChildren<{
      onPress: () => Promise<void>;
      disabled: boolean;
    }>) => {
      confirm = onPress;
      return (
        <button type="button" disabled={disabled}>
          {children}
        </button>
      );
    },
    Dialog: {
      show: ({ renderContent }: { renderContent: ReactNode }) => {
        dialogContent = renderContent;
        return { close };
      },
    },
  },
  '@onekeyfe/react-native-native-overlay': {
    OverlayPageHostScope: Container,
    OverlayPageOwnerScope: Container,
  },
  'react-intl': { useIntl: () => intl },
  '@onekeyhq/kit/src/background/instance/backgroundApiProxy': {
    __esModule: true,
    default: {
      simpleDb: { perp: { getExpectMaxBuilderFee: async () => 0 } },
    },
  },
  '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid': {
    useHyperliquidActions: () => ({ current: { submitOrder } }),
    useTradingFormAtom: () => [formData],
    useActiveTradeInstrumentAtom: () => [
      { mode: 'perp', coin: 'BTC', assetId: 0 },
    ],
  },
  '@onekeyhq/kit-bg/src/states/jotai/atoms': {
    usePerpsActiveAccountAtom: () => [
      { accountAddress: useContext(AccountAddress) },
    ],
    usePerpsCustomSettingsAtom: () => [{}, jest.fn()],
  },
  '../../../hooks': {
    useOrderConfirm: () => ({ isSubmitting: false, handleConfirm: jest.fn() }),
    useTradingCalculationsForSide: () => ({
      computedSizeForSide: new BigNumber(1),
      orderValue: new BigNumber(100),
    }),
  },
  '../../../hooks/useActiveTradeDisplay': {
    useActiveTradeDisplay: () => ({ baseName: 'BTC' }),
  },
  '../../../hooks/useTradingPrice': {
    useTradingPrice: () => ({ midPriceBN: new BigNumber(100) }),
  },
  '../../../hooks/usePerpsMarketDataFreshness': {
    getCurrentPerpsMarketDataFreshness: () => ({ isReady: marketReady }),
  },
  '../../../utils/perpsMarketDataFreshness': {
    isPerpsOrderFormDataOfInstrument: checkInstrument,
  },
  '../../../PerpsAccountSelectorProviderMirror': {
    PerpsAccountSelectorProviderMirror: Container,
  },
  '../../../PerpsProviderMirror': { PerpsProviderMirror: Container },
  '../../TradingGuardWrapper': { TradingGuardWrapper: Container },
  '../components/LiquidationPriceDisplay': { LiquidationPriceDisplay: Empty },
  './AggressiveLimitPriceWarning': { AggressiveLimitPriceWarning: Empty },
};
Object.entries(mocks).forEach(([path, mock]) => jest.doMock(path, () => mock));
const { showOrderConfirmDialog } =
  require('./OrderConfirmModal') as typeof import('./OrderConfirmModal');

async function openDialog() {
  showOrderConfirmDialog({
    intl,
    sourcePage: { hostKey: 'test-host', ownerKey: 'test-owner' },
    formData,
    expectedCoin: 'BTC',
    expectedAccountAddress: accountAddress,
  });
  const view = render(
    <AccountAddress.Provider value={accountAddress}>
      {dialogContent}
    </AccountAddress.Provider>,
  );
  await act(async () => {});
  return view;
}

function deferInstrumentCheck() {
  let resolve!: (matches: boolean) => void;
  checkInstrument.mockReturnValue(
    new Promise<boolean>((done) => {
      resolve = done;
    }),
  );
  return (matches: boolean) => resolve(matches);
}

beforeEach(() => {
  jest.clearAllMocks();
  checkInstrument.mockResolvedValue(true);
  marketReady = true;
});

it('locks before validation so rapid confirmations submit only once', async () => {
  const resolve = deferInstrumentCheck();
  const { getByRole } = await openDialog();
  let pending!: Promise<void>;
  act(() => {
    pending = confirm();
    void confirm();
  });
  expect(checkInstrument).toHaveBeenCalledTimes(1);
  expect(getByRole('button').hasAttribute('disabled')).toBe(true);
  expect(submitOrder).not.toHaveBeenCalled();
  await act(async () => {
    resolve(true);
    await pending;
  });
  expect(submitOrder).toHaveBeenCalledTimes(1);
  expect(submitOrder).toHaveBeenCalledWith(
    expect.objectContaining({
      assetId: 0,
      expectedAccountAddress: accountAddress,
      formData,
    }),
  );
});

it('does not submit after the dialog unmounts during validation', async () => {
  const resolve = deferInstrumentCheck();
  const { unmount } = await openDialog();
  let pending!: Promise<void>;
  act(() => {
    pending = confirm();
  });
  unmount();
  await act(async () => {
    resolve(true);
    await pending;
  });
  expect(submitOrder).not.toHaveBeenCalled();
});

it('does not submit after an account change closes the pending dialog', async () => {
  const resolve = deferInstrumentCheck();
  const { rerender } = await openDialog();
  let pending!: Promise<void>;
  act(() => {
    pending = confirm();
  });
  rerender(
    <AccountAddress.Provider value="0x2222222222222222222222222222222222222222">
      {dialogContent}
    </AccountAddress.Provider>,
  );
  expect(close).toHaveBeenCalled();
  await act(async () => {
    resolve(true);
    await pending;
  });
  expect(submitOrder).not.toHaveBeenCalled();
});

it('releases the lock after an offline check so the user can retry', async () => {
  const { getByRole } = await openDialog();
  marketReady = false;
  await act(async () => {
    await confirm();
  });
  expect(submitOrder).not.toHaveBeenCalled();
  expect(toastError).toHaveBeenCalledTimes(1);
  expect(getByRole('button').hasAttribute('disabled')).toBe(false);
  marketReady = true;
  await act(async () => {
    await confirm();
  });
  expect(submitOrder).toHaveBeenCalledTimes(1);
});

it('releases the lock when the background validation rejects', async () => {
  await openDialog();
  checkInstrument.mockRejectedValueOnce(new Error('background unavailable'));
  await act(async () => {
    await expect(confirm()).rejects.toThrow('background unavailable');
  });
  expect(submitOrder).not.toHaveBeenCalled();
  await act(async () => {
    await confirm();
  });
  expect(submitOrder).toHaveBeenCalledTimes(1);
});

it('closes without submitting when the background market no longer matches', async () => {
  await openDialog();
  checkInstrument.mockResolvedValueOnce(false);
  await act(async () => {
    await confirm();
  });
  expect(submitOrder).not.toHaveBeenCalled();
  expect(toastError).toHaveBeenCalledTimes(1);
  expect(close).toHaveBeenCalledTimes(1);
});
