/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';

import type { IUnsignedTxPro } from '@onekeyhq/core/src/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { ERevokeTxStatus } from '@onekeyhq/shared/types/approval';

import { ApprovalManagementTestIDs } from '../testIDs';

import BulkRevoke from './BulkRevoke';

const mockPopStack = jest.fn();
const mockBatchSignAndSendTransaction = jest.fn<Promise<unknown>, unknown[]>();
let mockRouteParams: {
  unsignedTxs: IUnsignedTxPro[];
  contractMap: Record<string, unknown>;
} = { unsignedTxs: [], contractMap: {} };

jest.mock('react-intl', () => {
  // Stable like the real hook's return value: the page keys its revoke loop
  // on `intl`, so a fresh object per render would restart the loop.
  const intl = {
    formatMessage: ({ id }: { id: string }) => id,
  };
  return { useIntl: () => intl };
});

jest.mock('@react-navigation/core', () => ({
  useRoute: () => ({ params: mockRouteParams }),
}));

jest.mock('../../../hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({ popStack: mockPopStack }),
}));

jest.mock('../../../hooks/usePromiseResult', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    usePromiseResult: (method: () => Promise<unknown>, deps: unknown[]) => {
      React.useEffect(() => {
        void method();
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, deps);
      return { result: undefined, isLoading: false, run: method };
    },
  };
});

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useSettingsPersistAtom: () => [{ currencyInfo: { symbol: '$' } }],
}));

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    prime: { usage: { bulkRevokeSuccess: jest.fn() } },
  },
}));

jest.mock('@onekeyhq/shared/src/utils/feeUtils', () => ({
  calculateFeeForSend: () => ({
    total: '0',
    totalNative: '0',
    totalFiat: '0',
    totalNativeForDisplay: '0',
    totalFiatForDisplay: '0',
  }),
}));

jest.mock('../../../background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceToken: {
      getNativeTokenAddress: jest.fn(async () => ''),
      fetchTokensDetails: jest.fn(async () => [
        { balanceParsed: '1', info: { symbol: 'ETH' } },
      ]),
    },
    serviceAccount: {
      getAccountAddressForApi: jest.fn(async () => '0xaccount'),
    },
    serviceGas: {
      buildEstimateFeeParams: jest.fn(
        async ({ encodedTx }: { encodedTx: unknown }) => ({
          encodedTx,
          estimateFeeParams: undefined,
        }),
      ),
      estimateFee: jest.fn(async () => ({
        common: {
          baseFee: '0',
          feeDecimals: 18,
          feeSymbol: 'ETH',
          nativeDecimals: 18,
          nativeSymbol: 'ETH',
          nativeTokenPrice: 1,
        },
        gas: [{ gasPrice: '1', gasLimit: '21000' }],
      })),
    },
    serviceSend: {
      preCheckIsFeeInfoOverflow: jest.fn(async () => false),
      getNextNonce: jest.fn(async () => 1),
      updateUnsignedTx: jest.fn(
        async ({ unsignedTx }: { unsignedTx: unknown }) => unsignedTx,
      ),
      batchSignAndSendTransaction: (...args: unknown[]) =>
        mockBatchSignAndSendTransaction(...args),
    },
  },
}));

jest.mock('../components/BulkRevokeItem', () => ({
  __esModule: true,
  default: ({
    unsignedTx,
    revokeTxsStatusMap,
  }: {
    unsignedTx: { uuid?: string };
    revokeTxsStatusMap: Record<string, { status: string }>;
  }) => (
    <div data-testid={`revoke-item-${unsignedTx.uuid ?? ''}`}>
      {revokeTxsStatusMap[unsignedTx.uuid ?? '']?.status ?? 'Pending'}
    </div>
  ),
}));

jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const Box = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  // The real Page fires onClose from its unmount cleanup (PageLifeCycle).
  const Page = ({
    children,
    onClose,
  }: {
    children?: ReactNode;
    onClose?: () => void;
  }) => {
    const onCloseRef = React.useRef(onClose);
    onCloseRef.current = onClose;
    React.useEffect(() => () => onCloseRef.current?.(), []);
    return <div data-testid="page">{children}</div>;
  };
  Page.Header = ({ title }: { title?: string }) => <h1>{title}</h1>;
  Page.Body = Box;
  Page.Footer = Box;
  Page.FooterActions = ({
    cancelButton,
    children,
    onConfirm,
    onConfirmText,
  }: {
    cancelButton?: ReactNode;
    children?: ReactNode;
    onConfirm?: () => void;
    onConfirmText?: string;
  }) => (
    <div>
      {children}
      {cancelButton}
      <button
        data-testid="page-footer-confirm"
        onClick={() => onConfirm?.()}
        type="button"
      >
        {onConfirmText}
      </button>
    </div>
  );
  return {
    Accordion: Box,
    Alert: ({ title }: { title?: string }) => <div>{title}</div>,
    Button: ({
      children,
      onPress,
      testID,
    }: {
      children?: ReactNode;
      onPress?: () => void;
      testID?: string;
    }) => (
      <button data-testid={testID} onClick={() => onPress?.()} type="button">
        {children}
      </button>
    ),
    Dialog: { show: jest.fn() },
    NumberSizeableText: ({ children }: { children?: ReactNode }) => (
      <span>{children}</span>
    ),
    Page,
    SizableText: ({ children }: { children?: ReactNode }) => (
      <span>{children}</span>
    ),
    Stack: Box,
    XStack: Box,
    YStack: Box,
    getCurrentVisibilityState: () => true,
    onVisibilityStateChange: () => () => {},
  };
});

function createTx(uuid: string): IUnsignedTxPro {
  return {
    uuid,
    accountId: "hd-1--m/44'/60'/0'/0/0",
    networkId: 'evm--1',
    encodedTx: { to: uuid, data: '0x' },
  } as unknown as IUnsignedTxPro;
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

// Mirrors the hardware SDK's "Action cancelled by user on call queue" (822),
// which the page treats as a plain failure rather than an interrupt.
const cancelledError = {
  code: 822,
  message: 'Action cancelled by user on call queue',
};

async function flushAsyncWork() {
  await act(async () => {
    await new Promise((resolve) => {
      setTimeout(resolve, 20);
    });
  });
}

function getCancelRetryButton() {
  return screen.getByTestId(ApprovalManagementTestIDs.bulkRevokeCancelRetryBtn);
}

function getConfirmButton() {
  return screen.getByTestId('page-footer-confirm');
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('BulkRevoke cancel / retry', () => {
  it('aborts and leaves the page when cancel is pressed while a run is still in progress', async () => {
    const pendingSign = createDeferred<unknown>();
    mockBatchSignAndSendTransaction
      .mockRejectedValueOnce(cancelledError)
      .mockReturnValueOnce(pendingSign.promise);
    mockRouteParams = {
      unsignedTxs: [createTx('tx-1'), createTx('tx-2')],
      contractMap: {},
    };

    render(<BulkRevoke />);

    await waitFor(() =>
      expect(mockBatchSignAndSendTransaction).toHaveBeenCalledTimes(2),
    );
    expect(screen.getByTestId('revoke-item-tx-1').textContent).toBe(
      ERevokeTxStatus.Failed,
    );
    const cancelButton = getCancelRetryButton();
    expect(cancelButton.textContent).toBe(ETranslations.global_cancel);

    fireEvent.click(cancelButton);

    expect(mockPopStack).toHaveBeenCalledTimes(1);

    // The device call that was in flight settles later; the aborted run must
    // neither restart nor sign anything else.
    await act(async () => {
      pendingSign.reject(cancelledError);
    });
    await flushAsyncWork();
    expect(mockBatchSignAndSendTransaction).toHaveBeenCalledTimes(2);
  });

  it('aborts when cancel is pressed while the run is paused', async () => {
    const pendingSign = createDeferred<unknown>();
    mockBatchSignAndSendTransaction
      .mockRejectedValueOnce(cancelledError)
      .mockReturnValueOnce(pendingSign.promise);
    mockRouteParams = {
      unsignedTxs: [createTx('tx-1'), createTx('tx-2')],
      contractMap: {},
    };

    render(<BulkRevoke />);

    await waitFor(() =>
      expect(mockBatchSignAndSendTransaction).toHaveBeenCalledTimes(2),
    );
    fireEvent.click(getConfirmButton());
    expect(getConfirmButton().textContent).toBe(ETranslations.global_resume);

    fireEvent.click(getCancelRetryButton());

    expect(mockPopStack).toHaveBeenCalledTimes(1);
    await act(async () => {
      pendingSign.reject(cancelledError);
    });
    await flushAsyncWork();
    expect(mockBatchSignAndSendTransaction).toHaveBeenCalledTimes(2);
  });

  it('retries only the unfinished txs once the run has finished', async () => {
    const retrySign = createDeferred<unknown>();
    mockBatchSignAndSendTransaction
      .mockResolvedValueOnce([{ signedTx: { txid: '0xtx1' } }])
      .mockRejectedValueOnce(cancelledError)
      .mockReturnValueOnce(retrySign.promise);
    mockRouteParams = {
      unsignedTxs: [createTx('tx-1'), createTx('tx-2')],
      contractMap: {},
    };

    render(<BulkRevoke />);

    const retryLabel = `${ETranslations.global_retry} (1)`;
    await waitFor(() =>
      expect(getCancelRetryButton().textContent).toBe(retryLabel),
    );
    expect(screen.getByTestId('revoke-item-tx-1').textContent).toBe(
      ERevokeTxStatus.Succeeded,
    );

    fireEvent.click(getCancelRetryButton());

    await waitFor(() =>
      expect(mockBatchSignAndSendTransaction).toHaveBeenCalledTimes(3),
    );
    const retryParams = mockBatchSignAndSendTransaction.mock.calls[2][0] as {
      unsignedTxs: IUnsignedTxPro[];
    };
    expect(retryParams.unsignedTxs.map((tx) => tx.uuid)).toEqual(['tx-2']);
    expect(mockPopStack).not.toHaveBeenCalled();
    expect(screen.queryByTestId('revoke-item-tx-1')).toBeNull();
    // Progress restarts from the first remaining tx instead of carrying the
    // index of the previous run over a shorter list.
    expect(
      screen.getByText((content) => content.startsWith('1/1 ')),
    ).toBeTruthy();

    await act(async () => {
      retrySign.resolve([{ signedTx: { txid: '0xtx2' } }]);
    });
    await flushAsyncWork();
    expect(getConfirmButton().textContent).toBe(ETranslations.global_finish);
  });
});
