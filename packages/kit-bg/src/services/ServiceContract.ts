/* eslint-disable @typescript-eslint/require-await */

import { Interface } from '@ethersproject/abi';

import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { stETHABI } from '@onekeyhq/shared/src/contracts/abi/stETH';
import { WETH9_ABI } from '@onekeyhq/shared/src/contracts/abi/weth9';

import ServiceBase from './ServiceBase';

import type { Fragment, JsonFragment } from '@ethersproject/abi';
import type { BytesLike } from '@ethersproject/bytes';

type IABI = string | readonly (string | Fragment | JsonFragment)[];

const lidoReferralAddress = '0xc1e92BD5d1aa6e5f5F299D0490BefD9D8E5a887a';

@backgroundClass()
class ServiceContract extends ServiceBase {
  buildEvmCalldata(input: { abi: IABI; method: string; params: any[] }) {
    const { abi, method, params } = input;
    const inter = new Interface(abi);
    return inter.encodeFunctionData(inter.getFunction(method), params);
  }

  parseJsonResponse(params: {
    abi: string | readonly (string | Fragment | JsonFragment)[];
    method: string;
    data: BytesLike;
  }) {
    const { abi, method, data } = params;
    const inter = new Interface(abi);
    const result = inter.decodeFunctionResult(inter.getFunction(method), data);
    return result;
  }

  @backgroundMethod()
  async buildWrapTransaction() {
    return this.buildEvmCalldata({
      abi: WETH9_ABI,
      method: 'deposit',
      params: [],
    });
  }

  @backgroundMethod()
  async buildUnwrapTransaction(wad: number) {
    return this.buildEvmCalldata({
      abi: WETH9_ABI,
      method: 'withdraw',
      params: [wad],
    });
  }

  @backgroundMethod()
  async buildLidoStakeTransaction() {
    return this.buildEvmCalldata({
      abi: stETHABI,
      method: 'submit',
      params: [lidoReferralAddress],
    });
  }

  @backgroundMethod()
  async buildERC20PermitData(params: {
    eip712Message: {
      owner: string;
      spender: string;
      value: string;
      nonce: number;
      deadline: number;
    };
    eip712Domain: {
      name: string;
      version: string;
      chainId: number;
      verifyingContract: string;
    };
  }) {
    const EIP712Domain = [
      { name: 'name', type: 'string' },
      { name: 'version', type: 'string' },
      { name: 'chainId', type: 'uint256' },
      { name: 'verifyingContract', type: 'address' },
    ];
    const Permit = [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'nonce', type: 'uint256' },
      { name: 'deadline', type: 'uint256' },
    ];
    const { eip712Domain, eip712Message } = params;
    const domain = {
      name: eip712Domain.name,
      version: eip712Domain.version,
      chainId: eip712Domain.chainId,
      verifyingContract: eip712Domain.verifyingContract,
    };
    const message = {
      owner: eip712Message.owner,
      spender: eip712Message.spender,
      value: eip712Message.value,
      nonce: eip712Message.nonce,
      deadline: eip712Message.deadline,
    };
    const data = JSON.stringify({
      types: {
        EIP712Domain,
        Permit,
      },
      domain,
      primaryType: 'Permit',
      message,
    });
    return data;
  }

  @backgroundMethod()
  async ethCallWithABI(input: {
    abi: IABI;
    method: string;
    params: any[];

    to: string;
    networkId: string;
  }) {
    const { abi, method, params, networkId, to } = input;
    const data = this.buildEvmCalldata({ abi, method, params });
    const { engine } = this.backgroundApi;

    const response = await engine.proxyJsonRPCCall(networkId, {
      method: 'eth_call',
      params: [{ to, data }, 'latest'],
    });

    const result = this.parseJsonResponse({
      abi,
      method,
      data: response as string,
    });

    return result;
  }
}

export default ServiceContract;
