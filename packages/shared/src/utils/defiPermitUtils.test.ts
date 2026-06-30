import { getNetworkIdsMap } from '../config/networkIds';
import {
  EthereumStETH,
  EthereumStETHWithdrawalQueue,
} from '../consts/addresses';

import defiPermitUtils from './defiPermitUtils';

const accountAddress = '0x92bAA173828d55B2F1ed611352Aa0627AB825178';

function buildLidoPermitTypedData({
  token,
  verifyingContract = EthereumStETH,
  spender = EthereumStETHWithdrawalQueue,
}: {
  token?: string;
  verifyingContract?: string;
  spender?: string;
} = {}) {
  return {
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
    domain: {
      name: 'Liquid staked Ether 2.0',
      version: '2',
      chainId: 1,
      verifyingContract,
    },
    primaryType: 'Permit',
    message: {
      owner: accountAddress,
      spender,
      value: '2000123816503296',
      nonce: 0,
      deadline: 1_782_795_815,
      ...(token ? { token } : {}),
    },
  };
}

describe('defiPermitUtils.validateLidoWithdrawPermitTypedData', () => {
  it('allows Lido withdraw permit when selected asset tokenAddress is empty', () => {
    expect(() =>
      defiPermitUtils.validateLidoWithdrawPermitTypedData({
        message: JSON.stringify(buildLidoPermitTypedData()),
        accountAddress,
        networkId: getNetworkIdsMap().eth,
        selectedAsset: { tokenAddress: '' },
      }),
    ).not.toThrow();
  });

  it('rejects selected asset tokenAddress mismatch when it is provided', () => {
    expect(() =>
      defiPermitUtils.validateLidoWithdrawPermitTypedData({
        message: buildLidoPermitTypedData(),
        accountAddress,
        networkId: getNetworkIdsMap().eth,
        selectedAsset: {
          tokenAddress: '0x000000000000000000000000000000000000dEaD',
        },
      }),
    ).toThrow('Invalid DeFi permit tokenAddress');
  });

  it('validates optional permit token against stETH when selected asset tokenAddress is empty', () => {
    expect(() =>
      defiPermitUtils.validateLidoWithdrawPermitTypedData({
        message: buildLidoPermitTypedData({ token: EthereumStETH }),
        accountAddress,
        networkId: getNetworkIdsMap().eth,
        selectedAsset: { tokenAddress: '' },
      }),
    ).not.toThrow();
  });

  it('rejects optional permit token mismatch', () => {
    expect(() =>
      defiPermitUtils.validateLidoWithdrawPermitTypedData({
        message: buildLidoPermitTypedData({
          token: '0x000000000000000000000000000000000000dEaD',
        }),
        accountAddress,
        networkId: getNetworkIdsMap().eth,
        selectedAsset: { tokenAddress: '' },
      }),
    ).toThrow('Invalid DeFi permit token');
  });
});
