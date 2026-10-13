import { EDeviceType } from '@onekeyfe/hd-shared';
import { Cell, beginCell } from '@ton/core';
import TonWeb from 'tonweb';

import type {
  IEncodedTxTon,
  ITonMessage,
} from '@onekeyhq/core/src/chains/ton/types';
import type { IBackgroundApi } from '@onekeyhq/kit-bg/src/apis/IBackgroundApi';
import type { IDBDevice } from '@onekeyhq/kit-bg/src/dbs/local/types';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { LRUCache } from '@onekeyhq/shared/src/utils/cacheUtils';
import deviceUtils from '@onekeyhq/shared/src/utils/deviceUtils';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';

import { encodeDecodedJetton } from './payload';
import { decodePayload, getJettonData, getJettonWalletAddress } from './utils';

// The background runtime owns these facts. No serialized dApp metadata can
// populate them; canonical payload hashes also cover inline/ref variants.
const verifiedMasters = new WeakMap<IBackgroundApi, LRUCache<string, string>>();

const TOUCH_FIRMWARE_WITHOUT_STATE_INIT = new Set([
  '4.10.0',
  '4.11.0',
  '4.12.0',
]);

export async function getTonHardwareSdkOptions(
  device?: IDBDevice | null,
): Promise<{ omitStateInit: boolean }> {
  if (device?.deviceType !== EDeviceType.Touch) {
    return { omitStateInit: false };
  }
  const { firmwareVersion } = await deviceUtils.getDeviceVersion({
    device,
    features: undefined,
  });
  // These released Touch handlers ignore init data. Keep this projection
  // limited to firmware versions verified from their official release sources.
  return {
    omitStateInit: TOUCH_FIRMWARE_WITHOUT_STATE_INIT.has(firmwareVersion),
  };
}

export function isSameTonAddress(first?: string, second?: string): boolean {
  return (
    !!first &&
    !!second &&
    TonWeb.Address.isValid(first) &&
    TonWeb.Address.isValid(second) &&
    new TonWeb.Address(first).toString(false) ===
      new TonWeb.Address(second).toString(false)
  );
}

export function normalizeTonAddress(address: string): string {
  return TonWeb.Address.isValid(address)
    ? new TonWeb.Address(address).toString(false)
    : address;
}

export function usesTonHardwareAppRepresentation(
  encodedTx: IEncodedTxTon,
): boolean {
  return (
    !!encodedTx.messages[0]?.stateInit ||
    encodedTx.messages.some(({ payload }) => {
      if (!payload) {
        return false;
      }
      try {
        return Cell.fromBase64(payload).isExotic;
      } catch {
        // Malformed payloads are handled by the existing parser and signer.
        return false;
      }
    })
  );
}

export function getTonHardwareSdkTransaction(
  encodedTx: IEncodedTxTon,
  { omitStateInit = false }: { omitStateInit?: boolean } = {},
): IEncodedTxTon {
  const first = encodedTx.messages[0];
  if (!first) {
    return encodedTx;
  }
  const mode = first.sendMode ?? 3;
  return {
    ...encodedTx,
    // The existing SDK rebuilds a batch with one mode and only receives
    // StateInit for its first message. Additional message metadata is not sent.
    messages: encodedTx.messages.map((message, index) => ({
      ...message,
      sendMode: mode,
      stateInit: index === 0 && !omitStateInit ? first.stateInit : undefined,
    })),
  };
}

export async function parseTonTransactionMessage({
  message,
  from,
  backgroundApi,
  networkId,
}: {
  message: ITonMessage;
  from: string;
  backgroundApi: IBackgroundApi;
  networkId: string;
}) {
  const payload = decodePayload(message.payload);
  const canUseHardwareComment =
    !!payload.comment &&
    // Firmware detects BOC hex by its prefix and Classic uses C strings.
    !payload.comment.startsWith('b5ee9c72') &&
    !payload.comment.includes('\0') &&
    !!payload.bytes &&
    Cell.fromBoc(Buffer.from(payload.bytes))[0].refs.length === 0 &&
    beginCell()
      .storeUint(0, 32)
      .storeStringTail(payload.comment)
      .endCell()
      .hash()
      .equals(Cell.fromBoc(Buffer.from(payload.bytes))[0].hash());
  const jetton = payload.jetton;
  if (!jetton) {
    return { payload, canUseHardwareComment, jetton: undefined };
  }
  let cache = verifiedMasters.get(backgroundApi);
  if (!cache) {
    cache = new LRUCache({ max: 200, ttl: 10 * 60 * 1000 });
    verifiedMasters.set(backgroundApi, cache);
  }
  const cacheKey = stringUtils.stableStringify([
    networkId,
    new TonWeb.Address(from).toString(false),
    new TonWeb.Address(message.address).toString(false),
    encodeDecodedJetton(jetton).hash().toString('hex'),
  ]);
  let tokenAddress = cache.get(cacheKey);
  if (!tokenAddress) {
    try {
      const data = await getJettonData({
        backgroundApi,
        networkId,
        address: message.address,
      });
      tokenAddress = data.jettonMinterAddress.toString(false);
      const walletAddress = await getJettonWalletAddress({
        backgroundApi,
        networkId,
        masterAddress: tokenAddress,
        address: from,
      });
      if (!isSameTonAddress(walletAddress.toString(false), message.address)) {
        throw new OneKeyLocalError('Jetton wallet does not match its master');
      }
      cache.set(cacheKey, tokenAddress);
    } catch {
      // Keep the original call available without claiming a verified token
      // identity. Both confirmation and hardware will use the raw payload.
      return { payload, canUseHardwareComment, jetton: undefined };
    }
  }
  // These fields have no equivalents in the structured hardware SDK request.
  // Complex transfers retain their original payload for hardware signing.
  const emptyForward =
    jetton.forwardPayload.bits.length === 0 &&
    jetton.forwardPayload.refs.length === 0;
  const supportedComment =
    !!jetton.comment &&
    !jetton.comment.includes('\0') &&
    jetton.forwardPayload.refs.length === 0 &&
    beginCell()
      .storeUint(0, 32)
      .storeStringTail(jetton.comment)
      .endCell()
      .hash()
      .equals(jetton.forwardPayload.hash());
  const canUseHardwareTransfer =
    BigInt(jetton.amount) > 0n &&
    jetton.queryId === '0' &&
    isSameTonAddress(jetton.responseAddress, from) &&
    !jetton.customPayload &&
    // Classic firmware sets the forward amount to zero without a comment.
    ((emptyForward && jetton.forwardAmount === '0') || supportedComment) &&
    // Structured firmware builders always inline the forward payload.
    encodeDecodedJetton(jetton, false).refs.length === 0;
  const requestedMaster = message.jetton?.jettonMasterAddress;
  return {
    payload,
    canUseHardwareComment,
    jetton: {
      tokenAddress,
      canUseHardwareTransfer,
      metadata: {
        amount: jetton.amount,
        toAddress: jetton.toAddress,
        jettonMasterAddress: isSameTonAddress(requestedMaster, tokenAddress)
          ? (requestedMaster ?? tokenAddress)
          : new TonWeb.Address(tokenAddress).toString(true, true, true),
        jettonWalletAddress: message.address,
        fwdFee: jetton.forwardAmount,
        fwdPayload: emptyForward
          ? undefined
          : jetton.forwardPayload.toBoc().toString('base64'),
      },
    },
  };
}
