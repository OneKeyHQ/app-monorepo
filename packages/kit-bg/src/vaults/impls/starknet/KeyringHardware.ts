import { ec } from 'starknet';

import sdkStarknet from '@onekeyhq/core/src/chains/starknet/sdkStarknet';
import type {
  IEncodedTxStarknet,
  IStarknetRawDeployAccountTx,
  IStarknetRawTx,
  IStarknetResourceBounds,
  IStarknetSignature,
} from '@onekeyhq/core/src/chains/starknet/types';
import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';
import type {
  ICoreApiGetAddressItem,
  ISignedTxPro,
} from '@onekeyhq/core/src/types';
import {
  NotImplemented,
  OneKeyInternalError,
} from '@onekeyhq/shared/src/errors';
import { convertDeviceResponse } from '@onekeyhq/shared/src/errors/utils/deviceErrorUtils';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EAddressEncodings } from '@onekeyhq/shared/src/types/address';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';
import { EConfirmOnDeviceType } from '@onekeyhq/shared/types/device';

import { KeyringHardwareBase } from '../../base/KeyringHardwareBase';

import { getStarknetHardwareSdk } from './hardwareSdk';

import type {
  IDeriveStrk20ViewingKeyParams,
  IDeriveStrk20ViewingKeyResult,
  ISignStrk20ProofInvocationParams,
} from './privacyKeyringTypes';
import type { IDBAccount } from '../../../dbs/local/types';
import type {
  IBuildHwAllNetworkPrepareAccountsParams,
  IHwSdkNetwork,
  IPrepareHardwareAccountsParams,
  ISignMessageParams,
  ISignTransactionParams,
} from '../../types';
import type { AllNetworkAddressParams } from '@onekeyfe/hd-core';

// The firmware's built-in account classes use its native Stark signer.
const STARK_PUBLIC_KEY_TYPE = 1;

function getHardwareAccountContract(encoding: EAddressEncodings | undefined) {
  if (encoding !== undefined && encoding !== EAddressEncodings.STARKNET_OZ) {
    throw new OneKeyInternalError({
      key: ETranslations.feedback_hardware_unsupported_current_address_type,
    });
  }
  return sdkStarknet.getAccountContractByEncoding(encoding);
}

function toHardwareResourceBounds(bounds: IStarknetResourceBounds) {
  const toItem = (item: IStarknetResourceBounds['l1_gas']) => ({
    maxAmount: item.max_amount,
    maxPricePerUnit: item.max_price_per_unit,
  });
  return {
    l1Gas: toItem(bounds.l1_gas),
    l2Gas: toItem(bounds.l2_gas),
    l1DataGas: toItem(bounds.l1_data_gas),
  };
}

function verifyHardwareSignature({
  transactionHash,
  signature,
  expectedHash,
  publicKey,
}: {
  transactionHash: string;
  signature: string;
  expectedHash: string;
  publicKey: string;
}): IStarknetSignature {
  if (BigInt(transactionHash) !== BigInt(expectedHash)) {
    throw new OneKeyInternalError({
      key: ETranslations.feedback_failed_to_sign_transaction,
    });
  }
  const r = BigInt(`0x${signature.slice(2, 66)}`);
  const s = BigInt(`0x${signature.slice(66)}`);
  const x = BigInt(publicKey).toString(16).padStart(64, '0');
  // Starknet accounts store only x. Either compressed point can represent
  // the device's signer, so verify both parities with the curve library.
  const valid = ['02', '03'].some((prefix) => {
    try {
      return ec.starkCurve.verify(
        signature.slice(2),
        expectedHash,
        `${prefix}${x}`,
      );
    } catch {
      return false;
    }
  });
  if (!valid) {
    throw new OneKeyInternalError({
      key: ETranslations.feedback_failed_to_sign_transaction,
    });
  }
  return [sdkStarknet.toFelt(r.toString()), sdkStarknet.toFelt(s.toString())];
}

export class KeyringHardware extends KeyringHardwareBase {
  override coreApi = coreChainApi.starknet.hd;

  // Cast until @onekeyfe/hd-core publishes the `starknet` INetwork union update.
  override hwSdkNetwork: IHwSdkNetwork = 'starknet' as IHwSdkNetwork;

  override async buildHwAllNetworkPrepareAccountsParams(
    params: IBuildHwAllNetworkPrepareAccountsParams,
  ): Promise<AllNetworkAddressParams | undefined> {
    return Promise.resolve({
      network: this.hwSdkNetwork,
      path: params.path,
      showOnOneKey: false,
    });
  }

  override async batchGetAddresses(params: IPrepareHardwareAccountsParams) {
    const contract = getHardwareAccountContract(
      params.deriveInfo.addressEncoding,
    );
    const { dbDevice, deviceCommonParams, confirmOnDevice } =
      params.deviceParams;
    const { connectId, deviceId } = dbDevice;
    const sdk = getStarknetHardwareSdk(
      await this.getHardwareSDKInstance({ connectId }),
    );
    const paths = params.indexes.map((index) =>
      accountUtils.buildPathFromTemplate({
        template: params.deriveInfo.template,
        index,
      }),
    );
    const publicKeys = await convertDeviceResponse(() =>
      sdk.starknetGetPublicKey(connectId, deviceId, {
        ...deviceCommonParams,
        bundle: paths.map((path) => ({
          path,
          publicKeyType: STARK_PUBLIC_KEY_TYPE,
          showOnOneKey: false,
        })),
      }),
    );
    const deployParams = publicKeys.map((item, index) => {
      if (item.path !== paths[index]) {
        throw new OneKeyInternalError({
          key: ETranslations.send_verification_failure,
        });
      }
      return sdkStarknet.getAccountDeployParams(item.pub, contract);
    });
    const addresses = await convertDeviceResponse(() =>
      sdk.starknetGetAddress(connectId, deviceId, {
        ...deviceCommonParams,
        bundle: paths.map((path, index) => ({
          path,
          publicKeyType: STARK_PUBLIC_KEY_TYPE,
          classHash: deployParams[index].classHash,
          contractAddressSalt: deployParams[index].addressSalt,
          constructorCalldata: deployParams[index].constructorCalldata,
          showOnOneKey:
            confirmOnDevice === EConfirmOnDeviceType.EveryItem ||
            (confirmOnDevice === EConfirmOnDeviceType.LastItem &&
              index === paths.length - 1),
        })),
      }),
    );
    return addresses.map((item, index) => {
      const address = sdkStarknet.normalizeAddress(item.address);
      if (
        item.path !== paths[index] ||
        address !== deployParams[index].contractAddress
      ) {
        throw new OneKeyInternalError({
          key: ETranslations.send_verification_failure,
        });
      }
      return {
        path: item.path,
        address,
        publicKey: publicKeys[index].pub,
        __hwExtraInfo__: undefined,
      };
    });
  }

  override async prepareAccounts(
    params: IPrepareHardwareAccountsParams,
  ): Promise<IDBAccount[]> {
    const contract = getHardwareAccountContract(
      params.deriveInfo.addressEncoding,
    );
    return this.basePrepareHdNormalAccounts(params, {
      buildAddressesInfo: async ({ usedIndexes }) => {
        if (params.hwAllNetworkPrepareAccountsResponse) {
          const items = await this.baseGetDeviceAccountAddresses({
            params,
            usedIndexes,
            sdkGetAddressFn: async ({ template }) => {
              const allNetworkAccounts =
                await this.getAllNetworkPrepareAccounts({
                  params,
                  usedIndexes,
                  hwSdkNetwork: this.hwSdkNetwork,
                  buildPath: ({ index }) =>
                    accountUtils.buildPathFromTemplate({ template, index }),
                  buildResultAccount: ({ account }) => {
                    const pub = account.payload?.pub || '';
                    if (!pub) {
                      throw new OneKeyInternalError({
                        key: ETranslations.send_verification_failure,
                      });
                    }
                    const deployParams = sdkStarknet.getAccountDeployParams(
                      pub,
                      contract,
                    );
                    return {
                      path: account.path,
                      address: deployParams.contractAddress,
                      publicKey: pub,
                      __hwExtraInfo__: undefined,
                    };
                  },
                });
              if (allNetworkAccounts) {
                return allNetworkAccounts;
              }
              throw new OneKeyInternalError({
                key: ETranslations.send_verification_failure,
              });
            },
          });
          return items.map(
            ({
              path,
              address,
              publicKey,
              __hwExtraInfo__,
            }): ICoreApiGetAddressItem => ({
              path,
              address,
              publicKey,
              __hwExtraInfo__,
            }),
          );
        }
        return this.batchGetAddresses(params);
      },
    });
  }

  override async signTransaction({
    unsignedTx,
    deviceParams,
  }: ISignTransactionParams): Promise<ISignedTxPro> {
    const encodedTx = unsignedTx.encodedTx as IEncodedTxStarknet;
    if (
      encodedTx.type === 'DEPLOY_ACCOUNT' &&
      (!encodedTx.deployAccount || encodedTx.calls.length || encodedTx.privacy)
    ) {
      throw new OneKeyInternalError({
        key: ETranslations.feedback_failed_to_parse_transaction,
      });
    }
    const [account, network, encoding] = await Promise.all([
      this.vault.getAccount(),
      this.vault.getNetwork(),
      this.vault.getAddressEncoding(),
    ]);
    const contract = getHardwareAccountContract(encoding);
    const publicKey = account.pub;
    if (!publicKey) {
      throw new OneKeyInternalError();
    }
    if (
      encodedTx.version !== '0x3' ||
      encodedTx.nonceDataAvailabilityMode !== 'L1' ||
      encodedTx.feeDataAvailabilityMode !== 'L1' ||
      !sdkStarknet.isSameStarknetChainId(encodedTx.chainId, network.chainId) ||
      sdkStarknet.normalizeAddress(encodedTx.from) !== account.address
    ) {
      throw new OneKeyInternalError({
        key: ETranslations.send_verification_failure,
      });
    }
    if (
      encodedTx.paymasterData.length > 16 ||
      encodedTx.accountDeploymentData.length > 16
    ) {
      throw new OneKeyInternalError({
        key: ETranslations.feedback_failed_to_sign_transaction,
      });
    }
    const deployment = sdkStarknet.getAccountDeployParams(publicKey, contract);
    if (deployment.contractAddress !== account.address) {
      throw new OneKeyInternalError({
        key: ETranslations.send_verification_failure,
      });
    }
    const { dbDevice, deviceCommonParams } = checkIsDefined(deviceParams);
    const { connectId, deviceId } = dbDevice;
    const sdk = getStarknetHardwareSdk(
      await this.getHardwareSDKInstance({ connectId }),
    );
    const common = {
      ...deviceCommonParams,
      path: account.path,
      publicKeyType: STARK_PUBLIC_KEY_TYPE,
      chainId: encodedTx.chainId,
      tip: encodedTx.tip,
      paymasterData: encodedTx.paymasterData,
      nonceDataAvailabilityMode: 0,
      feeDataAvailabilityMode: 0,
    };
    const { txHash: invokeTxHash, compiledCalldata } =
      sdkStarknet.calculateInvokeTxHash({
        ...encodedTx,
        senderAddress: encodedTx.from,
        proofFacts: encodedTx.privacy?.proofFacts,
      });
    const rawTx: IStarknetRawTx = {
      invokeTxHash,
      invoke: {
        type: 'INVOKE',
        version: encodedTx.version,
        sender_address: sdkStarknet.toFelt(encodedTx.from),
        calldata: sdkStarknet.toFeltArray(compiledCalldata),
        signature: ['0x0', '0x0'],
        nonce: sdkStarknet.toFelt(encodedTx.nonce),
        resource_bounds: sdkStarknet.toRpcResourceBounds(
          encodedTx.resourceBounds,
        ),
        tip: sdkStarknet.toFelt(encodedTx.tip),
        paymaster_data: sdkStarknet.toFeltArray(encodedTx.paymasterData),
        account_deployment_data: sdkStarknet.toFeltArray(
          encodedTx.accountDeploymentData,
        ),
        nonce_data_availability_mode: encodedTx.nonceDataAvailabilityMode,
        fee_data_availability_mode: encodedTx.feeDataAvailabilityMode,
        ...(encodedTx.privacy?.proofFacts.length
          ? {
              proof_facts: sdkStarknet.toFeltArray(
                encodedTx.privacy.proofFacts,
              ),
            }
          : {}),
      },
      ...(encodedTx.privacy ? { proof: encodedTx.privacy.proof } : {}),
    };
    if (encodedTx.deployAccount) {
      const deploy = encodedTx.deployAccount;
      if (
        BigInt(deploy.classHash) !== BigInt(deployment.classHash) ||
        BigInt(deploy.addressSalt) !== BigInt(deployment.addressSalt) ||
        stringUtils.stableStringify(
          sdkStarknet.toFeltArray(deploy.constructorCalldata),
        ) !== stringUtils.stableStringify(deployment.constructorCalldata)
      ) {
        throw new OneKeyInternalError({
          key: ETranslations.send_verification_failure,
        });
      }
      const deployAccountTxHash = sdkStarknet.calculateDeployAccountTxHash({
        ...encodedTx,
        ...deploy,
        contractAddress: encodedTx.from,
      });
      const signed = await convertDeviceResponse(() =>
        sdk.starknetSignTransaction(connectId, deviceId, {
          ...common,
          nonce: deploy.nonce,
          resourceBounds: toHardwareResourceBounds(deploy.resourceBounds),
          deployAccountV3: {
            classHash: deploy.classHash,
            contractAddressSalt: deploy.addressSalt,
            constructorCalldata: deploy.constructorCalldata,
            expectedContractAddress: encodedTx.from,
          },
        }),
      );
      rawTx.deployAccountTxHash = deployAccountTxHash;
      rawTx.deployAccount = {
        type: 'DEPLOY_ACCOUNT',
        version: encodedTx.version,
        class_hash: sdkStarknet.toFelt(deploy.classHash),
        contract_address_salt: sdkStarknet.toFelt(deploy.addressSalt),
        constructor_calldata: sdkStarknet.toFeltArray(
          deploy.constructorCalldata,
        ),
        signature: verifyHardwareSignature({
          ...signed,
          expectedHash: deployAccountTxHash,
          publicKey,
        }),
        nonce: sdkStarknet.toFelt(deploy.nonce),
        resource_bounds: sdkStarknet.toRpcResourceBounds(deploy.resourceBounds),
        tip: sdkStarknet.toFelt(encodedTx.tip),
        paymaster_data: sdkStarknet.toFeltArray(encodedTx.paymasterData),
        nonce_data_availability_mode: encodedTx.nonceDataAvailabilityMode,
        fee_data_availability_mode: encodedTx.feeDataAvailabilityMode,
      };
      if (encodedTx.type === 'DEPLOY_ACCOUNT') {
        const deploymentTx: IStarknetRawDeployAccountTx = {
          type: 'DEPLOY_ACCOUNT',
          deployAccount: rawTx.deployAccount,
          deployAccountTxHash,
        };
        return {
          encodedTx,
          txid: deployAccountTxHash,
          rawTx: stringUtils.stableStringify(deploymentTx),
        };
      }
    }
    const signed = await convertDeviceResponse(() =>
      sdk.starknetSignTransaction(connectId, deviceId, {
        ...common,
        nonce: encodedTx.nonce,
        resourceBounds: toHardwareResourceBounds(encodedTx.resourceBounds),
        invokeV3: {
          senderAddress: encodedTx.from,
          calldata: sdkStarknet.toFeltArray(compiledCalldata),
          accountDeploymentData: encodedTx.accountDeploymentData,
          ...(encodedTx.privacy?.proofFacts.length
            ? { proofFacts: encodedTx.privacy.proofFacts }
            : {}),
        },
      }),
    );
    rawTx.invoke.signature = verifyHardwareSignature({
      ...signed,
      expectedHash: invokeTxHash,
      publicKey,
    });
    return {
      encodedTx,
      txid: invokeTxHash,
      rawTx: stringUtils.stableStringify(rawTx),
    };
  }

  async deriveStrk20ViewingKey({
    deviceParams,
    chainId,
    accountAddress,
    poolAddress,
    keyIndex,
  }: IDeriveStrk20ViewingKeyParams): Promise<IDeriveStrk20ViewingKeyResult> {
    const [account, network, encoding] = await Promise.all([
      this.vault.getAccount(),
      this.vault.getNetwork(),
      this.vault.getAddressEncoding(),
    ]);
    getHardwareAccountContract(encoding);
    if (
      !sdkStarknet.isSameStarknetChainId(chainId, network.chainId) ||
      sdkStarknet.normalizeAddress(accountAddress) !== account.address ||
      (keyIndex !== undefined && keyIndex !== 0)
    ) {
      throw new OneKeyInternalError({
        key: ETranslations.send_verification_failure,
      });
    }
    const normalizedChainId = sdkStarknet.toStarknetChainId(chainId);
    const { dbDevice, deviceCommonParams } = checkIsDefined(deviceParams);
    const { connectId, deviceId } = dbDevice;
    const sdk = getStarknetHardwareSdk(
      await this.getHardwareSDKInstance({ connectId }),
    );
    const { viewingKey } = await convertDeviceResponse(() =>
      sdk.starknetExportPrivacyViewingKey(connectId, deviceId, {
        ...deviceCommonParams,
        path: account.path,
        publicKeyType: STARK_PUBLIC_KEY_TYPE,
        chainId: normalizedChainId,
        accountAddress: account.address,
        poolAddress,
        derivationVersion: 1,
      }),
    );
    const { getStrk20PublicViewingKey } =
      await import('@onekeyhq/core/src/chains/starknet/sdkStarknet/viewingKey');
    return { viewingKey, publicKeyX: getStrk20PublicViewingKey(viewingKey) };
  }

  async signStrk20ProofInvocation({
    deviceParams,
    invocation,
  }: ISignStrk20ProofInvocationParams): Promise<IStarknetSignature> {
    const [account, network, encoding] = await Promise.all([
      this.vault.getAccount(),
      this.vault.getNetwork(),
      this.vault.getAddressEncoding(),
    ]);
    getHardwareAccountContract(encoding);
    const call = invocation.calls[0];
    if (
      !account.pub ||
      invocation.version !== '0x3' ||
      invocation.nonceDataAvailabilityMode !== 'L1' ||
      invocation.feeDataAvailabilityMode !== 'L1' ||
      !sdkStarknet.isSameStarknetChainId(invocation.chainId, network.chainId) ||
      sdkStarknet.normalizeAddress(invocation.poolAddress) ===
        account.address ||
      invocation.calls.length !== 1 ||
      call.entrypoint !== 'compile_actions' ||
      sdkStarknet.normalizeAddress(call.contractAddress) !==
        sdkStarknet.normalizeAddress(invocation.poolAddress) ||
      !call.calldata[0] ||
      sdkStarknet.normalizeAddress(call.calldata[0]) !== account.address
    ) {
      throw new OneKeyInternalError({
        key: ETranslations.send_verification_failure,
      });
    }
    const { dbDevice, deviceCommonParams } = checkIsDefined(deviceParams);
    const { connectId, deviceId } = dbDevice;
    const sdk = getStarknetHardwareSdk(
      await this.getHardwareSDKInstance({ connectId }),
    );
    const { txHash, compiledCalldata } = sdkStarknet.calculateInvokeTxHash({
      ...invocation,
      senderAddress: invocation.poolAddress,
    });
    const signed = await convertDeviceResponse(() =>
      sdk.starknetSignTransaction(connectId, deviceId, {
        ...deviceCommonParams,
        path: account.path,
        publicKeyType: STARK_PUBLIC_KEY_TYPE,
        chainId: invocation.chainId,
        nonce: invocation.nonce,
        resourceBounds: toHardwareResourceBounds(invocation.resourceBounds),
        tip: invocation.tip,
        paymasterData: invocation.paymasterData,
        nonceDataAvailabilityMode: 0,
        feeDataAvailabilityMode: 0,
        privacyViewingKeyDerivation: 1,
        invokeV3: {
          senderAddress: invocation.poolAddress,
          calldata: sdkStarknet.toFeltArray(compiledCalldata),
          accountDeploymentData: invocation.accountDeploymentData,
        },
      }),
    );
    return verifyHardwareSignature({
      ...signed,
      expectedHash: txHash,
      publicKey: account.pub,
    });
  }

  override async signMessage(_params: ISignMessageParams): Promise<string[]> {
    throw new NotImplemented();
  }
}
