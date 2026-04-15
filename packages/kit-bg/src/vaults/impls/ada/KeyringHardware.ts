/* eslint-disable @typescript-eslint/no-unused-vars */

import {
  transformToOneKeyInputs,
  transformToOneKeyOutputs,
} from '@onekeyhq/core/src/chains/ada/sdkAda/transformations';
import type { IEncodedTxAda } from '@onekeyhq/core/src/chains/ada/types';
import { EAdaNetworkId } from '@onekeyhq/core/src/chains/ada/types';
import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';
import type { ISignedMessagePro, ISignedTxPro } from '@onekeyhq/core/src/types';
import { NotImplemented, OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { convertDeviceError } from '@onekeyhq/shared/src/errors/utils/deviceErrorUtils';
import { CoreSDKLoader } from '@onekeyhq/shared/src/hardware/instance';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';

import { KeyringHardwareBase } from '../../base/KeyringHardwareBase';

import sdk from './sdkAda';
import { getChangeAddress } from './sdkAda/adaUtils';

import type VaultCardano from './Vault';
import type { IDBAccount, IDBUtxoAccount } from '../../../dbs/local/types';
import type {
  IBuildHwAllNetworkPrepareAccountsParams,
  IBuildPrepareAccountsPrefixedPathParams,
  IHwSdkNetwork,
  IPrepareHardwareAccountsParams,
  ISignMessageParams,
  ISignTransactionParams,
} from '../../types';
import type {
  AllNetworkAddressParams,
  CardanoGetAddressMethodParams,
} from '@onekeyfe/hd-core';

const ProtocolMagic = 764_824_073;

const getCardanoConstant = async () => {
  const { PROTO } = await CoreSDKLoader();
  return {
    addressType: PROTO.CardanoAddressType.BASE,
    derivationType: PROTO.CardanoDerivationType.ICARUS,
    protocolMagic: ProtocolMagic,
    networkId: EAdaNetworkId.MAINNET,
  };
};

export class KeyringHardware extends KeyringHardwareBase {
  override coreApi = coreChainApi.ada.hd;

  override buildPrepareAccountsPrefixedPath(
    params: IBuildPrepareAccountsPrefixedPathParams,
  ): string {
    const fullPath = accountUtils.buildPathFromTemplate({
      template: params.template,
      index: params.index,
    });
    return accountUtils.removePathLastSegment({
      path: fullPath,
      removeCount: 2,
    });
  }

  override hwSdkNetwork: IHwSdkNetwork = 'ada';

  override async buildHwAllNetworkPrepareAccountsParams(
    params: IBuildHwAllNetworkPrepareAccountsParams,
  ): Promise<AllNetworkAddressParams | undefined> {
    return {
      network: this.hwSdkNetwork,
      path: this.buildPrepareAccountsPrefixedPath({
        template: params.template,
        index: params.index,
      }),
      showOnOneKey: false,
    };
  }

  override async prepareAccounts(
    params: IPrepareHardwareAccountsParams,
  ): Promise<IDBAccount[]> {
    return this.basePrepareHdUtxoAccounts(params, {
      checkIsAccountUsed: () => Promise.resolve({ isUsed: true }),
      buildAddressesInfo: async ({ usedIndexes }) => {
        const addressesInfo = await this.baseGetDeviceAccountAddresses({
          params,
          usedIndexes,
          sdkGetAddressFn: async ({
            connectId,
            deviceId,
            pathPrefix,
            showOnOnekeyFn,
            template,
          }) => {
            const buildFullPath = (p: { index: number }) =>
              accountUtils.buildPathFromTemplate({
                template,
                index: p.index,
              });
            const buildPrefixedPath = (p: { index: number }) =>
              this.buildPrepareAccountsPrefixedPath({
                template,
                index: p.index,
              });

            const allNetworkAccounts = await this.getAllNetworkPrepareAccounts({
              params,
              usedIndexes,
              buildPath: buildPrefixedPath,
              buildResultAccount: ({ account }) => ({
                path: account.path,
                address: account.payload?.address || '',
                xpub: account.payload?.xpub || '',
                serializedPath: account.payload?.serializedPath || '',
                stakeAddress: account.payload?.stakeAddress || '',
                __hwExtraInfo__: undefined,
              }),
              hwSdkNetwork: this.hwSdkNetwork,
            });
            if (allNetworkAccounts) {
              return allNetworkAccounts;
            }

            throw new OneKeyLocalError('use sdk allNetworkGetAddress instead');

            // const { derivationType, addressType, networkId, protocolMagic } =
            //   await getCardanoConstant();
            // const paths = usedIndexes.map(
            //   (index) => `${pathPrefix}/${index}'/0/0`,
            // );
            // const stakingPaths = usedIndexes.map(
            //   (index) => `${pathPrefix}/${index}'/2/0`,
            // );
            // const bundle = paths.map((path, index) => ({
            //   addressParameters: {
            //     addressType,
            //     path,
            //     stakingPath: stakingPaths[index],
            //   },
            //   networkId,
            //   protocolMagic,
            //   derivationType,
            //   showOnOneKey: showOnOnekeyFn(index),
            // })) as CardanoGetAddressMethodParams[];

            // const HardwareSDK = await this.getHardwareSDKInstance();
            // const response = await HardwareSDK.cardanoGetAddress(
            //   connectId,
            //   deviceId,
            //   {
            //     ...params.deviceParams.deviceCommonParams,
            //     bundle,
            //   },
            // );
            // return response;
          },
        });

        const ret = [];
        const firstAddressRelPath = '0/0';
        const stakingAddressRelPath = '2/0';
        for (const addressInfo of addressesInfo) {
          const {
            address,
            xpub,
            serializedPath,
            stakeAddress,
            __hwExtraInfo__,
          } = addressInfo;
          if (address) {
            const addresses: Record<string, string> = {
              [firstAddressRelPath]: address,
            };
            if (stakeAddress) {
              addresses[stakingAddressRelPath] = stakeAddress;
            }
            const formattedPath = accountUtils.formatUtxoPath(serializedPath);
            ret.push({
              address,
              publicKey: '',
              path: formattedPath,
              relPath: firstAddressRelPath,
              xpub: xpub ?? '',
              addresses,
              __hwExtraInfo__,
            });
          }
        }
        return ret;
      },
    });
  }

  override async signTransaction(
    params: ISignTransactionParams,
  ): Promise<ISignedTxPro> {
    const { PROTO } = await CoreSDKLoader();
    const HardwareSDK = await this.getHardwareSDKInstance({
      connectId: params.deviceParams?.dbDevice?.connectId || '',
    });
    const deviceParams = checkIsDefined(params.deviceParams);
    const { connectId, deviceId } = deviceParams.dbDevice;

    const vault = this.vault as VaultCardano;
    const { unsignedTx } = params;
    const encodedTx = unsignedTx.encodedTx as IEncodedTxAda;
    const dbAccount = (await this.vault.getAccount()) as IDBUtxoAccount;
    const changeAddress = getChangeAddress(dbAccount);
    const { derivationType, networkId, protocolMagic } =
      await getCardanoConstant();
    const utxos = await vault._collectUTXOsInfoByApi({
      address: dbAccount.address,
      path: dbAccount.path,
      addresses: dbAccount.addresses,
      xpub: dbAccount.xpub,
    });

    const { inputs, outputs, fee, tx } = encodedTx;
    const isSignOnly = !!encodedTx.signOnly;
    const { rawTxHex } = tx;
    const CardanoApi = await sdk.getCardanoApi();
    let cardanoParams;

    // sign for DApp
    if (isSignOnly && rawTxHex) {
      const basePath = dbAccount.path.split('/').slice(0, 4).join('/');
      const paymentPath = `${basePath}/0/0`;
      const stakingPath = `${basePath}/2/0`;
      const keys = {
        payment: { hash: null, path: paymentPath },
        stake: { hash: null, path: stakingPath },
      };
      cardanoParams = await CardanoApi.txToOneKey(
        rawTxHex,
        networkId,
        keys,
        dbAccount.xpub,
        changeAddress,
      );
      // The SDK's emitted types declare the mutable fields (`inputs`,
      // `additionalWitnessRequests`) as `null` because they're inferred from
      // `let x = null`. We view the same object through a structural cast so
      // assignments don't need `as any` at every call site.
      const mutableCardanoParams = cardanoParams as unknown as {
        inputs?: Array<{
          prev_hash: string;
          prev_index: number;
          path?: string;
        }>;
        additionalWitnessRequests?: string[] | null;
      };

      // SDK pre-filters encodedTx.inputs to user-owned UTXOs only; firmware
      // needs the full inputs set (incl. external contract UTXOs) in the
      // original order, otherwise its rebuilt body hash won't match the
      // broadcast body hash and the tx is rejected on-chain.
      //
      // Only user-owned inputs get `path` attached. The wire message sent to
      // firmware (CardanoTxInput) only carries prev_hash/prev_index — path is
      // an SDK-side hint used by gatherWitnessPaths to decide which witnesses
      // to emit. Leaving external/script inputs without a path avoids an
      // unneeded paymentPath witness on txs that carry zero user-owned main
      // inputs (where forcing one could push past the dApp's fee budget),
      // while keeping normal dApp signing unchanged: whenever ≥1 user input
      // exists, witnessPaths still contains paymentPath after dedup.
      const ownedInputKeys = new Set(
        (inputs ?? []).map((u) => `${u.txHash.toLowerCase()}:${u.outputIndex}`),
      );
      const parsedInputs = await CardanoApi.parseRawTxInputs(rawTxHex);
      mutableCardanoParams.inputs = parsedInputs.map((input) => {
        const base = {
          prev_hash: input.prev_hash,
          prev_index: input.prev_index,
        };
        const key = `${input.prev_hash.toLowerCase()}:${input.prev_index}`;
        return ownedInputKeys.has(key) ? { ...base, path: paymentPath } : base;
      });

      // Drop the stake witness request when the tx clearly doesn't need a
      // stake signature (no cert, no withdrawal, user's stake hash not in
      // required_signers). The SDK adds it whenever the tx mints, but DeFi
      // dApp mints are script-authorized — the extra ~101 bytes can push
      // the broadcast tx past the dApp's fee budget (FeeTooSmallUTxO). Any
      // parsing failure falls back to keeping the witness.
      try {
        const additionalWitnessRequests =
          mutableCardanoParams.additionalWitnessRequests;
        if (
          Array.isArray(additionalWitnessRequests) &&
          additionalWitnessRequests.includes(stakingPath)
        ) {
          const userStakeKeyHash =
            await CardanoApi.extractStakeKeyHashFromBaseAddress(
              dbAccount.address,
            );
          if (userStakeKeyHash) {
            const bodyStakeInfo =
              await CardanoApi.parseRawTxBodyStakeInfo(rawTxHex);
            const stakeWitnessRequired =
              bodyStakeInfo.hasCertificates ||
              bodyStakeInfo.hasWithdrawals ||
              bodyStakeInfo.requiredSignerHashes.includes(userStakeKeyHash);
            if (!stakeWitnessRequired) {
              mutableCardanoParams.additionalWitnessRequests =
                additionalWitnessRequests.filter((p) => p !== stakingPath);
            }
          }
        }
      } catch {
        // fall through: keep stake witness on any failure
      }
    } else {
      const hasSetTag = await CardanoApi.hasSetTagWithBody(tx.body);
      cardanoParams = {
        signingMode: PROTO.CardanoTxSigningMode.ORDINARY_TRANSACTION,
        outputs: transformToOneKeyOutputs(
          outputs,
          changeAddress.addressParameters,
        ),
        fee,
        protocolMagic,
        networkId,
        tagCborSets: hasSetTag,
      };
    }

    const res = await HardwareSDK.cardanoSignTransaction(connectId, deviceId, {
      ...params.deviceParams?.deviceCommonParams,
      inputs: transformToOneKeyInputs(inputs, utxos),
      derivationType,
      ...cardanoParams,
    } as any);
    if (!res.success) {
      throw convertDeviceError(res.payload);
    }

    const signedTx = await CardanoApi.hwSignTransaction(
      tx.body,
      res.payload.witnesses,
      {
        signOnly: encodedTx.staking?.isStakingTx ? false : !!encodedTx.signOnly,
      },
    );

    return {
      rawTx: signedTx,
      txid: tx.hash,
      encodedTx,
    };
  }

  override async signMessage(
    params: ISignMessageParams,
  ): Promise<ISignedMessagePro> {
    // const HardwareSDK = await this.getHardwareSDKInstance();
    // const deviceParams = checkIsDefined(params.deviceParams);
    // const { connectId, deviceId } = deviceParams.dbDevice;
    // const { derivationType, networkId } = await getCardanoConstant();
    // const dbAccount = (await this.vault.getAccount()) as IDBUtxoAccount;
    // const result = await Promise.all(
    //   params.messages.map(
    //     // @ts-expect-error
    //     async ({ payload }: { payload: { addr: string; payload: string } }) => {
    //       const response = await HardwareSDK.cardanoSignMessage(
    //         connectId,
    //         deviceId,
    //         {
    //           ...params.deviceParams?.deviceCommonParams,
    //           path: `${dbAccount.path}/${dbAccount.relPath ?? '0/0'}`,
    //           networkId,
    //           derivationType,
    //           message: payload.payload,
    //         },
    //       );
    //       if (!response.success) {
    //         throw convertDeviceError(response.payload);
    //       }
    //       return response.payload;
    //     },
    //   ),
    // );
    // return result.map((ret) => JSON.stringify(ret));
    throw new NotImplemented();
  }
}
