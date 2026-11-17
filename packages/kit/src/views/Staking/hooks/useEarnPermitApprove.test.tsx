/* eslint-disable import/first */

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceAccount: { getAccount: jest.fn() },
    serviceStaking: { buildPermit2ApproveSignData: jest.fn() },
  },
}));
jest.mock('../../../hooks/useSignatureConfirm', () => ({
  useSignatureConfirm: jest.fn(),
}));

import { renderHook } from '@testing-library/react-native';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { MorphoBundlerContract } from '@onekeyhq/shared/src/consts/addresses';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type { IEarnPermit2ApproveSignData } from '@onekeyhq/shared/types/staking';

import { useSignatureConfirm } from '../../../hooks/useSignatureConfirm';

import { useEarnPermitApprove } from './useEarnPermitApprove';

const owner = '0x1111111111111111111111111111111111111111';
const token = {
  address: '0x2222222222222222222222222222222222222222',
  symbol: 'USDC',
  name: 'USDC',
  decimals: 6,
  isNative: false,
  networkId: 'evm--1',
};
const params = {
  accountId: 'account-1',
  networkId: 'evm--1',
  token,
  amountValue: '1.25',
  providerName: 'Morpho',
  vaultAddress: '0x3333333333333333333333333333333333333333',
};
const messageConfirm = jest.fn().mockResolvedValue('signed');
const staking = jest.mocked(backgroundApiProxy.serviceStaking);
const accounts = jest.mocked(backgroundApiProxy.serviceAccount);
let payload: IEarnPermit2ApproveSignData;

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(useSignatureConfirm).mockReturnValue({
    navigationToMessageConfirmAsync: messageConfirm,
    navigationToMessageConfirm: jest.fn(),
    navigationToTxConfirm: jest.fn(),
    normalizeTxConfirm: jest.fn(),
  } as ReturnType<typeof useSignatureConfirm>);
  accounts.getAccount.mockResolvedValue({ address: owner } as Awaited<
    ReturnType<typeof backgroundApiProxy.serviceAccount.getAccount>
  >);
  payload = {
    domain: {
      name: 'USD Coin',
      version: '2',
      chainId: 1,
      verifyingContract: token.address,
    },
    types: {
      EIP712Domain: [
        { name: 'name', type: 'string' },
        { name: 'version', type: 'string' },
        { name: 'chainId', type: 'uint256' },
        { name: 'verifyingContract', type: 'address' },
      ],
      Permit: [
        { name: 'owner', type: 'address' },
        { name: 'spender', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'nonce', type: 'uint256' },
        { name: 'deadline', type: 'uint256' },
      ],
    },
    primaryType: 'Permit',
    message: {
      owner,
      spender: MorphoBundlerContract,
      value: '1250000',
      nonce: '0',
      deadline: String(Math.floor(Date.now() / 1000) + 3600),
    },
  };
  staking.buildPermit2ApproveSignData.mockResolvedValue(payload);
});

it('signs a validated permit only after the current selection check', async () => {
  const beforeSign = jest.fn().mockResolvedValue(undefined);
  const { result } = renderHook(() => useEarnPermitApprove());
  await expect(
    result.current.getPermitSignature({ ...params, beforeSign }),
  ).resolves.toMatchObject({ signature: 'signed', unsignedMessage: payload });
  expect(beforeSign).toHaveBeenCalledTimes(1);
  expect(messageConfirm).toHaveBeenCalledTimes(1);
  const actual = JSON.parse(
    messageConfirm.mock.calls[0][0].unsignedMessage.message,
  ) as IEarnPermit2ApproveSignData;
  expect(actual.message.spender).toBe(MorphoBundlerContract);
});
it.each(['spender', 'owner', 'value', 'deadline'] as const)(
  'never opens signing for a substituted %s',
  async (field) => {
    payload.message[field] = '0';
    const { result } = renderHook(() => useEarnPermitApprove());
    await expect(result.current.getPermitSignature(params)).rejects.toThrow();
    expect(messageConfirm).not.toHaveBeenCalled();
  },
);
it('never opens signing when the signed schema omits the validated spender', async () => {
  payload.types.Permit = payload.types.Permit.filter(
    ({ name }) => name !== 'spender',
  );
  const beforeSign = jest.fn();
  const { result } = renderHook(() => useEarnPermitApprove());
  await expect(
    result.current.getPermitSignature({ ...params, beforeSign }),
  ).rejects.toThrow('Invalid Earn permit authorization');
  expect(beforeSign).not.toHaveBeenCalled();
  expect(messageConfirm).not.toHaveBeenCalled();
});

it('does not sign after the selected account or protocol changes during the fetch', async () => {
  const { result } = renderHook(() => useEarnPermitApprove());
  await expect(
    result.current.getPermitSignature({
      ...params,
      beforeSign: async () => {
        throw new OneKeyLocalError('selection changed');
      },
    }),
  ).rejects.toThrow('selection changed');
  expect(messageConfirm).not.toHaveBeenCalled();
});
it('does not open signing when the API fails', async () => {
  staking.buildPermit2ApproveSignData.mockRejectedValueOnce(
    new Error('offline'),
  );
  const { result } = renderHook(() => useEarnPermitApprove());
  await expect(result.current.getPermitSignature(params)).rejects.toThrow(
    'offline',
  );
  expect(messageConfirm).not.toHaveBeenCalled();
});
