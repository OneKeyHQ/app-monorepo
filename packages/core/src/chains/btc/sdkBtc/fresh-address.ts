import crypto from 'crypto';

import { getAddressFromXpub } from '.';

import type { ILocalHistory } from '@onekeyhq/kit-bg/src/dbs/simple/entity/SimpleDbEntityLocalHistory';
import { OneKeyInternalError } from '@onekeyhq/shared/src/errors';

import type { EAddressEncodings } from '../../../types';
import type {
  IBtcBlockbookDerivedInfo,
  IBtcForkNetwork,
  IBtcFreshAddress,
  IBtcFreshAddressStructure,
  IEncodedTxBtc,
} from '../types';

export async function transformAddress({
  network,
  xpub,
  addressEncoding,
  derivedInfos,
  localUsedAddressesMap,
}: {
  network: IBtcForkNetwork;
  xpub: string;
  addressEncoding: EAddressEncodings;
  derivedInfos: IBtcBlockbookDerivedInfo[];
  localUsedAddressesMap: Record<string, string[]>;
}): Promise<IBtcFreshAddressStructure | undefined> {
  if (!derivedInfos || !Array.isArray(derivedInfos)) return undefined;
  const addresses = derivedInfos
    .filter((i) => i.type === 'XPUBAddress')
    .map((i) => {
      if (localUsedAddressesMap && localUsedAddressesMap[i.name]) {
        return {
          ...i,
          transfers: Math.max(
            i.transfers,
            localUsedAddressesMap[i.name].length,
          ),
        };
      }
      return i;
    });
  if (addresses.length < 1) return undefined;
  const internal = addresses.filter((i) => i.path.split('/')[4] === '1');
  const external = addresses.filter((i) => internal.indexOf(i) < 0);

  const toFreshAddress = (
    info: IBtcBlockbookDerivedInfo,
    address: string | undefined,
  ): IBtcFreshAddress => ({
    address,
    name: info.name,
    path: info.path,
    transfers: info.transfers,
    isDerivedByApp: true,
    balance: info.balance,
    totalReceived: info.totalReceived,
    totalSent: info.totalSent,
  });

  // TODO: sort by address_index
  const transformUnusedAddresses = async (
    unusedAddresses: IBtcBlockbookDerivedInfo[],
  ): Promise<IBtcFreshAddress[]> => {
    if (unusedAddresses.length === 0) return [];

    // Only verify the first address to avoid unnecessary async overhead
    const firstAddress = unusedAddresses[0];
    const relativePath = `${firstAddress.path.split('/')[4]}/${
      firstAddress.path.split('/')[5]
    }`;
    const derivedAddress = await getAddressFromXpub({
      curve: 'secp256k1',
      network,
      xpub,
      relativePaths: [relativePath],
      addressEncoding,
      encodeAddress: (encodedAddress) => encodedAddress,
    });

    if (derivedAddress.addresses[relativePath] !== firstAddress.name) {
      throw new OneKeyInternalError(
        `transformAddress: derived address not match, xpub: ${xpub}, path: ${firstAddress.path}, address: ${firstAddress.name}, generatedAddress: ${derivedAddress.addresses[0]}`,
      );
    }

    // Map all addresses synchronously for better performance
    return unusedAddresses.map((i, index) =>
      toFreshAddress(
        i,
        index === 0 ? derivedAddress.addresses[relativePath] : undefined,
      ),
    );
  };

  const [unusedChangeAddresses, unusedFreshAddresses] = await Promise.all([
    transformUnusedAddresses(internal.filter((i) => i.transfers === 0)),
    transformUnusedAddresses(external.filter((i) => i.transfers === 0)),
  ]);

  return {
    change: {
      used: internal
        .filter((i) => i.transfers > 0)
        .map((i) => toFreshAddress(i, i.name)),
      unused: unusedChangeAddresses,
    },
    fresh: {
      used: external
        .filter((i) => i.transfers > 0)
        .map((i) => toFreshAddress(i, i.name)),
      unused: unusedFreshAddresses,
    },
  };
}

export function getLocalUsedAddressFromLocalPendingTxs({
  pendingTxs,
}: {
  pendingTxs?: ILocalHistory['pendingTxs'];
}) {
  const localUsedAddressesMap: Record<string, string[]> = {};

  const outputs = Object.values(pendingTxs ?? {}).flatMap((accountTxs) =>
    accountTxs.flatMap((tx) => {
      const encodedTx = tx.decodedTx?.encodedTx as IEncodedTxBtc | undefined;
      if (!encodedTx?.outputs?.length) {
        return [];
      }
      const txId = tx.decodedTx?.txid || tx.id;
      return encodedTx.outputs
        .filter((output) => !!output.address)
        .map((output) => ({
          address: output.address,
          txId,
        }));
    }),
  );

  outputs.forEach(({ address, txId }) => {
    if (!localUsedAddressesMap[address]) {
      localUsedAddressesMap[address] = [];
    }
    if (!localUsedAddressesMap[address].includes(txId)) {
      localUsedAddressesMap[address].push(txId);
    }
  });

  Object.values(localUsedAddressesMap).forEach((txIds) =>
    txIds.sort((a, b) => a.localeCompare(b)),
  );

  const sortedEntries = Object.entries(localUsedAddressesMap)
    .sort(([addressA], [addressB]) => addressA.localeCompare(addressB))
    .map(([address, txIds]) => `${address}:${txIds.join(',')}`);

  const localUsedAddressesHash = sortedEntries.length
    ? crypto.createHash('sha256').update(sortedEntries.join('|')).digest('hex')
    : undefined;

  return {
    localUsedAddressesHash,
    localUsedAddressesMap,
  };
}
