/** @jest-environment jsdom */

import { renderHook } from '@testing-library/react';

import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import {
  EtherFiLiquidReferContract,
  MorphoBaseBundlerContract,
  MorphoBundlerContract,
  MorphoKatanaBundlerContract,
} from '@onekeyhq/shared/src/consts/addresses';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';
import { EMessageTypesEth } from '@onekeyhq/shared/types/message';
import type { IEarnPermit2ApproveSignData } from '@onekeyhq/shared/types/staking';
import type { IToken } from '@onekeyhq/shared/types/token';

import { useEarnPermitApprove } from './useEarnPermitApprove';

const mockGetAccount = jest.fn<Promise<{ address: string }>, [unknown]>();
const mockBuildSignData = jest.fn<
  Promise<IEarnPermit2ApproveSignData>,
  [unknown]
>();
const mockMessageConfirm = jest.fn<Promise<string>, [unknown]>();
const mockPermitSignError = jest.fn<void, [unknown]>();

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceAccount: {
      getAccount: (input: unknown) => mockGetAccount(input),
    },
    serviceStaking: {
      buildPermit2ApproveSignData: (input: unknown) => mockBuildSignData(input),
    },
  },
}));

jest.mock('../../../hooks/useSignatureConfirm', () => ({
  useSignatureConfirm: () => ({
    navigationToMessageConfirmAsync: mockMessageConfirm,
  }),
}));

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    staking: {
      page: {
        permitSignError: (input: unknown) => mockPermitSignError(input),
      },
    },
  },
}));

const accountAddress = '0x1111111111111111111111111111111111111111';
const vaultAddress = '0xf0bb20865277abd641a307ece5ee04e79073416c';
const token: IToken = {
  symbol: 'eETH',
  name: 'ether.fi ETH',
  address: '0x35fa164735182de50811e8e2e824cfb9b6118ac2',
  decimals: 18,
  isNative: false,
};
const params = {
  accountId: 'account-id',
  networkId: getNetworkIdsMap().eth,
  providerName: 'EtherFi',
  token,
  amountValue: '1.2500',
  vaultAddress,
};

function createPermitData(spender: string): IEarnPermit2ApproveSignData {
  return {
    types: {
      Permit: [
        { name: 'owner', type: 'address' },
        { name: 'spender', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'nonce', type: 'uint256' },
        { name: 'deadline', type: 'uint256' },
      ],
      EIP712Domain: [
        { name: 'name', type: 'string' },
        { name: 'version', type: 'string' },
        { name: 'chainId', type: 'uint256' },
        { name: 'verifyingContract', type: 'address' },
      ],
    },
    primaryType: 'Permit',
    message: {
      spender,
      owner: accountAddress,
      value: '1250000000000000000',
      nonce: '7',
      deadline: '2000000000',
    },
    domain: {
      verifyingContract: token.address,
      chainId: 1,
      name: 'EETH',
      version: '1',
    },
  };
}

describe('useEarnPermitApprove trusted spender', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAccount.mockResolvedValue({ address: accountAddress });
    mockMessageConfirm.mockResolvedValue('0xsignature');
  });

  it.each([
    ['EtherFi', getNetworkIdsMap().eth, EtherFiLiquidReferContract],
    ['Morpho', getNetworkIdsMap().eth, MorphoBundlerContract],
    ['Morpho', getNetworkIdsMap().base, MorphoBaseBundlerContract],
    ['Morpho', getNetworkIdsMap().katana, MorphoKatanaBundlerContract],
  ])(
    'signs the registered spender for %s on %s and preserves the protocol vault',
    async (providerName, networkId, spender) => {
      const permitData = createPermitData(spender.toUpperCase());
      mockBuildSignData.mockResolvedValue(permitData);
      const { result } = renderHook(() => useEarnPermitApprove());

      const signed = await result.current.getPermitSignature({
        ...params,
        providerName,
        networkId,
      });

      expect(mockBuildSignData).toHaveBeenCalledWith({
        provider: providerName,
        networkId,
        symbol: token.symbol,
        accountAddress,
        vault: vaultAddress,
        amount: '1.25',
      });
      const serialized = stringUtils.stableStringify(permitData);
      expect(serialized.startsWith('{"domain":')).toBe(true);
      expect(mockMessageConfirm).toHaveBeenCalledWith({
        accountId: params.accountId,
        networkId,
        unsignedMessage: {
          type: EMessageTypesEth.TYPED_DATA_V4,
          message: serialized,
          payload: [accountAddress, serialized],
        },
        walletInternalSign: true,
      });
      expect(signed.signature).toBe('0xsignature');
      expect(signed.unsignedMessage).toBe(permitData);
      expect(mockPermitSignError).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['EtherFi', getNetworkIdsMap().eth, MorphoBundlerContract],
    ['Morpho', getNetworkIdsMap().eth, EtherFiLiquidReferContract],
    ['EtherFi', getNetworkIdsMap().eth, ''],
    ['EtherFi', getNetworkIdsMap().base, EtherFiLiquidReferContract],
    ['Morpho', getNetworkIdsMap().arbitrum, MorphoBundlerContract],
    ['unknown', getNetworkIdsMap().eth, MorphoBundlerContract],
  ])(
    'rejects untrusted spender or unsupported pair %s on %s before signing',
    async (providerName, networkId, spender) => {
      mockBuildSignData.mockResolvedValue(createPermitData(spender));
      const { result } = renderHook(() => useEarnPermitApprove());

      await expect(
        result.current.getPermitSignature({
          ...params,
          providerName,
          networkId,
        }),
      ).rejects.toThrow('Invalid spender address');
      expect(mockMessageConfirm).not.toHaveBeenCalled();
      expect(mockPermitSignError).toHaveBeenCalledTimes(1);
    },
  );

  it('propagates a rejected signature without returning a successful Permit', async () => {
    mockBuildSignData.mockResolvedValue(
      createPermitData(EtherFiLiquidReferContract),
    );
    const error = new Error('User rejected signature');
    mockMessageConfirm.mockRejectedValueOnce(error);
    const { result } = renderHook(() => useEarnPermitApprove());

    await expect(result.current.getPermitSignature(params)).rejects.toBe(error);
  });
});
