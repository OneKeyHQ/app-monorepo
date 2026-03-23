/**
 * @jest-environment jsdom
 */
/* eslint-disable import/first */

jest.mock('react-intl', () => {
  const actualReactIntl =
    jest.requireActual<typeof import('react-intl')>('react-intl');

  return {
    __esModule: true,
    ...actualReactIntl,
    useIntl: () => ({
      formatMessage: ({ id }: { id: string }) => id,
    }),
  };
});

jest.mock('@onekeyhq/components', () => ({
  __esModule: true,
  Toast: {
    error: jest.fn(),
  },
}));

jest.mock('@onekeyhq/kit/src/hooks/useSignatureConfirm', () => {
  const navigationToTxConfirm = jest.fn();

  (globalThis as any).__borrowSignatureConfirmMock = {
    navigationToTxConfirm,
  };

  return {
    __esModule: true,
    useSignatureConfirm: () => ({
      navigationToTxConfirm,
    }),
  };
});

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => {
  const serviceStaking = {
    addEarnOrder: jest.fn(),
    borrowBuildRepayWithCollateralTransaction: jest.fn(),
    borrowBuildSetupLutTransaction: jest.fn(),
    updateEarnOrder: jest.fn(),
    waitForSolTxFinalized: jest.fn(),
  };

  (globalThis as any).__borrowBackgroundMock = {
    serviceStaking,
  };

  return {
    __esModule: true,
    default: {
      serviceStaking,
    },
  };
});

jest.mock('@onekeyhq/shared/src/utils/timerUtils', () => ({
  __esModule: true,
  default: {
    wait: jest.fn().mockResolvedValue(undefined),
  },
}));

import { act, renderHook } from '@testing-library/react';

import { Toast } from '@onekeyhq/components';

import { useUniversalBorrowRepayWithCollateral } from './useUniversalBorrowHooks';

const signatureConfirmMock = (globalThis as any)
  .__borrowSignatureConfirmMock as {
  navigationToTxConfirm: jest.Mock;
};
const backgroundMock = (globalThis as any).__borrowBackgroundMock as {
  serviceStaking: {
    addEarnOrder: jest.Mock;
    borrowBuildRepayWithCollateralTransaction: jest.Mock;
    borrowBuildSetupLutTransaction: jest.Mock;
    updateEarnOrder: jest.Mock;
    waitForSolTxFinalized: jest.Mock;
  };
};

describe('useUniversalBorrowRepayWithCollateral', () => {
  beforeEach(() => {
    signatureConfirmMock.navigationToTxConfirm.mockReset();
    backgroundMock.serviceStaking.addEarnOrder.mockReset();
    backgroundMock.serviceStaking.borrowBuildRepayWithCollateralTransaction.mockReset();
    backgroundMock.serviceStaking.borrowBuildSetupLutTransaction.mockReset();
    backgroundMock.serviceStaking.updateEarnOrder.mockReset();
    backgroundMock.serviceStaking.waitForSolTxFinalized.mockReset();
    (Toast.error as jest.Mock).mockReset();
  });

  it('revalidates manage data after setup LUT finalizes even if repay confirm is cancelled', async () => {
    backgroundMock.serviceStaking.borrowBuildSetupLutTransaction.mockResolvedValue(
      {
        tx: JSON.stringify({}),
        orderId: 'setup-order-id',
      },
    );
    backgroundMock.serviceStaking.waitForSolTxFinalized.mockResolvedValue(
      'finalized',
    );
    backgroundMock.serviceStaking.borrowBuildRepayWithCollateralTransaction.mockResolvedValue(
      {
        tx: JSON.stringify({}),
        orderId: 'repay-order-id',
      },
    );

    let confirmCount = 0;
    signatureConfirmMock.navigationToTxConfirm.mockImplementation(
      async ({
        onCancel,
        onSuccess,
      }: {
        onCancel?: () => void;
        onSuccess?: (
          data: Array<{
            decodedTx: { status: string; txid?: string };
            signedTx: { txid: string };
          }>,
        ) => void;
      }) => {
        confirmCount += 1;

        if (confirmCount === 1) {
          onSuccess?.([
            {
              decodedTx: {
                status: 'confirmed',
                txid: 'setup-tx-id',
              },
              signedTx: {
                txid: 'setup-tx-id',
              },
            },
          ]);
          return;
        }

        onCancel?.();
      },
    );

    const onSetupLutFinalized = jest.fn().mockResolvedValue(undefined);
    const onSuccess = jest.fn();

    const { result } = renderHook(
      () =>
        useUniversalBorrowRepayWithCollateral({
          networkId: 'sol--101',
          accountId: 'hd-1--m/44',
        }),
      {
        reactStrictMode: false,
      },
    );

    await act(async () => {
      await result.current({
        amount: '1',
        provider: 'kamino',
        marketAddress: 'market-address',
        reserveAddress: 'reserve-address',
        collateralReserveAddress: 'collateral-reserve-address',
        needsSetupLut: true,
        onSetupLutFinalized,
        onSuccess,
      });
    });

    expect(onSetupLutFinalized).toHaveBeenCalledTimes(1);
    expect(onSuccess).not.toHaveBeenCalled();
    expect(
      backgroundMock.serviceStaking.borrowBuildRepayWithCollateralTransaction,
    ).toHaveBeenCalledTimes(1);
    expect(Toast.error).not.toHaveBeenCalled();
  });
});
