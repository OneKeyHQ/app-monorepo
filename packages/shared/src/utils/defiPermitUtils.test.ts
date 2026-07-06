import { getNetworkIdsMap } from '../config/networkIds';
import {
  EthereumStETH,
  EthereumStETHWithdrawalQueue,
  EthereumWstETH,
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

  it('allows Lido wstETH withdraw permit when selected asset tokenAddress matches', () => {
    expect(() =>
      defiPermitUtils.validateLidoWithdrawPermitTypedData({
        message: buildLidoPermitTypedData({
          verifyingContract: EthereumWstETH,
        }),
        accountAddress,
        networkId: getNetworkIdsMap().eth,
        selectedAsset: { tokenAddress: EthereumWstETH },
      }),
    ).not.toThrow();
  });

  it('allows Lido wstETH withdraw permit when poolAddress matches', () => {
    expect(() =>
      defiPermitUtils.validateLidoWithdrawPermitTypedData({
        message: buildLidoPermitTypedData({
          verifyingContract: EthereumWstETH,
        }),
        accountAddress,
        networkId: getNetworkIdsMap().eth,
        selectedAsset: {
          tokenAddress: '',
          extraParams: { poolAddress: EthereumWstETH },
        },
      }),
    ).not.toThrow();
  });

  it('allows Lido wstETH permit when poolAddress differs from display token', () => {
    expect(() =>
      defiPermitUtils.validateLidoWithdrawPermitTypedData({
        message: buildLidoPermitTypedData({
          verifyingContract: EthereumWstETH,
        }),
        accountAddress,
        networkId: getNetworkIdsMap().eth,
        selectedAsset: {
          tokenAddress: EthereumStETH,
          extraParams: { poolAddress: EthereumWstETH },
        },
      }),
    ).not.toThrow();
  });

  it('rejects unsupported Lido poolAddress', () => {
    expect(() =>
      defiPermitUtils.validateLidoWithdrawPermitTypedData({
        message: buildLidoPermitTypedData({
          verifyingContract: EthereumWstETH,
        }),
        accountAddress,
        networkId: getNetworkIdsMap().eth,
        selectedAsset: {
          tokenAddress: EthereumStETH,
          extraParams: {
            poolAddress: '0x000000000000000000000000000000000000dEaD',
          },
        },
      }),
    ).toThrow('Invalid DeFi permit tokenAddress');
  });

  it('rejects unsupported display token even when poolAddress is supported', () => {
    expect(() =>
      defiPermitUtils.validateLidoWithdrawPermitTypedData({
        message: buildLidoPermitTypedData({
          verifyingContract: EthereumWstETH,
        }),
        accountAddress,
        networkId: getNetworkIdsMap().eth,
        selectedAsset: {
          tokenAddress: '0x000000000000000000000000000000000000dEaD',
          extraParams: { poolAddress: EthereumWstETH },
        },
      }),
    ).toThrow('Invalid DeFi permit tokenAddress');
  });

  it('rejects Lido wstETH permit when selected token is stETH', () => {
    expect(() =>
      defiPermitUtils.validateLidoWithdrawPermitTypedData({
        message: buildLidoPermitTypedData({
          verifyingContract: EthereumWstETH,
        }),
        accountAddress,
        networkId: getNetworkIdsMap().eth,
        selectedAsset: { tokenAddress: EthereumStETH },
      }),
    ).toThrow('Invalid DeFi permit verifyingContract');
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

  it('validates optional permit token against wstETH', () => {
    expect(() =>
      defiPermitUtils.validateLidoWithdrawPermitTypedData({
        message: buildLidoPermitTypedData({
          verifyingContract: EthereumWstETH,
          token: EthereumWstETH,
        }),
        accountAddress,
        networkId: getNetworkIdsMap().eth,
        selectedAsset: { tokenAddress: EthereumWstETH },
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
