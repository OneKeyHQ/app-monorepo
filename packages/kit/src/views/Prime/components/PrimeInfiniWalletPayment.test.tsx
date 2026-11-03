/** @jest-environment jsdom */
/* cspell:ignore Infini */
import type { ReactElement, ReactNode } from 'react';

import { act, cleanup, render, waitFor } from '@testing-library/react';

import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { EPrimeAuthSessionSource } from '@onekeyhq/shared/types/prime/primeTypes';
import type { IPrimeInfiniPendingPaymentLookup } from '@onekeyhq/shared/types/prime/primeTypes';

import { showPrimeInfiniPaymentErrorToast } from '../primeInfiniPaymentError';

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
const mockWaitingDialog = jest.fn<void, unknown[]>();
const mockIntl = { formatMessage: ({ id }: { id: string }) => id };
const mockUser = { onekeyUserId: 'user-1' };
const authContext = {
  onekeyUserId: 'user-1',
  authSessionSource: EPrimeAuthSessionSource.KeylessOAuth,
  authStateGeneration: 3,
};

jest.mock('react-intl', () => ({ useIntl: () => mockIntl }));
jest.mock('@onekeyhq/components', () => {
  const Stack = ({ children }: { children?: ReactNode }) => children ?? null;
  return {
    getFontVariantStyle: () => ({}),
    Page: { Footer: Stack },
    Stack,
    YStack: Stack,
    XStack: Stack,
    Skeleton: () => null,
  };
});
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
          tokens: [
            { symbol: 'USDC', contract: '0xa0b8' },
            { symbol: 'USDT', contract: '0xdac' },
          ],
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
      return { result, isLoading, run, setResult };
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
jest.mock('./PrimeInfiniWaitingDialog', () => ({
  showPrimeInfiniWaitingDialog: (...args: unknown[]) =>
    mockWaitingDialog(...args),
}));
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

function renderRoot(createNewPayment: boolean, resumePaymentId?: string) {
  return render(
    <PrimeInfiniWalletPaymentRoot
      plan="monthly"
      selectedSubscriptionPeriod="P1M"
      createNewPayment={createNewPayment}
      remotePaymentResumeIntent={
        resumePaymentId
          ? { paymentId: resumePaymentId, authContext }
          : undefined
      }
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
    mockChoose.mockReset();
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

  it.each(['replace', 'resume', 'cancel'] as const)(
    'requires replacement consent before changing a remote recovery asset: %s',
    async (choice) => {
      mockLookup.mockResolvedValue({
        authContext,
        pendingPayment: {
          paymentId: 'remote-id',
          payment: {
            paymentId: 'remote-id',
            chain: 'ETHEREUM',
            token: 'USDC',
            address: '0xrecipient',
            amountDue: '29.99',
            expiresAt: Date.now() + 3_600_000,
            status: 'created',
          },
          plan: 'monthly',
          hasTransactions: false,
        },
      });
      mockChoose.mockResolvedValueOnce('resume').mockResolvedValueOnce(choice);
      renderRoot(true);
      await waitFor(() =>
        expect(mockContent?.props.remoteRecovery).toBeTruthy(),
      );
      const changeAsset = mockContent?.props.onSelectedAssetChange as (
        key: string,
      ) => Promise<void>;
      const nextAsset = (mockContent?.props.assets as { key: string }[])[1];
      const previousAsset = mockContent?.props.selectedAsset;
      await act(async () => changeAsset(nextAsset.key));
      expect(mockChoose).toHaveBeenCalledTimes(2);
      expect(Boolean(mockContent?.props.remoteRecovery)).toBe(
        choice !== 'replace',
      );
      expect(mockContent?.props.shouldCreatePayment).toBe(true);
      expect(mockContent?.props.selectedAsset).toEqual(
        choice === 'replace' ? nextAsset : previousAsset,
      );
    },
  );

  it('closes a resume-only entry when the server returns a different pending invoice', async () => {
    mockLookup.mockResolvedValue({
      authContext,
      pendingPayment: { paymentId: 'different-id', hasTransactions: false },
    });
    mockChoose.mockResolvedValue('replace');
    renderRoot(false, 'original-id');
    await waitFor(() => expect(mockClose).toHaveBeenCalledTimes(1));
    expect(mockChoose).not.toHaveBeenCalled();
    expect(mockContent?.props.shouldCreatePayment).toBeUndefined();
  });

  it('hands a sent remote invoice to tracking without mounting or selecting a payer wallet', async () => {
    const wait = jest
      .spyOn(timerUtils, 'setTimeoutPromised')
      .mockResolvedValue(undefined);
    mockLookup.mockResolvedValue({
      authContext,
      pendingPayment: {
        paymentId: 'remote-id',
        plan: 'monthly',
        hasTransactions: true,
        payment: {
          paymentId: 'remote-id',
          chain: 'ETHEREUM',
          token: 'USDC',
          address: '0xrecipient',
          amountDue: '29.99',
          expiresAt: 1,
          status: 'expired',
        },
      },
    });
    mockChoose.mockResolvedValue('resume');
    renderRoot(false, 'remote-id');
    await waitFor(() => {
      expect(showPrimeInfiniPaymentErrorToast).not.toHaveBeenCalled();
      expect(mockWaitingDialog).toHaveBeenCalledTimes(1);
    });
    expect(mockClose).toHaveBeenCalledTimes(1);
    expect(mockContent?.props.shouldCreatePayment).toBeUndefined();
    const waiting = mockWaitingDialog.mock.calls[0][0] as {
      context: { session: Record<string, unknown> };
    };
    expect(waiting.context.session).toMatchObject({
      authContext,
      payment: { paymentId: 'remote-id', hasTransactions: true },
    });
    expect(waiting.context.session.paymentCacheKey).toBeUndefined();
    expect(waiting.context.session.payerAccountId).toBeUndefined();
    wait.mockRestore();
  });
});
