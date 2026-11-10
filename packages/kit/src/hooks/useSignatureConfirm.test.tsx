/** @jest-environment jsdom */

import { act, renderHook } from '@testing-library/react';

import type { IUnsignedTxPro } from '@onekeyhq/core/src/types';
import { EModalSignatureConfirmRoutes } from '@onekeyhq/shared/src/routes';

import { useSignatureConfirm } from './useSignatureConfirm';

const mockPush = jest.fn();
const mockPushModal = jest.fn();
const mockPreActionsBeforeConfirm = jest.fn(
  async (_params: unknown): Promise<Record<string, never>> => ({}),
);
const mockFindAndValidateLnurl = jest.fn(
  async (_params: unknown): Promise<unknown> => null,
);
const mockPrepareSendConfirmUnsignedTx = jest.fn(
  async (_params: unknown): Promise<unknown> => ({}),
);
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
    serviceSignatureConfirm: {
      preActionsBeforeConfirm: async (
        params: unknown,
      ): Promise<Record<string, never>> => mockPreActionsBeforeConfirm(params),
    },
    serviceLightning: {
      findAndValidateLnurl: (params: unknown) =>
        mockFindAndValidateLnurl(params),
    },
    serviceSend: {
      prepareSendConfirmUnsignedTx: (params: unknown) =>
        mockPrepareSendConfirmUnsignedTx(params),
    },
  },
}));

describe('useSignatureConfirm', () => {
  const unsignedTx = {} as IUnsignedTxPro;

  beforeEach(() => {
    jest.clearAllMocks();
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
      mockFindAndValidateLnurl.mockResolvedValueOnce(lnurlDetails);
      const { result } = renderSpark();

      await act(async () => {
        await result.current.navigationToTxConfirm({
          transfersInfo: transfersInfo('alice@example.com'),
          sameModal: true,
        });
      });

      expect(mockFindAndValidateLnurl).toHaveBeenCalledWith({
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
      expect(mockPrepareSendConfirmUnsignedTx).not.toHaveBeenCalled();
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
      mockFindAndValidateLnurl.mockResolvedValueOnce(lnurlDetails);
      const { result } = renderSpark();

      await act(async () => {
        await result.current.navigationToTxConfirm({
          transfersInfo: transfersInfo('lnurl1dp68gurn8ghj7example'),
          sameModal: true,
        });
      });

      expect(mockFindAndValidateLnurl).toHaveBeenCalledWith({
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
      expect(mockPrepareSendConfirmUnsignedTx).not.toHaveBeenCalled();
    });

    it('shows coming soon for an LNURL login and opens nothing', async () => {
      mockFindAndValidateLnurl.mockResolvedValueOnce({ tag: 'login' });
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
      expect(mockPrepareSendConfirmUnsignedTx).not.toHaveBeenCalled();
    });

    it('sends an invoice to the confirm page without resolving LNURL', async () => {
      mockPrepareSendConfirmUnsignedTx.mockResolvedValueOnce(unsignedTx);
      const { result } = renderSpark();

      await act(async () => {
        await result.current.navigationToTxConfirm({
          transfersInfo: transfersInfo('lnbc120n1p5example'),
          sameModal: true,
        });
      });

      expect(mockFindAndValidateLnurl).not.toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith(
        EModalSignatureConfirmRoutes.TxConfirm,
        expect.objectContaining({ unsignedTxs: [unsignedTx] }),
      );
    });
  });
});
