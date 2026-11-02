/** @jest-environment jsdom */
/* cspell:ignore Infini */
import type { ReactElement, ReactNode } from 'react';

import { cleanup, render, waitFor } from '@testing-library/react';

import { EPrimeAuthSessionSource } from '@onekeyhq/shared/types/prime/primeTypes';
import type { IPrimeInfiniPendingPaymentLookup } from '@onekeyhq/shared/types/prime/primeTypes';

import { PrimeInfiniWalletPaymentRoot } from './PrimeInfiniWalletPayment';

let mockContent: ReactElement<Record<string, unknown>> | undefined;
const mockChoose = jest.fn<
  Promise<'cancel' | 'resume' | 'replace'>,
  unknown[]
>();
const mockLookup = jest.fn<
  Promise<IPrimeInfiniPendingPaymentLookup>,
  unknown[]
>();
const mockClose = jest.fn();
const mockIntl = { formatMessage: ({ id }: { id: string }) => id };
const mockUser = { onekeyUserId: 'user-1' };
const authContext = {
  onekeyUserId: 'user-1',
  authSessionSource: EPrimeAuthSessionSource.KeylessOAuth,
  authStateGeneration: 3,
};

jest.mock('react-intl', () => ({ useIntl: () => mockIntl }));
jest.mock('@onekeyhq/components', () => ({
  getFontVariantStyle: () => ({}),
}));
jest.mock('@onekeyhq/kit/src/components/AccountSelector', () => ({
  AccountSelectorProviderMirror: ({ children }: { children: ReactNode }) => {
    // Inspect the parent's creation gate without running wallet preparation.
    mockContent = children as ReactElement<Record<string, unknown>>;
    return null;
  },
}));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    servicePrime: {
      apiGetInfiniPaymentOptions: async () => [
        {
          chain: 'ETHEREUM',
          networkId: 'evm--1',
          tokens: [{ symbol: 'USDC', contract: '0xa0b8' }],
        },
      ],
      apiGetInfiniPurchaseStatusSnapshot: async () => ({
        onekeyUserId: 'user-1',
      }),
      apiGetInfiniPendingPayment: (...args: unknown[]) => mockLookup(...args),
      isInfiniCheckoutAuthContextCurrent: async () => true,
    },
    simpleDb: {
      prime: { getInfiniPendingPaymentSession: async () => undefined },
    },
  },
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useDevSettingsPersistAtom: () => [{ enabled: false }],
  usePrimePersistAtom: () => [mockUser],
}));
jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    usePromiseResult: function usePromiseResult(
      method: () => Promise<unknown>,
    ) {
      const [result, setResult] = React.useState<unknown>();
      const [isLoading, setIsLoading] = React.useState(true);
      const methodRef = React.useRef(method);
      methodRef.current = method;
      const run = React.useCallback(async () => {
        setIsLoading(true);
        setResult(await methodRef.current());
        setIsLoading(false);
      }, []);
      // Run the real loader once on mount; retries still use its latest callback.
      React.useEffect(() => {
        void run();
      }, [run]);
      return { result, isLoading, run };
    },
  };
});
jest.mock('./PrimePurchaseDialog/PrimePurchaseDialog', () => ({
  usePrimePurchaseCallback: () => ({ purchase: jest.fn() }),
}));
jest.mock(
  './PrimePurchaseDialog/showPrimeInfiniUnfinishedPaymentDialog',
  () => ({
    showPrimeInfiniUnfinishedPaymentDialog: (...args: unknown[]) =>
      mockChoose(...args),
  }),
);
jest.mock('../primeInfiniPaymentError', () => ({
  showPrimeInfiniPaymentErrorToast: jest.fn(),
}));
jest.mock('../primeInfiniPaymentLogger', () => ({
  logPrimeInfiniPaymentFlow: jest.fn(),
}));
jest.mock('@onekeyhq/shared/src/logger/logger', () => ({ defaultLogger: {} }));
jest.mock('../primeSubscriptionPurchaseSuccess', () => ({}));
jest.mock('../primePurchaseEligibility', () => ({}));
jest.mock('./PrimeInfiniWaitingDialog', () => ({}));
jest.mock('./PrimeInfiniPaymentWarnings', () => ({}));
jest.mock('../hooks/usePrimeInfiniPurchase', () => ({}));
jest.mock(
  '@onekeyhq/kit/src/components/AccountSelector/hooks/useAccountSelectorTrigger',
  () => ({}),
);
jest.mock('@onekeyhq/kit/src/components/ListItem', () => ({}));
jest.mock('@onekeyhq/kit/src/components/MultipleClickStack', () => ({}));
jest.mock('@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth', () => ({}));
jest.mock('@onekeyhq/kit/src/components/TokenListItem', () => ({}));
jest.mock('@onekeyhq/kit/src/components/TokenSelectorFilter', () => ({}));
jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({}));
jest.mock('@onekeyhq/kit/src/hooks/useAppRoute', () => ({}));
jest.mock('@onekeyhq/kit/src/hooks/useSignatureConfirm', () => ({}));
jest.mock(
  '@onekeyhq/kit/src/states/jotai/contexts/accountSelector/actions',
  () => ({}),
);
jest.mock('@onekeyhq/kit/src/utils/fiatConvert', () => ({}));

function renderRoot(createNewPayment: boolean) {
  return render(
    <PrimeInfiniWalletPaymentRoot
      plan="monthly"
      selectedSubscriptionPeriod="P1M"
      createNewPayment={createNewPayment}
      hasValidRouteParams
      onPayWithExternalWallet={jest.fn()}
      onClose={mockClose}
      onExitPreventedChange={jest.fn()}
    />,
  );
}

describe('Infini wallet loader creation gate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockContent = undefined;
    mockLookup.mockResolvedValue({ authContext });
    mockChoose.mockResolvedValue('cancel');
  });
  afterEach(cleanup);

  it('allows automatic preparation only after successful empty discovery', async () => {
    renderRoot(true);
    await waitFor(() =>
      expect(mockContent?.props.shouldCreatePayment).toBe(true),
    );
    expect(mockChoose).not.toHaveBeenCalled();
  });

  it('never mounts payment content after the remote choice is cancelled', async () => {
    mockLookup.mockResolvedValue({
      authContext,
      pendingPayment: { paymentId: 'remote-id', hasTransactions: false },
    });
    renderRoot(true);
    await waitFor(() => expect(mockClose).toHaveBeenCalledTimes(1));
    expect(mockContent?.props.shouldCreatePayment).toBeUndefined();
  });

  it('closes a resume-only entry when its invoice disappears', async () => {
    renderRoot(false);
    await waitFor(() => expect(mockClose).toHaveBeenCalledTimes(1));
    expect(mockContent?.props.shouldCreatePayment).toBeUndefined();
  });

  it('blocks preparation on lookup failure and exposes retry', async () => {
    mockLookup.mockRejectedValue(new Error('pending lookup unavailable'));
    renderRoot(true);
    await waitFor(() =>
      expect(mockContent?.props.paymentContextErrorTitle).toBeTruthy(),
    );
    expect(mockContent?.props.shouldCreatePayment).toBe(false);
    expect(mockContent?.props.onRetryPaymentContext).toEqual(
      expect.any(Function),
    );
  });
});
