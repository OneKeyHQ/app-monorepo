import { EXTRINSIC_VERSION } from '@polkadot/types/extrinsic/v4/Extrinsic';
import { u8aToU8a, u8aWrapBytes } from '@polkadot/util';
import {
  construct,
  createMetadata,
  getRegistry,
} from '@substrate/txwrapper-polkadot';

import hexUtils from '@onekeyhq/shared/src/utils/hexUtils';
import numberUtils from '@onekeyhq/shared/src/utils/numberUtils';

import type { IEncodedTxDot } from '../types';

export async function serializeMessage(message: string): Promise<Buffer> {
  const encoded = u8aWrapBytes(message);
  return Buffer.from(u8aToU8a(encoded));
}

export async function serializeUnsignedTransaction(
  encodedTx: IEncodedTxDot,
): Promise<{
  rawTx: Uint8Array;
  hash: Uint8Array;
}> {
  const { metadataRpc } = encodedTx;

  const registry = getRegistry({
    metadataRpc,
    specName: (encodedTx.specName ?? '') as 'polkadot',
    specVersion: +numberUtils.hexToDecimal(encodedTx.specVersion).toString(),
    chainName: encodedTx.chainName ?? '',
  });

  registry.setMetadata(createMetadata(registry, metadataRpc));
  const signingPayload = construct.signingPayload(encodedTx, { registry });

  const extrinsicPayload = registry.createType(
    'ExtrinsicPayload',
    signingPayload,
    {
      version: EXTRINSIC_VERSION,
    },
  );

  const u8a = extrinsicPayload.toU8a({
    method: true,
  });
  const encoded = u8a.length > 256 ? registry.hash(u8a) : u8a;

  return {
    rawTx: u8a,
    hash: u8aToU8a(encoded),
  };
}

export async function serializeSignedTransaction(
  encodedTx: IEncodedTxDot,
  signature: string,
) {
  const { metadataRpc } = encodedTx;
  const registry = getRegistry({
    ...encodedTx,
    specName: (encodedTx.specName ?? '') as 'polkadot',
    specVersion: +numberUtils.hexToDecimal(encodedTx.specVersion).toString(),
    chainName: encodedTx.chainName ?? '',
  });

  const tx = construct.signedTx(encodedTx, hexUtils.addHexPrefix(signature), {
    metadataRpc,
    registry,
  });

  return tx;
}
