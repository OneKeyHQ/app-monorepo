/** @jest-environment jsdom */

import { act, renderHook } from '@testing-library/react';

import { useSignatureConfirm } from './useSignatureConfirm';

const mockPrepareSendConfirmUnsignedTx = jest.fn();
const mockPreActionsBeforeConfirm = jest.fn();
const mockPushModal = jest.fn();

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('../background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceSend: {
      prepareSendConfirmUnsignedTx: (...args: unknown[]) =>
        mockPrepareSendConfirmUnsignedTx(...args) as unknown,
    },
    serviceSignatureConfirm: {
      preActionsBeforeConfirm: (...args: unknown[]) =>
        mockPreActionsBeforeConfirm(...args) as unknown,
    },
  },
}));

jest.mock('./useAppNavigation', () => ({
  __esModule: true,
  default: () => ({
    pushModal: (...args: unknown[]) => {
      mockPushModal(...args);
    },
    push: jest.fn(),
  }),
}));

describe('useSignatureConfirm', () => {
  beforeEach(() => {
    mockPrepareSendConfirmUnsignedTx.mockReset();
    mockPreActionsBeforeConfirm.mockReset();
    mockPushModal.mockReset();
    mockPreActionsBeforeConfirm.mockResolvedValue({});
    mockPrepareSendConfirmUnsignedTx.mockImplementation(async (params) => ({
      encodedTx: params.encodedTx ?? {},
      approveInfo: params.approveInfo,
      swapInfo: params.swapInfo,
      nonce: params.approveInfo ? 1 : 2,
    }));
  });

  it('attaches per-tx feeInfo before opening approve plus swap confirm', async () => {
    const approveFeeInfo = {
      common: {
        feeDecimals: 9,
        feeSymbol: 'Gwei',
        nativeDecimals: 18,
        nativeSymbol: 'ETH',
      },
      gas: {
        gasPrice: '2',
        gasLimit: '21000',
      },
    };
    const swapFeeInfo = {
      common: approveFeeInfo.common,
      gas: {
        gasPrice: '2',
        gasLimit: '180000',
      },
    };
    const { result } = renderHook(() =>
      useSignatureConfirm({
        accountId: 'account-1',
        networkId: 'evm--1',
      }),
    );

    await act(async () => {
      await result.current.normalizeTxConfirm({
        approvesInfo: [
          {
            owner: '0xowner',
            spender: '0xspender',
            amount: '1',
          },
        ],
        encodedTx: '0xswap',
        feeInfos: [approveFeeInfo, swapFeeInfo],
        useFeeInTx: true,
        feeInfoEditable: false,
        isInternalSwap: true,
      });
    });

    const routeParams = mockPushModal.mock.calls[0][1].params;
    const unsignedTxs = routeParams.unsignedTxs;
    expect(unsignedTxs).toEqual([
      expect.objectContaining({
        feeInfo: approveFeeInfo,
      }),
      expect.objectContaining({
        feeInfo: swapFeeInfo,
      }),
    ]);
    expect(routeParams).toEqual(
      expect.objectContaining({
        useFeeInTx: true,
        feeInfoEditable: false,
      }),
    );
  });
});
