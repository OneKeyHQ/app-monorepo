/* eslint-disable @typescript-eslint/require-await */

import { Interface } from '@ethersproject/abi';

import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';

import ServiceBase from './ServiceBase';

import type { Fragment, JsonFragment } from '@ethersproject/abi';

type EvmTransactionParams = {
  abi: string | readonly (string | Fragment | JsonFragment)[];
  method: string;
  params: any[];
};

const lidoReferralAddress = '0xc1e92BD5d1aa6e5f5F299D0490BefD9D8E5a887a';

const LIDO_ABI = [
  {
    constant: false,
    inputs: [{ name: '_referral', type: 'address' }],
    name: 'submit',
    outputs: [{ name: '', type: 'uint256' }],
    payable: true,
    stateMutability: 'payable',
    type: 'function',
  },
];

const WETH9_ABI = [
  {
    constant: false,
    inputs: [
      {
        'name': 'wad',
        'type': 'uint256',
      },
    ],
    name: 'withdraw',
    outputs: [],
    payable: false,
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    constant: false,
    inputs: [],
    name: 'deposit',
    outputs: [],
    payable: true,
    stateMutability: 'payable',
    type: 'function',
  },
];

@backgroundClass()
class ServiceContract extends ServiceBase {
  private async buildEvmTransaction({
    abi,
    method,
    params,
  }: EvmTransactionParams) {
    const inter = new Interface(abi);
    return inter.encodeFunctionData(inter.getFunction(method), params);
  }

  @backgroundMethod()
  async buildWrapTransaction() {
    return this.buildEvmTransaction({
      abi: WETH9_ABI,
      method: 'deposit',
      params: [],
    });
  }

  @backgroundMethod()
  async buildUnwrapTransaction(wad: number) {
    return this.buildEvmTransaction({
      abi: WETH9_ABI,
      method: 'withdraw',
      params: [wad],
    });
  }

  @backgroundMethod()
  async buildLidoStakeTransaction() {
    return this.buildEvmTransaction({
      abi: LIDO_ABI,
      method: 'submit',
      params: [lidoReferralAddress],
    });
  }
}

export default ServiceContract;
