/** @jest-environment jsdom */

import { act, renderHook, waitFor } from '@testing-library/react';

import type { IUnsignedTxPro } from '@onekeyhq/core/src/types';
import type {
  ISendConfirmationPreparation,
  ITransferInfo,
} from '@onekeyhq/kit-bg/src/vaults/types';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { EModalSignatureConfirmRoutes } from '@onekeyhq/shared/src/routes';
import type { IModalSignatureConfirmParamList } from '@onekeyhq/shared/src/routes';

import { useSignatureConfirm } from './useSignatureConfirm';

type IConfirmParams =
  IModalSignatureConfirmParamList[EModalSignatureConfirmRoutes.TxConfirm];

const mockWaitForPrerequisite = jest.fn<Promise<boolean>, [unknown]>();
const mockPush = jest.fn<void, [string, IConfirmParams]>();
const mockPushModal = jest.fn();
const mockPreActionsBeforeConfirm = jest.fn(
  async (_params: unknown): Promise<Record<string, never>> => ({}),
);
const mockPrepareUnsigned = jest.fn<Promise<IUnsignedTxPro>, [unknown]>();
const mockPrepareUnsignedTxs = jest.fn<
  Promise<IUnsignedTxPro[]>,
  [{ unsignedTxs: IUnsignedTxPro[] }]
>();
const mockPrerequisite = jest.fn<
  ISendConfirmationPreparation['prerequisite'],
  []
>();
const mockFindLnurl = jest.fn<
  Promise<{ tag: 'payRequest' | 'withdrawRequest' } | null>,
  [unknown]
>();

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('./transactionConfirmationUtils', () => ({
  ...jest.requireActual<typeof import('./transactionConfirmationUtils')>(
    './transactionConfirmationUtils',
  ),
  waitForSendPrerequisite: (params: unknown) => mockWaitForPrerequisite(params),
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
    serviceNetwork: {
      getVaultSettings: async ({ networkId }: { networkId: string }) => ({
        prepareSendConfirmation: networkId.startsWith('starknet--'),
      }),
    },
    serviceSend: {
      prepareSendConfirmation: async (params: {
        unsignedTxs: IUnsignedTxPro[];
      }) => ({
        unsignedTxs: await mockPrepareUnsignedTxs(params),
        prerequisite: mockPrerequisite(),
      }),
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
    mockPrepareUnsignedTxs.mockImplementation(
      async (params) => params.unsignedTxs,
    );
    mockFindLnurl.mockResolvedValue(null);
  });

  it.each(['deposit', 'withdraw', 'transfer'] as const)(
    'prepares a %s intent once through the ordinary vault route',
    async (starknetPrivacyKind) => {
      const sender = { accountId: 'account', networkId: 'starknet--mainnet' };
      const transfersInfo: ITransferInfo[] = [
        { from: '0x12', to: '0x34', amount: '0.5', starknetPrivacyKind },
      ];
      const ui = renderHook(() => useSignatureConfirm(sender));
      await act(async () =>
        ui.result.current.navigationToTxConfirm({
          transfersInfo,
          sameModal: true,
        }),
      );
      expect(mockPrepareUnsigned).toHaveBeenCalledTimes(1);
      expect(mockPrepareUnsigned).toHaveBeenCalledWith(
        expect.objectContaining({ ...sender, transfersInfo }),
      );
      expect(mockPush).toHaveBeenCalledWith(
        EModalSignatureConfirmRoutes.TxConfirm,
        expect.objectContaining({ unsignedTxs: [unsignedTx] }),
      );
    },
  );

  it.each([true, false])(
    'opens the transfer only after its prerequisite confirms (submit=%s)',
    async (submit) => {
      const deployTx = {
        encodedTx: { type: 'DEPLOY_ACCOUNT' },
      } as IUnsignedTxPro;
      const transfersInfo = [{ to: '0x123', amount: '1' }] as ITransferInfo[];
      const transferTx = {
        encodedTx: { type: 'INVOKE', deploymentDependency: true },
        transfersInfo,
      } as IUnsignedTxPro;
      const rebuiltTransfer = {
        encodedTx: { type: 'INVOKE' },
      } as IUnsignedTxPro;
      mockPrepareUnsignedTxs.mockResolvedValueOnce([transferTx]);
      mockPrerequisite.mockReturnValueOnce({
        unsignedTx: deployTx,
        transfersInfo,
      });
      mockPrepareUnsigned
        .mockResolvedValueOnce(transferTx)
        .mockResolvedValueOnce(rebuiltTransfer);
      let acceptReceipt!: (confirmed: boolean) => void;
      mockWaitForPrerequisite.mockReturnValueOnce(
        new Promise((resolve) => {
          acceptReceipt = resolve;
        }),
      );
      const onCancel = jest.fn();
      const { result } = renderHook(() =>
        useSignatureConfirm({
          accountId: 'account-id',
          networkId: 'starknet--mainnet',
        }),
      );

      const attempt = result.current.navigationToTxConfirm({
        transfersInfo,
        prerequisites: { isCurrent: () => true },
        sameModal: true,
        onCancel,
      });
      await waitFor(() => expect(mockPush).toHaveBeenCalledTimes(1));
      const [, first] = mockPush.mock.calls[0];
      expect(first.unsignedTxs).toEqual([deployTx]);
      expect(first.transactionStep).toEqual({ step: 1, total: 2 });
      expect(first.popStack).toBe(false);
      if (!submit) {
        first.onCancel?.();
        await attempt;
        expect(onCancel).toHaveBeenCalledTimes(1);
        expect(mockWaitForPrerequisite).not.toHaveBeenCalled();
        expect(mockPush).toHaveBeenCalledTimes(1);
        return;
      }

      first.onSuccess?.([{ signedTx: { txid: '0x123' } }] as Parameters<
        NonNullable<IConfirmParams['onSuccess']>
      >[0]);
      await waitFor(() =>
        expect(mockWaitForPrerequisite).toHaveBeenCalledWith(
          expect.objectContaining({ txid: '0x123' }),
        ),
      );
      expect(mockPush).toHaveBeenCalledTimes(1);
      acceptReceipt(true);
      await attempt;
      expect(mockPush).toHaveBeenCalledTimes(2);
      const [, second] = mockPush.mock.calls[1];
      expect(second.unsignedTxs).toEqual([rebuiltTransfer]);
      expect(second.transactionStep).toEqual({ step: 2, total: 2 });
    },
  );

  it.each([false, true])(
    'passes chain-prepared activation and transfer to the existing confirmation (sameModal=%s)',
    async (sameModal) => {
      const activation = { uuid: 'activation' } as IUnsignedTxPro;
      const transfer = { uuid: 'transfer' } as IUnsignedTxPro;
      mockPrepareUnsignedTxs.mockResolvedValueOnce([activation, transfer]);
      const { result } = renderHook(() =>
        useSignatureConfirm({
          accountId: 'account-id',
          networkId: 'starknet--mainnet',
        }),
      );
      await act(async () => {
        await result.current.navigationToTxConfirm({ sameModal });
      });
      expect(mockPreActionsBeforeConfirm).toHaveBeenCalledWith(
        expect.objectContaining({ unsignedTxs: [activation, transfer] }),
      );
      if (sameModal) {
        expect(mockPush).toHaveBeenCalledWith(
          EModalSignatureConfirmRoutes.TxConfirm,
          expect.objectContaining({ unsignedTxs: [activation, transfer] }),
        );
      } else {
        expect(mockPushModal).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            params: expect.objectContaining({
              unsignedTxs: [activation, transfer],
            }),
          }),
        );
      }
    },
  );

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
    expect(mockPrepareUnsignedTxs).not.toHaveBeenCalled();
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
});
