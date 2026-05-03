import type {
  ICoreApiSignTxPayload,
  ISignedTxPro,
} from '@onekeyhq/core/src/types';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { executeSignCommand } from '../sign';

import type { IChainConfig } from '../../core';

const VALID_OPTIONS = {
  address: '0x1111111111111111111111111111111111111111',
  chain: 'eth',
  path: "m/44'/60'/0'/0/0",
  pub: '02abcdef',
  tx: '{"to":"0x2222222222222222222222222222222222222222","value":"0x1"}',
};

const CHAIN_CONFIG: IChainConfig = {
  networkId: 'evm--1',
  impl: 'evm',
  chainId: '1',
  nativeDecimals: 18,
  feeDecimals: 18,
  feeSymbol: 'ETH',
  nativeSymbol: 'ETH',
};

function createSignedTx(rawTx = '0xsigned'): ISignedTxPro {
  return {
    rawTx,
    txid: '0xtxid',
    encodedTx: null,
  };
}

function createSigner() {
  return {
    getHdCredential: jest.fn(() => Promise.resolve('hd-credential')),
    getEncodedPassword: jest.fn(() => Promise.resolve('encoded-password')),
    buildNetworkInfo: jest.fn((networkId: string) => ({
      networkChainCode: 'evm',
      chainId: networkId.split('--')[1],
      networkImpl: 'evm',
      networkId,
    })),
    signTransaction: jest.fn((payload: ICoreApiSignTxPayload) => {
      void payload;
      return Promise.resolve(createSignedTx());
    }),
  };
}

describe('onekey sign command', () => {
  afterEach(() => {
    process.exitCode = 0;
  });

  it('signs an encoded transaction and outputs a signature', async () => {
    const signer = createSigner();
    const output = {
      success: jest.fn(),
      error: jest.fn(),
    };
    const getSignerByImpl = jest.fn(() => Promise.resolve(signer));
    const resolveChain = jest.fn(() => CHAIN_CONFIG);

    await executeSignCommand(VALID_OPTIONS, {
      getSignerByImpl,
      output,
      resolveChain,
    });

    expect(resolveChain).toHaveBeenCalledWith('eth');
    expect(getSignerByImpl).toHaveBeenCalledWith('evm');
    expect(signer.getHdCredential).toHaveBeenCalledTimes(1);
    expect(signer.signTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        credentials: { hd: 'hd-credential' },
        password: 'encoded-password',
        account: {
          address: VALID_OPTIONS.address,
          path: VALID_OPTIONS.path,
          pub: VALID_OPTIONS.pub,
        },
        unsignedTx: {
          encodedTx: {
            to: '0x2222222222222222222222222222222222222222',
            value: '0x1',
          },
        },
      }),
    );
    expect(output.success).toHaveBeenCalledWith({
      signature: '0xsigned',
      txid: '0xtxid',
    });
    expect(output.error).not.toHaveBeenCalled();
  });

  it('handles 10 concurrent sign executions without sharing command-local state', async () => {
    const output = {
      success: jest.fn(),
      error: jest.fn(),
    };
    const signers = Array.from({ length: 10 }, () => createSigner());
    const getSignerByImpl = jest.fn(async () => {
      const signer = signers.shift();
      if (!signer) {
        throw new OneKeyLocalError('missing signer');
      }
      return signer;
    });
    const resolveChain = jest.fn(() => CHAIN_CONFIG);

    await Promise.all(
      Array.from({ length: 10 }, () =>
        executeSignCommand(VALID_OPTIONS, {
          getSignerByImpl,
          output,
          resolveChain,
        }),
      ),
    );

    expect(output.success).toHaveBeenCalledTimes(10);
    expect(output.error).not.toHaveBeenCalled();
  });

  it('returns INVALID_TX when tx JSON cannot be parsed', async () => {
    const output = {
      success: jest.fn(),
      error: jest.fn(),
    };
    const getSignerByImpl = jest.fn(() => Promise.resolve(createSigner()));

    await executeSignCommand(
      {
        ...VALID_OPTIONS,
        tx: '{bad-json',
      },
      {
        getSignerByImpl,
        output,
        resolveChain: () => CHAIN_CONFIG,
      },
    );

    expect(output.success).not.toHaveBeenCalled();
    expect(getSignerByImpl).not.toHaveBeenCalled();
    expect(output.error).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'INVALID_TX',
      }),
    );
    expect(process.exitCode).toBe(1);
  });
});
