import B from 'bignumber.js';
import { Contract } from 'js-conflux-sdk';

import type { IServerFiatTokenInfo } from '@onekeyhq/shared/types/serverToken';
import type { IToken } from '@onekeyhq/shared/types/token';

export function safeNumberString(n: string | B | number, fallback?: string) {
  const res = new B(n);

  if (res.isNaN() || !res.isFinite()) {
    return fallback ?? '';
  }

  return res.toString();
}

export function safeNumber(n: string | B | number, fallback?: number) {
  const res = new B(n);

  if (res.isNaN() || !res.isFinite()) {
    return fallback;
  }

  return res.toNumber();
}

export const nativeTokenUniqueKey = 'native';

function isServerFiatTokenInfo(
  token: IServerFiatTokenInfo | IToken,
): token is IServerFiatTokenInfo {
  return 'balance' in token;
}
export function parseTokenItem(token: IServerFiatTokenInfo | IToken) {
  const res = {
    balance: isServerFiatTokenInfo(token) ? token.balance : undefined,
    balanceParsed: isServerFiatTokenInfo(token)
      ? safeNumberString(token.balanceParsed ?? '')
      : undefined,
    fiatValue: isServerFiatTokenInfo(token) ? token.fiatValue : undefined,
    price: isServerFiatTokenInfo(token) ? token.price : undefined,
    price24h: isServerFiatTokenInfo(token) ? token.price24h : undefined,
    info: {
      uniqueKey: (token.uniqueKey ?? token.address) || nativeTokenUniqueKey,
      address: token.address,
      decimals: token.decimals,
      isNative: token.isNative,
      logoURI: token.logoURI,
      name: token.name,
      symbol: token.symbol,
      totalSupply: isServerFiatTokenInfo(token) ? token.totalSupply : undefined,
      riskLevel: token.riskLevel,
      adaName: isServerFiatTokenInfo(token) ? token.adaName : undefined,
      sendAddress: token.sendAddress,
      networkId: token.networkId,
    },
  };

  return res;
}

export type IMethodTransaction = {
  data: string;
  method: {
    decodeOutputs: <T>(hex: string) => T;
  };
};
export class Interface {
  constructor(abi: string[]) {
    const contract = new Contract({ abi }, undefined);

    // @ts-ignore
    // eslint-disable-next-line no-constructor-return
    return new Proxy(contract, {
      get(target: Contract, p: string | symbol, receiver: any): any {
        return Reflect.get(target, p, receiver);
      },
    });
  }

  [method: string]: (...args: any[]) => IMethodTransaction;
}

export const INTERFACE = new Interface([
  'function name() public view returns (string)',
  'function symbol() public view returns (string)',
  'function decimals() public view returns (uint8)',
  'function totalSupply() public view returns (uint256)',
  'function supportsInterface(bytes4 interfaceID) external view returns (bool)',
  'function balanceOf(address _owner) external view returns (uint256)',
  'function allowance(address _owner, address _spender) public view returns (uint256)',
  'function getL1Fee(bytes) view returns (uint256)',
  // MultiCall3
  'function getEthBalance(address addr) view returns (uint256 balance)',
  'function aggregate(tuple(address target, bytes callData)[] calls) payable returns (uint256 blockNumber, bytes[] returnData)',
  'function aggregate3(tuple(address target, bool allowFailure, bytes callData)[] calls) payable returns (tuple(bool success, bytes returnData)[] returnData)',
  'function aggregate3Value(tuple(address target, bool allowFailure, uint256 value, bytes callData)[] calls) payable returns (tuple(bool success, bytes returnData)[] returnData)',
]);
