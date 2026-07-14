/* eslint-disable import/first */
// cspell:ignore emode
jest.mock('react-intl', () => {
  const actual = jest.requireActual<typeof import('react-intl')>('react-intl');
  return {
    __esModule: true,
    ...actual,
    useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
  };
});
jest.mock('@onekeyhq/components', () => ({
  __esModule: true,
  Toast: { error: jest.fn() },
}));
jest.mock(
  '@onekeyhq/kit/src/components/DeFi/DeFiActionTxConfirmResult',
  () => ({
    __esModule: true,
    showDeFiActionTxConfirmDialog: jest.fn().mockResolvedValue(undefined),
  }),
);
jest.mock('@onekeyhq/kit/src/hooks/useSignatureConfirm', () => {
  const navigationToTxConfirm = jest.fn();
  (globalThis as any).__emodeSignatureMock = { navigationToTxConfirm };
  return {
    __esModule: true,
    useSignatureConfirm: () => ({ navigationToTxConfirm }),
  };
});
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => {
  const serviceStaking = {
    addEarnOrder: jest.fn(),
    borrowBuildSetEModeTransaction: jest.fn(),
    borrowBuildSetCollateralTransaction: jest.fn(),
  };
  (globalThis as any).__emodeBackgroundMock = { serviceStaking };
  return { __esModule: true, default: { serviceStaking } };
});

import { act, renderHook } from '@testing-library/react-native';

import {
  useUniversalBorrowSetCollateral,
  useUniversalBorrowSetEMode,
} from './useUniversalBorrowHooks';

const sig = (globalThis as any).__emodeSignatureMock as {
  navigationToTxConfirm: jest.Mock;
};
const bg = (globalThis as any).__emodeBackgroundMock as {
  serviceStaking: {
    borrowBuildSetEModeTransaction: jest.Mock;
    borrowBuildSetCollateralTransaction: jest.Mock;
  };
};

beforeEach(() => {
  sig.navigationToTxConfirm.mockReset();
  bg.serviceStaking.borrowBuildSetEModeTransaction.mockReset();
  bg.serviceStaking.borrowBuildSetCollateralTransaction.mockReset();
});

it('set-emode builds tx then opens the confirm with the parsed encodedTx', async () => {
  bg.serviceStaking.borrowBuildSetEModeTransaction.mockResolvedValue({
    tx: '{"to":"0xpool","data":"0x"}',
    orderId: 'o1',
  });
  const { result } = renderHook(() =>
    useUniversalBorrowSetEMode({ networkId: 'evm--1', accountId: 'acc-1' }),
  );
  await act(async () => {
    await result.current({
      provider: 'aave',
      marketAddress: '0xmkt',
      eModeId: 1,
    });
  });
  expect(bg.serviceStaking.borrowBuildSetEModeTransaction).toHaveBeenCalledWith(
    {
      networkId: 'evm--1',
      accountId: 'acc-1',
      provider: 'aave',
      marketAddress: '0xmkt',
      eModeId: 1,
    },
  );
  expect(sig.navigationToTxConfirm).toHaveBeenCalledTimes(1);
  expect(sig.navigationToTxConfirm.mock.calls[0][0].encodedTx).toEqual({
    to: '0xpool',
    data: '0x',
  });
});

it('set-collateral forwards reserveAddress/useAsCollateral/eModeId', async () => {
  bg.serviceStaking.borrowBuildSetCollateralTransaction.mockResolvedValue({
    tx: '0xraw',
  });
  const { result } = renderHook(() =>
    useUniversalBorrowSetCollateral({
      networkId: 'evm--1',
      accountId: 'acc-1',
    }),
  );
  await act(async () => {
    await result.current({
      provider: 'aave',
      marketAddress: '0xmkt',
      reserveAddress: '0xusdc',
      useAsCollateral: false,
      eModeId: 1,
    });
  });
  expect(
    bg.serviceStaking.borrowBuildSetCollateralTransaction,
  ).toHaveBeenCalledWith({
    networkId: 'evm--1',
    accountId: 'acc-1',
    provider: 'aave',
    marketAddress: '0xmkt',
    reserveAddress: '0xusdc',
    useAsCollateral: false,
    eModeId: 1,
  });
  expect(sig.navigationToTxConfirm).toHaveBeenCalledTimes(1);
  expect(sig.navigationToTxConfirm.mock.calls[0][0].encodedTx).toBe('0xraw');
});
