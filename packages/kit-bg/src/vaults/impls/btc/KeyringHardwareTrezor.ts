import BigNumber from 'bignumber.js';
import * as BitcoinJS from 'bitcoinjs-lib';

import {
  checkBtcAddressIsUsed,
  convertBtcForkXpub,
  getBtcForkNetwork,
  initBitcoinEcc,
} from '@onekeyhq/core/src/chains/btc/sdkBtc';
import type {
  IBtcInput,
  IBtcOutput,
  IEncodedTxBtc,
} from '@onekeyhq/core/src/chains/btc/types';
import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';
import {
  EAddressEncodings,
  type ICoreApiGetAddressItem,
  type ISignedMessagePro,
  type ISignedTxPro,
  type IUnsignedMessageBtc,
} from '@onekeyhq/core/src/types';
import { slicePathTemplate } from '@onekeyhq/core/src/utils';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ThirdPartyMethodNotSupported } from '@onekeyhq/shared/src/errors/errors/thirdPartyHardwareErrors';
import { convertThirdPartyDeviceError } from '@onekeyhq/shared/src/errors/utils/thirdPartyDeviceErrorUtils';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';
import { EConfirmOnDeviceType } from '@onekeyhq/shared/types/device';

import { thirdPartyPassphraseParamsFromDeviceParams } from '../../base/thirdPartyHardwareCommonParams';
import {
  buildTrezorBleFallbackOptions,
  callTrezorWithBleFallback,
  getTrezorAdapterFromBackgroundApi,
} from '../../base/trezorTransportUtils';

import { KeyringHardwareBtcBase } from './KeyringHardwareBtcBase';

import type VaultBtc from './Vault';
import type { IDBAccount } from '../../../dbs/local/types';
import type {
  IBuildHwAllNetworkPrepareAccountsParams,
  IHwSdkNetwork,
  IPrepareHardwareAccountsParams,
  ISignMessageParams,
  ISignTransactionParams,
} from '../../types';
import type { AllNetworkAddressParams } from '@onekeyfe/hd-core';
import type { BtcGetAddressParams } from '@onekeyfe/hwk-adapter-core';

type ITrezorBtcScriptType = NonNullable<BtcGetAddressParams['scriptType']>;

export function getTrezorBtcScriptTypeFromPath(
  path: string,
): ITrezorBtcScriptType | undefined {
  const normalized = path.startsWith('m/') ? path.slice(2) : path;
  const purpose = normalized.split('/')[0]?.replace(/['hH]$/, '');
  switch (purpose) {
    case '44':
      return 'p2pkh';
    case '49':
      return 'p2sh';
    case '84':
      return 'p2wpkh';
    case '86':
      return 'p2tr';
    default:
      return undefined;
  }
}

export function buildTrezorBtcAdapterInput(input: IBtcInput, path: string) {
  if (!path) {
    throw new OneKeyLocalError(
      `btc signTransaction: missing derivation path for input address ${input.address}`,
    );
  }
  return {
    path,
    prevHash: input.txid,
    prevIndex: input.vout,
    amount: new BigNumber(input.value).toFixed(),
    sequence: input.sequence,
    scriptType: getTrezorBtcScriptTypeFromPath(path),
    origHash: input.origHash,
    origIndex: input.origIndex,
    scriptSig: input.scriptSig,
    witness: input.witness,
    ownershipProof: input.ownershipProof,
    commitmentData: input.commitmentData,
  };
}

export function buildTrezorBtcAdapterOutput(output: IBtcOutput) {
  const { isChange, bip44Path, opReturn } = output.payload || {};
  const metadata = {
    paymentReqIndex: output.paymentReqIndex,
    origHash: output.origHash,
    origIndex: output.origIndex,
  };

  if (opReturn && typeof opReturn === 'string' && opReturn.length > 0) {
    return {
      opReturnData: bufferUtils.bytesToHex(Buffer.from(opReturn)),
      amount: '0',
      ...metadata,
    };
  }
  if (isChange && bip44Path) {
    return {
      path: bip44Path,
      amount: new BigNumber(output.value).toFixed(),
      scriptType: getTrezorBtcScriptTypeFromPath(bip44Path),
      ...metadata,
    };
  }
  return {
    address: output.address,
    amount: new BigNumber(output.value).toFixed(),
    ...metadata,
  };
}

export function buildTrezorBtcAdapterRefTx(rawTx: string) {
  const tx = BitcoinJS.Transaction.fromHex(rawTx);
  return {
    hash: tx.getId(),
    version: tx.version,
    inputs: tx.ins.map((i) => ({
      // bitcoinjs stores input hashes in little-endian order.
      // eslint-disable-next-line unicorn/no-array-reverse
      prevHash: Buffer.from(Buffer.from(i.hash).reverse()).toString('hex'),
      prevIndex: i.index,
      script: Buffer.from(i.script).toString('hex'),
      sequence: i.sequence,
    })),
    outputs: tx.outs.map((o) => ({
      amount: o.value.toString(),
      scriptPubKey: Buffer.from(o.script).toString('hex'),
    })),
    locktime: tx.locktime,
  };
}

export function getTrezorBtcRawPrevTxsToParse({
  rawPrevTxs,
  origRefTxs,
}: {
  rawPrevTxs: Record<string, string>;
  origRefTxs?: IEncodedTxBtc['origRefTxs'];
}) {
  const structuredRefTxids = new Set(
    (origRefTxs ?? []).map((tx) => tx.hash.toLowerCase()),
  );
  return Object.entries(rawPrevTxs)
    .filter(([txid]) => !structuredRefTxids.has(txid.toLowerCase()))
    .map(([, rawTx]) => rawTx);
}

export function buildTrezorBtcSignTransactionPayload({
  coin,
  encodedTx,
  prevTxs,
  signers,
}: {
  coin: string;
  encodedTx: IEncodedTxBtc;
  prevTxs: string[];
  signers: Record<string, string>;
}) {
  return {
    coin,
    version: encodedTx.version,
    locktime: encodedTx.locktime,
    timestamp: encodedTx.timestamp,
    expiry: encodedTx.expiry,
    versionGroupId: encodedTx.versionGroupId,
    branchId: encodedTx.branchId,
    inputs: encodedTx.inputs.map((input) =>
      buildTrezorBtcAdapterInput(input, signers[input.address] || input.path),
    ),
    outputs: encodedTx.outputs.map((output) =>
      buildTrezorBtcAdapterOutput(output),
    ),
    paymentRequests: encodedTx.paymentRequests,
    refTxs: [
      ...prevTxs.map((rawTx) => buildTrezorBtcAdapterRefTx(rawTx)),
      ...(encodedTx.origRefTxs ?? []),
    ],
  };
}

export function buildTrezorBtcSignMessageParams({
  path,
  coin,
  message,
}: {
  path: string;
  coin: string;
  message: IUnsignedMessageBtc;
}) {
  if (message.type === 'bip322-simple') {
    throw new ThirdPartyMethodNotSupported();
  }
  const noScriptType =
    message.sigOptions?.noScriptType ||
    (message.type === 'ecdsa' && message.payload?.isFromDApp);
  return {
    path,
    message: Buffer.from(message.message).toString('hex'),
    coin,
    hex: true,
    ...(noScriptType ? { noScriptType: true } : {}),
  };
}

// Pass scriptType explicitly from the BIP purpose segment. The current hwk
// adapter still has a fallback heuristic, but matching any path segment is
// ambiguous when a non-purpose segment contains values like 84 or 86.

// Trezor BTC keyring. Address/message methods mirror KeyringHardwareLedger
// (per-index btcGetPublicKey / btcSignMessage). signTransaction follows the
// classic Trezor SignTx flow (structured inputs/outputs/refTxs) — the same
// shape KeyringHardwareBtcBase builds for the OneKey SDK, remapped to the
// hwk-adapter's camelCase types. PSBT signing is not yet wired on the Trezor
// adapter, so signPsbt is blocked.
export class KeyringHardwareTrezor extends KeyringHardwareBtcBase {
  override coreApi = coreChainApi.btc.hd;

  override hwSdkNetwork: IHwSdkNetwork = 'btc';

  private getBleFallbackOptions() {
    return buildTrezorBleFallbackOptions(this.backgroundApi);
  }

  override async prepareAccounts(
    params: IPrepareHardwareAccountsParams,
  ): Promise<IDBAccount[]> {
    const networkInfo = await this.getCoreApiNetworkInfo();
    const network = getBtcForkNetwork(networkInfo.networkChainCode);
    const addressEncoding = params.deriveInfo?.addressEncoding;
    const addressRelPath = accountUtils.buildUtxoAddressRelPath();

    return this.basePrepareHdUtxoAccounts(params, {
      checkIsAccountUsed: checkBtcAddressIsUsed,
      buildAddressesInfo: async ({ usedIndexes }) => {
        const { dbDevice } = params.deviceParams;
        const { template } = params.deriveInfo;
        const adapter = await getTrezorAdapterFromBackgroundApi(
          this.backgroundApi,
        );
        const buildAccountPath = ({ index }: { index: number }) => {
          const fullPath = accountUtils.buildPathFromTemplate({
            template,
            index,
          });
          return accountUtils.removePathLastSegment({
            path: fullPath,
            removeCount: 2,
          });
        };

        const ret: ICoreApiGetAddressItem[] = [];
        for (const index of usedIndexes) {
          const accountPath = buildAccountPath({ index });

          const allNetworkItem =
            params.hwAllNetworkPrepareAccountsResponse &&
            (await params.hwAllNetworkPrepareAccountsResponse.getItem({
              path: accountPath,
              hwSdkNetwork: this.hwSdkNetwork,
            }));

          const pubKeyResult =
            allNetworkItem ||
            (await callTrezorWithBleFallback(
              dbDevice,
              (connectId) =>
                adapter.hw.btcGetPublicKey(connectId, dbDevice.deviceId, {
                  path: accountPath,
                  coin: networkInfo.networkChainCode ?? 'btc',
                  showOnDevice: params.isVerifyAddressAction ?? false,
                  ...thirdPartyPassphraseParamsFromDeviceParams(
                    params.deviceParams,
                  ),
                }),
              this.getBleFallbackOptions(),
            ));

          if (!pubKeyResult.success) {
            if (!pubKeyResult.payload) {
              throw new OneKeyLocalError('Trezor BTC get public key failed');
            }
            throw convertThirdPartyDeviceError(pubKeyResult.payload, {
              vendor: 'Trezor',
              chain: 'Bitcoin',
            });
          }

          const pubKeyPayload = checkIsDefined(pubKeyResult.payload);
          const rawXpubField: unknown = pubKeyPayload.xpub;
          const rawXpub =
            typeof rawXpubField === 'string'
              ? rawXpubField
              : ((rawXpubField as { extendedPublicKey: string })
                  ?.extendedPublicKey ?? String(rawXpubField));
          const xpub = addressEncoding
            ? convertBtcForkXpub({
                btcForkNetwork: network,
                xpub: rawXpub,
                addressEncoding,
              })
            : rawXpub;

          const {
            addresses: addressFromXpub,
            publicKeys: publicKeysMap,
            xpubSegwit: bareXpubSegwit,
          } = await checkIsDefined(this.coreApi).getAddressFromXpub({
            network,
            xpub,
            relativePaths: [addressRelPath],
            addressEncoding,
          });
          const { [addressRelPath]: publicKey } = publicKeysMap;
          const { [addressRelPath]: address } = addressFromXpub;

          // P2TR: build a BIP380 descriptor with the device master fingerprint
          // so blockbook scans 0/* and 1/* and PSBT signing can identify the
          // signer. getAddressFromXpub only emits a bare tr(xpub).
          let xpubSegwit = bareXpubSegwit;
          if (addressEncoding === EAddressEncodings.P2TR) {
            const fpResult = await callTrezorWithBleFallback(
              dbDevice,
              (connectId) =>
                adapter.hw.btcGetMasterFingerprint(
                  connectId,
                  dbDevice.deviceId,
                  thirdPartyPassphraseParamsFromDeviceParams(
                    params.deviceParams,
                  ),
                ),
              this.getBleFallbackOptions(),
            );
            if (fpResult.success && fpResult.payload.masterFingerprint) {
              xpubSegwit = `tr([${
                fpResult.payload.masterFingerprint
              }${accountPath.substring(1)}]${xpub}/<0;1>/*)`;
            }
          }

          ret.push({
            address,
            publicKey,
            path: accountPath,
            relPath: addressRelPath,
            xpub,
            xpubSegwit,
            addresses: {
              [addressRelPath]: address,
            },
            __hwExtraInfo__: {
              rootFingerprint: 0,
            },
          });
        }
        return ret;
      },
    });
  }

  override async signTransaction(
    params: ISignTransactionParams,
  ): Promise<ISignedTxPro> {
    const { unsignedTx } = params;
    const encodedTx = unsignedTx.encodedTx as IEncodedTxBtc;
    const { psbtHex, inputsToSign, inputs } = encodedTx;

    // The Trezor adapter's btcSignPsbt is not yet wired (stock Trezor firmware
    // has no SignPsbt message), so PSBT-style requests can't be served here.
    if (psbtHex && inputsToSign) {
      return this.signPsbt(params);
    }

    const { dbDevice } = checkIsDefined(params.deviceParams);
    const adapter = await getTrezorAdapterFromBackgroundApi(this.backgroundApi);
    initBitcoinEcc();

    const vault = this.vault as VaultBtc;
    const networkInfo = await this.getCoreApiNetworkInfo();
    const coinName = networkInfo.networkChainCode ?? 'btc';

    // Map each input's address → its derivation path via the UTXO list.
    const addresses = new Set(inputs.map((input) => input.address));
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    const { utxoList: utxosInfo } = await vault._collectUTXOsInfoByApi();
    const signers: Record<string, string> = {};
    for (const utxo of utxosInfo) {
      if (utxo.address && utxo.path && addresses.has(utxo.address)) {
        signers[utxo.address] = utxo.path;
      }
    }

    const prevTxids = Array.from(new Set(inputs.map((i) => i.txid))).filter(
      Boolean,
    );
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    const prevTxs: Record<string, string> =
      await vault.collectTxsByApi(prevTxids);

    const result = await callTrezorWithBleFallback(
      dbDevice,
      (connectId) =>
        adapter.hw.btcSignTransaction(connectId, dbDevice.deviceId, {
          ...buildTrezorBtcSignTransactionPayload({
            coin: coinName,
            encodedTx,
            prevTxs: getTrezorBtcRawPrevTxsToParse({
              rawPrevTxs: prevTxs,
              origRefTxs: encodedTx.origRefTxs,
            }),
            signers,
          }),
          ...thirdPartyPassphraseParamsFromDeviceParams(params.deviceParams),
        }),
      this.getBleFallbackOptions(),
    );

    if (!result.success) {
      throw convertThirdPartyDeviceError(result.payload, {
        vendor: 'Trezor',
        chain: 'Bitcoin',
      });
    }

    const { serializedTx } = result.payload;
    if (!serializedTx) {
      throw new OneKeyLocalError('Missing signed transaction data from Trezor');
    }
    const tx = BitcoinJS.Transaction.fromHex(serializedTx);

    return {
      txid: tx.getId(),
      rawTx: serializedTx,
      encodedTx: unsignedTx.encodedTx,
    };
  }

  override async signPsbt(
    _params: ISignTransactionParams,
  ): Promise<ISignedTxPro> {
    // Stock Trezor firmware has no SignPsbt message and the host-side
    // decode→SignTx→re-embed path is not implemented on the adapter yet.
    throw new ThirdPartyMethodNotSupported();
  }

  override async signMessage(
    params: ISignMessageParams,
  ): Promise<ISignedMessagePro> {
    const { dbDevice } = checkIsDefined(params.deviceParams);
    const dbAccount = await this.vault.getAccount();
    const adapter = await getTrezorAdapterFromBackgroundApi(this.backgroundApi);

    const networkInfo = await this.getCoreApiNetworkInfo();
    const coinName = networkInfo.networkChainCode ?? 'btc';
    const { receiveAddressPath } = params.chainExtraParams || {};
    const fullPath =
      receiveAddressPath ?? `${dbAccount.path}/${dbAccount.relPath ?? '0/0'}`;

    // Sign sequentially — the Trezor SDK job queue rejects concurrent calls to
    // the same device (rejectIfBusy → DeviceBusy), so a parallel Promise.all
    // would make multi-message requests fail with spurious busy errors.
    const result: string[] = [];
    for (const message of params.messages as IUnsignedMessageBtc[]) {
      const res =
        // eslint-disable-next-line no-await-in-loop
        await callTrezorWithBleFallback(
          dbDevice,
          (connectId) =>
            adapter.hw.btcSignMessage(connectId, dbDevice.deviceId, {
              ...buildTrezorBtcSignMessageParams({
                path: fullPath,
                coin: coinName,
                message,
              }),
              ...thirdPartyPassphraseParamsFromDeviceParams(
                params.deviceParams,
              ),
            }),
          this.getBleFallbackOptions(),
        );
      if (!res.success) {
        throw convertThirdPartyDeviceError(res.payload, {
          vendor: 'Trezor',
          chain: 'Bitcoin',
        });
      }
      result.push(res.payload.signature);
    }

    return result;
  }

  override async batchGetAddresses(params: IPrepareHardwareAccountsParams) {
    const { indexes, deviceParams, chainExtraParams } = params;
    const { dbDevice, confirmOnDevice } = deviceParams;
    const { template } = params.deriveInfo;
    const { pathPrefix, pathSuffix } = slicePathTemplate(template);
    const { receiveAddressPath } = chainExtraParams ?? {};
    const adapter = await getTrezorAdapterFromBackgroundApi(this.backgroundApi);
    const networkInfo = await this.getCoreApiNetworkInfo();
    const coinName = networkInfo.networkChainCode ?? 'btc';

    const addresses: Array<{ path: string; address: string }> = [];

    for (let i = 0; i < indexes.length; i += 1) {
      const index = indexes[i];
      const fullPath =
        receiveAddressPath ??
        `${pathPrefix}/${pathSuffix.replace('{index}', `${index}`)}`;

      let showOnDevice = false;
      if (confirmOnDevice === EConfirmOnDeviceType.EveryItem) {
        showOnDevice = true;
      } else if (confirmOnDevice === EConfirmOnDeviceType.LastItem) {
        showOnDevice = i === indexes.length - 1;
      }

      // The Trezor adapter derives the address from the full path + scriptType.
      const result = await callTrezorWithBleFallback(
        dbDevice,
        (connectId) =>
          adapter.hw.btcGetAddress(connectId, dbDevice.deviceId, {
            path: fullPath,
            coin: coinName,
            scriptType: getTrezorBtcScriptTypeFromPath(fullPath),
            showOnDevice,
            ...thirdPartyPassphraseParamsFromDeviceParams(deviceParams),
          }),
        this.getBleFallbackOptions(),
      );

      if (!result.success) {
        throw convertThirdPartyDeviceError(result.payload, {
          vendor: 'Trezor',
          chain: 'Bitcoin',
        });
      }

      addresses.push({
        path: fullPath,
        address: result.payload.address,
      });
    }

    return addresses;
  }

  override async buildHwAllNetworkPrepareAccountsParams(
    params: IBuildHwAllNetworkPrepareAccountsParams,
  ): Promise<AllNetworkAddressParams | undefined> {
    return {
      network: this.hwSdkNetwork,
      path: accountUtils.removePathLastSegment({
        path: params.path,
        removeCount: 2,
      }),
      showOnOneKey: false,
    };
  }
}
