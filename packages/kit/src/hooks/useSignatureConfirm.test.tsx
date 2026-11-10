/** @jest-environment jsdom */

import { act, renderHook } from '@testing-library/react';

import type { IUnsignedTxPro } from '@onekeyhq/core/src/types';
import type { ITransferInfo } from '@onekeyhq/kit-bg/src/vaults/types';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { EModalSignatureConfirmRoutes } from '@onekeyhq/shared/src/routes';

import { useSignatureConfirm } from './useSignatureConfirm';

const mockPush = jest.fn();
const mockPushModal = jest.fn();
const mockPreActionsBeforeConfirm = jest.fn(
  async (_params: unknown): Promise<Record<string, never>> => ({}),
);
const mockPrepareUnsigned = jest.fn<Promise<IUnsignedTxPro>, [unknown]>();
const mockFindLnurl = jest.fn<Promise<{ tag: string } | null>, [unknown]>();
const mockToastMessage = jest.fn((_params: unknown): void => undefined);

jest.mock('@onekeyhq/components', () => ({
  Toast: {
    message: (params: unknown): void => mockToastMessage(params),
  },
}));

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('./useAppNavigation', () => ({
  __esModule: true,
  default: () => ({
    push: mockPush,
    pushModal: mockPushModal,
  }),
}));

jest.mock('../background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceSend: {
      prepareSendConfirmUnsignedTx: (params: unknown) =>
        mockPrepareUnsigned(params),
    },
    serviceLightning: {
      findAndValidateLnurl: (params: unknown) => mockFindLnurl(params),
    },
    serviceSignatureConfirm: {
      preActionsBeforeConfirm: async (
        params: unknown,
      ): Promise<Record<string, never>> => mockPreActionsBeforeConfirm(params),
    },
  },
}));

describe('useSignatureConfirm', () => {
  const unsignedTx = {} as IUnsignedTxPro;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrepareUnsigned.mockResolvedValue(unsignedTx);
    mockFindLnurl.mockResolvedValue(null);
  });

  it.each([false, true])(
    'passes the late broadcast observer to the confirmation route (sameModal=%s)',
    async (sameModal) => {
      const onLateBroadcastAccepted = jest.fn();
      const { result } = renderHook(() =>
        useSignatureConfirm({
          accountId: 'account-id',
          networkId: 'network-id',
        }),
      );
      await act(async () => {
        await result.current.navigationToTxConfirm({
          unsignedTx,
          sameModal,
          onLateBroadcastAccepted,
        });
      });
      if (sameModal) {
        expect(mockPush).toHaveBeenCalledWith(
          EModalSignatureConfirmRoutes.TxConfirm,
          expect.objectContaining({ onLateBroadcastAccepted }),
        );
      } else {
        expect(mockPushModal).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            params: expect.objectContaining({ onLateBroadcastAccepted }),
          }),
        );
      }
    },
  );

  it.each([false, true])(
    'preserves setup error semantics (onFail present=%s)',
    async (hasOnFail) => {
      const error = new Error('prepare failed');
      mockPrepareUnsigned.mockRejectedValueOnce(error);
      const onFail = jest.fn();
      const onConfirmationFail = jest.fn();
      const { result } = renderHook(() =>
        useSignatureConfirm({
          accountId: 'account-id',
          networkId: 'network-id',
        }),
      );
      const promise = result.current.navigationToTxConfirm({
        onFail: hasOnFail ? onFail : undefined,
        onConfirmationFail,
      });
      if (hasOnFail) {
        await expect(promise).resolves.toBeUndefined();
        expect(onFail).toHaveBeenCalledWith(error);
      } else {
        await expect(promise).rejects.toBe(error);
        expect(onFail).not.toHaveBeenCalled();
      }
      expect(onConfirmationFail).not.toHaveBeenCalled();
    },
  );

  it.each([
    [false, false],
    [false, true],
    [true, false],
    [true, true],
  ])(
    'routes synchronous confirmation failures separately (sameModal=%s, onFail=%s)',
    async (sameModal, hasOnFail) => {
      const error = new Error('confirmation failed');
      const onFail = jest.fn();
      const onConfirmationFail = jest.fn();
      const { result } = renderHook(() =>
        useSignatureConfirm({
          accountId: 'account-id',
          networkId: 'network-id',
        }),
      );
      const push = sameModal ? mockPush : mockPushModal;
      push.mockImplementationOnce(
        (
          _route: unknown,
          args: {
            params?: { onFail?: (e: Error) => void };
            onFail?: (e: Error) => void;
          },
        ) => {
          (sameModal ? args.onFail : args.params?.onFail)?.(error);
        },
      );
      await result.current.navigationToTxConfirm({
        unsignedTxs: [unsignedTx],
        sameModal,
        onFail: hasOnFail ? onFail : undefined,
        onConfirmationFail,
      });
      expect(onConfirmationFail).toHaveBeenCalledWith(error);
      expect(onFail).not.toHaveBeenCalled();
    },
  );

  it.each(['payRequest', 'withdrawRequest'] as const)(
    'routes lightning %s confirmation failures without changing its setup failure callback',
    async (tag) => {
      const error = new Error('lightning confirmation failed');
      const onFail = jest.fn();
      const onConfirmationFail = jest.fn();
      mockFindLnurl.mockResolvedValueOnce({ tag });
      const { result } = renderHook(() =>
        useSignatureConfirm({
          accountId: 'account-id',
          networkId: getNetworkIdsMap().lightning,
        }),
      );
      mockPush.mockImplementationOnce(
        (_route: unknown, args: { onFail?: (e: Error) => void }) =>
          args.onFail?.(error),
      );
      await result.current.navigationToTxConfirm({
        transfersInfo: [{ to: 'lnurl' } as ITransferInfo],
        onFail,
        onConfirmationFail,
      });
      expect(onConfirmationFail).toHaveBeenCalledWith(error);
      expect(onFail).not.toHaveBeenCalled();
    },
  );

  it('keeps the legacy confirmation failure handler when no observer is provided', async () => {
    const onFail = jest.fn();
    const error = new Error('confirmation failed');
    const { result } = renderHook(() =>
      useSignatureConfirm({ accountId: 'account-id', networkId: 'network-id' }),
    );
    mockPush.mockImplementationOnce(
      (_route: unknown, args: { onFail?: (e: Error) => void }) =>
        args.onFail?.(error),
    );
    await result.current.navigationToTxConfirm({
      unsignedTxs: [unsignedTx],
      sameModal: true,
      onFail,
    });
    expect(onFail).toHaveBeenCalledTimes(1);
    expect(onFail).toHaveBeenCalledWith(error);
  });

  it('does not pass the confirmation observer into unsigned transaction preparation', async () => {
    const onConfirmationFail = jest.fn();
    const { result } = renderHook(() =>
      useSignatureConfirm({ accountId: 'account-id', networkId: 'network-id' }),
    );
    await result.current.navigationToTxConfirm({ onConfirmationFail });
    expect(mockPrepareUnsigned).toHaveBeenCalledTimes(1);
    expect(mockPrepareUnsigned.mock.calls[0][0]).not.toHaveProperty(
      'onConfirmationFail',
    );
  });

  it('keeps lightning setup errors separate from confirmation failures', async () => {
    const failure = new Error('invalid LNURL');
    const onConfirmationFail = jest.fn();
    mockFindLnurl.mockRejectedValueOnce(failure);
    const { result } = renderHook(() =>
      useSignatureConfirm({
        accountId: 'account-id',
        networkId: getNetworkIdsMap().lightning,
      }),
    );
    await expect(
      result.current.navigationToTxConfirm({
        transfersInfo: [{ to: 'lnurl' } as ITransferInfo],
        onConfirmationFail,
      }),
    ).rejects.toBe(failure);
    expect(onConfirmationFail).not.toHaveBeenCalled();
  });

  it('preserves lightning setup error callback and invoice fallback', async () => {
    const failure = new Error('invalid LNURL');
    const onFail = jest.fn();
    const onConfirmationFail = jest.fn();
    mockFindLnurl.mockRejectedValueOnce(failure);
    const { result } = renderHook(() =>
      useSignatureConfirm({
        accountId: 'account-id',
        networkId: getNetworkIdsMap().lightning,
      }),
    );
    await result.current.navigationToTxConfirm({
      transfersInfo: [{ to: 'lnurl' } as ITransferInfo],
      unsignedTxs: [unsignedTx],
      sameModal: true,
      onFail,
      onConfirmationFail,
    });
    expect(onFail).toHaveBeenCalledWith(failure);
    expect(onConfirmationFail).not.toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith(
      EModalSignatureConfirmRoutes.TxConfirm,
      expect.objectContaining({ onFail: onConfirmationFail }),
    );
  });

  it('opens Private Send directly in TxConfirm', async () => {
    const { result } = renderHook(() =>
      useSignatureConfirm({ accountId: 'account-id', networkId: 'network-id' }),
    );

    await act(async () => {
      await result.current.normalizeTxConfirm({
        unsignedTxs: [unsignedTx],
        sameModal: true,
        isInternalSwap: true,
        transferPayload: {
          amountToSend: '1',
          isMaxSend: false,
          isNFT: false,
          isPrivateSend: true,
          originalRecipient: 'recipient',
        },
      });
    });

    expect(mockPush).toHaveBeenCalledWith(
      EModalSignatureConfirmRoutes.TxConfirm,
      expect.objectContaining({
        unsignedTxs: [unsignedTx],
        gasAccountScenario: 'privateSend',
        transferPayload: expect.objectContaining({ isPrivateSend: true }),
      }),
    );
  });

  it('keeps regular internal swaps on TxConfirmFromSwap', async () => {
    const { result } = renderHook(() =>
      useSignatureConfirm({ accountId: 'account-id', networkId: 'network-id' }),
    );

    await act(async () => {
      await result.current.normalizeTxConfirm({
        unsignedTxs: [unsignedTx],
        sameModal: true,
        isInternalSwap: true,
      });
    });

    expect(mockPush).toHaveBeenCalledWith(
      EModalSignatureConfirmRoutes.TxConfirmFromSwap,
      expect.objectContaining({
        unsignedTxs: [unsignedTx],
        gasAccountScenario: 'swap',
      }),
    );
  });

  it.each([true, false])(
    'does not open a stale confirmation after async preparation (sameModal=%s)',
    async (sameModal) => {
      let resolvePreparation!: (value: Record<string, never>) => void;
      mockPreActionsBeforeConfirm.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolvePreparation = resolve;
          }),
      );
      let active = true;
      const { result } = renderHook(() =>
        useSignatureConfirm({
          accountId: 'account-id',
          networkId: 'network-id',
        }),
      );
      let navigation!: Promise<void>;
      await act(async () => {
        navigation = result.current.normalizeTxConfirm({
          unsignedTxs: [unsignedTx],
          sameModal,
          isInternalSwap: true,
          isNavigationCurrent: () => active,
        });
      });
      await act(async () => {
        active = false;
        resolvePreparation({});
        await navigation;
      });
      expect(mockPush).not.toHaveBeenCalled();
      expect(mockPushModal).not.toHaveBeenCalled();
    },
  );

  describe('Lightning Self-Custody', () => {
    const sparkNetworkId = 'lightningspark--0';
    const transfersInfo = (to: string) => [{ from: '', to, amount: '0' }];
    const renderSpark = () =>
      renderHook(() =>
        useSignatureConfirm({
          accountId: 'account-id',
          networkId: sparkNetworkId,
        }),
      );

    it('opens the custodial LNURL pay page for a Lightning address', async () => {
      const lnurlDetails = {
        tag: 'payRequest',
        callback: 'https://example.com/lnurlp/alice/callback',
        minSendable: 1000,
        maxSendable: 1_000_000,
        metadata: '[["text/plain","alice"]]',
        domain: 'example.com',
        url: 'https://example.com/.well-known/lnurlp/alice',
      };
      mockFindLnurl.mockResolvedValueOnce(lnurlDetails);
      const { result } = renderSpark();

      await act(async () => {
        await result.current.navigationToTxConfirm({
          transfersInfo: transfersInfo('alice@example.com'),
          sameModal: true,
        });
      });

      expect(mockFindLnurl).toHaveBeenCalledWith({
        toVal: 'alice@example.com',
        networkId: sparkNetworkId,
      });
      expect(mockPush).toHaveBeenCalledWith(
        EModalSignatureConfirmRoutes.LnurlPayRequest,
        expect.objectContaining({
          networkId: sparkNetworkId,
          accountId: 'account-id',
          lnurlDetails,
          isSendFlow: true,
        }),
      );
      expect(mockPrepareUnsigned).not.toHaveBeenCalled();
    });

    it('routes a failure of the LNURL pay page to the confirmation observer', async () => {
      const error = new Error('lightning confirmation failed');
      const onFail = jest.fn();
      const onConfirmationFail = jest.fn();
      mockFindLnurl.mockResolvedValueOnce({ tag: 'payRequest' });
      mockPush.mockImplementationOnce(
        (_route: unknown, args: { onFail?: (e: Error) => void }) =>
          args.onFail?.(error),
      );
      const { result } = renderSpark();

      await result.current.navigationToTxConfirm({
        transfersInfo: transfersInfo('alice@example.com'),
        onFail,
        onConfirmationFail,
      });

      expect(onConfirmationFail).toHaveBeenCalledWith(error);
      expect(onFail).not.toHaveBeenCalled();
    });

    it('opens the custodial LNURL withdraw page for a withdraw request', async () => {
      const lnurlDetails = {
        tag: 'withdrawRequest',
        callback: 'https://example.com/lnurlw/callback',
        k1: 'k1-example',
        defaultDescription: 'Voucher',
        minWithdrawable: 1000,
        maxWithdrawable: 21_000,
        url: 'https://example.com/lnurlw',
      };
      mockFindLnurl.mockResolvedValueOnce(lnurlDetails);
      const { result } = renderSpark();

      await act(async () => {
        await result.current.navigationToTxConfirm({
          transfersInfo: transfersInfo('lnurl1dp68gurn8ghj7example'),
          sameModal: true,
        });
      });

      expect(mockFindLnurl).toHaveBeenCalledWith({
        toVal: 'lnurl1dp68gurn8ghj7example',
        networkId: sparkNetworkId,
      });
      expect(mockPush).toHaveBeenCalledWith(
        EModalSignatureConfirmRoutes.LnurlWithdraw,
        {
          networkId: sparkNetworkId,
          accountId: 'account-id',
          lnurlDetails,
          isSendFlow: true,
        },
      );
      expect(mockToastMessage).not.toHaveBeenCalled();
      expect(mockPrepareUnsigned).not.toHaveBeenCalled();
    });

    it('shows coming soon for an LNURL login and opens nothing', async () => {
      mockFindLnurl.mockResolvedValueOnce({ tag: 'login' });
      const { result } = renderSpark();

      await act(async () => {
        await result.current.navigationToTxConfirm({
          transfersInfo: transfersInfo('lnurl1dp68gurn8ghj7example'),
          sameModal: true,
        });
      });

      expect(mockToastMessage).toHaveBeenCalledWith({
        title: 'wallet.feature_coming_soon',
      });
      expect(mockPush).not.toHaveBeenCalled();
      expect(mockPrepareUnsigned).not.toHaveBeenCalled();
    });

    it('sends an invoice to the confirm page without resolving LNURL', async () => {
      const { result } = renderSpark();

      await act(async () => {
        await result.current.navigationToTxConfirm({
          transfersInfo: transfersInfo('lnbc120n1p5example'),
          sameModal: true,
        });
      });

      expect(mockFindLnurl).not.toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith(
        EModalSignatureConfirmRoutes.TxConfirm,
        expect.objectContaining({ unsignedTxs: [unsignedTx] }),
      );
    });
  });
});
