import type CoreChainSoftwareBtc from '@onekeyhq/core/src/chains/btc/CoreChainSoftware';
import type {
  IBtcForkNetwork,
  IEncodedTxBtc,
} from '@onekeyhq/core/src/chains/btc/types';

import type { IDBUtxoAccount } from '../../../dbs/local/types';
import type VaultBtc from './Vault';

type IResolveOutputAccount = Parameters<
  VaultBtc['_getRelPathsToAddressByApi']
>[0]['account'];

export type IResolvedPsbtTaprootOwnedOutput = {
  fullPath: string;
  pubkey: string;
};

export async function resolvePsbtTaprootOwnedOutputs({
  network,
  outputAddresses,
  encodedTx,
  dbAccount,
  coreApi,
  vault,
}: {
  network: IBtcForkNetwork;
  outputAddresses: Array<string | undefined>;
  encodedTx: IEncodedTxBtc;
  dbAccount: Pick<
    IDBUtxoAccount,
    'address' | 'path' | 'pub' | 'relPath' | 'xpub' | 'xpubSegwit'
  >;
  coreApi: Pick<CoreChainSoftwareBtc, 'getAddressFromXpub'>;
  vault: Pick<VaultBtc, '_getRelPathsToAddressByApi'>;
}): Promise<Record<number, IResolvedPsbtTaprootOwnedOutput>> {
  if (outputAddresses.length <= 1) {
    return {};
  }

  const candidateOutputs = encodedTx.outputs
    .map((encodedOutput, index) => {
      const outputAddress = outputAddresses[index] ?? encodedOutput.address;
      const isOwnedHint =
        !!encodedOutput.payload?.isChange ||
        !!encodedOutput.payload?.isInscriptionStructure;

      if (!outputAddress || !isOwnedHint) {
        return undefined;
      }

      return {
        index,
        outputAddress,
      };
    })
    .filter((item) => !!item);

  if (candidateOutputs.length === 0) {
    return {};
  }

  const { addressToPath } = await vault._getRelPathsToAddressByApi({
    addresses: Array.from(
      new Set(candidateOutputs.map((item) => item?.outputAddress ?? '')),
    ).filter(Boolean),
    account: dbAccount as unknown as IResolveOutputAccount,
    xpubSegwit: dbAccount.xpubSegwit,
  });

  const ownedOutputs = new Map<
    number,
    {
      outputAddress: string;
      relPath: string;
      pubkey?: string;
    }
  >();
  const relPathsToDerive = new Set<string>();

  candidateOutputs.forEach((candidateOutput) => {
    if (!candidateOutput) {
      return;
    }

    const { index, outputAddress } = candidateOutput;

    let relPath: string | undefined;
    let pubkey: string | undefined;

    if (outputAddress === dbAccount.address) {
      relPath = dbAccount.relPath ?? '0/0';
      pubkey = dbAccount.pub;
    } else {
      relPath = addressToPath[outputAddress]?.relPath;
    }

    if (!relPath) {
      return;
    }

    ownedOutputs.set(index, {
      outputAddress,
      relPath,
      pubkey,
    });

    if (!pubkey) {
      relPathsToDerive.add(relPath);
    }
  });

  if (ownedOutputs.size === 0) {
    return {};
  }

  let derivedAddresses: Record<string, string> = {};
  let derivedPublicKeys: Record<string, string> = {};

  if (relPathsToDerive.size > 0) {
    const derivedResult = await coreApi.getAddressFromXpub({
      network,
      xpub: dbAccount.xpub,
      relativePaths: Array.from(relPathsToDerive),
    });

    derivedAddresses = derivedResult.addresses;
    derivedPublicKeys = derivedResult.publicKeys;
  }

  const resolvedOutputs: Record<number, IResolvedPsbtTaprootOwnedOutput> = {};

  ownedOutputs.forEach((ownedOutput, index) => {
    const derivedPubkey =
      ownedOutput.pubkey ??
      (derivedAddresses[ownedOutput.relPath] === ownedOutput.outputAddress
        ? derivedPublicKeys[ownedOutput.relPath]
        : undefined);

    if (!derivedPubkey) {
      return;
    }

    resolvedOutputs[index] = {
      fullPath: `${dbAccount.path}/${ownedOutput.relPath}`,
      pubkey: derivedPubkey,
    };
  });

  return resolvedOutputs;
}
