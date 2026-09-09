/** @jest-environment jsdom */

import { act, renderHook } from '@testing-library/react';

import type { IUnsignedTxPro } from '@onekeyhq/core/src/types';
import { EModalSignatureConfirmRoutes } from '@onekeyhq/shared/src/routes';

import { useSignatureConfirm } from './useSignatureConfirm';

const mockPush = jest.fn();
const mockPreActionsBeforeConfirm = jest.fn(
  async (_params: unknown): Promise<Record<string, never>> => ({}),
);

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('./useAppNavigation', () => ({
  __esModule: true,
  default: () => ({
    push: mockPush,
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
});
