import BigNumber from 'bignumber.js';
import { md5 } from 'js-md5';
import { isEmpty, orderBy } from 'lodash';

import sdkStarknet from '@onekeyhq/core/src/chains/starknet/sdkStarknet';
import type {
  IDecodedTxExtraStarknet,
  IEncodedTxStarknet,
  IEncodedTxStarknetPrivacy,
  IStarknetCall,
  IStarknetRawDeployAccountTx,
  IStarknetRawTx,
  IStarknetResourceBounds,
  IStarknetSignedDeployAccount,
  IStarknetSignedInvoke,
} from '@onekeyhq/core/src/chains/starknet/types';
import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';
import {
  decodeSensitiveTextAsync,
  encodeSensitiveTextAsync,
} from '@onekeyhq/core/src/secret';
import type { ISignedTxPro, IUnsignedTxPro } from '@onekeyhq/core/src/types';
import {
  FailedToEstimatedGasError,
  NotImplemented,
  OneKeyError,
  OneKeyInternalError,
  OneKeyLocalError,
} from '@onekeyhq/shared/src/errors';
import { ETranslations, ETranslationsMock } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import { starknetPrivacyOperationTitles } from '@onekeyhq/shared/src/locale/starknetPrivacy';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { EAddressEncodings } from '@onekeyhq/shared/src/types/address';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';
import { mapStrk20Error } from '@onekeyhq/shared/src/utils/strk20ErrorUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { convertDecodedTxActionsToSignatureConfirmTxDisplayComponents } from '@onekeyhq/shared/src/utils/txActionUtils';
import type {
  IAddressValidation,
  IFetchServerAccountDetailsParams,
  IFetchServerAccountDetailsResponse,
  IGeneralInputValidation,
  INetworkAccountAddressDetail,
  IPrivateKeyValidation,
  IXprvtValidation,
  IXpubValidation,
} from '@onekeyhq/shared/types/address';
import type {
  IMeasureRpcStatusParams,
  IMeasureRpcStatusResult,
} from '@onekeyhq/shared/types/customRpc';
import type {
  IEstimateGasParams,
  IFeeStarknet,
  IFeeStarknetResourceBound,
  IServerEstimateFeeResponse,
} from '@onekeyhq/shared/types/fee';
import type {
  IAccountHistoryTx,
  IServerFetchAccountHistoryDetailParams,
  IServerFetchAccountHistoryDetailResp,
} from '@onekeyhq/shared/types/history';
import {
  EOnChainHistoryTxStatus,
  EOnChainHistoryTxType,
} from '@onekeyhq/shared/types/history';
import type {
  IFetchServerTokenDetailParams,
  IFetchServerTokenDetailResponse,
  IFetchServerTokenListApiParams,
  IFetchServerTokenListParams,
  IFetchServerTokenListResponse,
  IServerAccountTokenItem,
} from '@onekeyhq/shared/types/serverToken';
import { EParseTxComponentType } from '@onekeyhq/shared/types/signatureConfirm';
import type { IDisplayComponent } from '@onekeyhq/shared/types/signatureConfirm';
import { EStrk20ErrorCode } from '@onekeyhq/shared/types/starknetPrivacy';
import type {
  IAccountToken,
  IFetchTokenDetailItem,
  ITokenData,
  ITokenFiat,
} from '@onekeyhq/shared/types/token';
import type {
  IDecodedTx,
  IDecodedTxAction,
  IDecodedTxTransferInfo,
} from '@onekeyhq/shared/types/tx';
import {
  EDecodedTxActionType,
  EDecodedTxStatus,
} from '@onekeyhq/shared/types/tx';

import { VaultBase } from '../../base/VaultBase';
import { fetchLocalWalletNativeTokenQuote } from '../../localWallet/nativeTokenPrice';
import { ESignedTxBroadcastStatus } from '../../types';

import { KeyringHardware } from './KeyringHardware';
import { KeyringHd } from './KeyringHd';
import { KeyringImported } from './KeyringImported';
import { KeyringWatching } from './KeyringWatching';
import {
  ClientStarknet,
  EStarknetRpcErrorCode,
  STARKNET_PRESET_TOKENS,
  STRK20_SCREENING_WINDOW_MS,
  ZERO_SIGNATURE,
} from './sdkStarknet';
import { ERC20_ENTRYPOINT, STRK_TOKEN_ADDRESS } from './sdkStarknet/consts';
import {
  buildErc20TransferCall,
  getReceiptTxStatus,
  hexToDecimalString,
  isValidStarknetAddress,
  normalizeStarknetAddress,
  normalizeTokenAddress,
  parseRpcErrorCode,
  resourceBoundsToFee,
  sumResourceBounds,
  toHexFelt,
  toResourceBounds,
  u256ToDecimalString,
  zeroResourceBounds,
} from './utils';

import type {
  IStarknetBroadcastTx,
  IStarknetFeeEstimate,
  IStarknetReceipt,
} from './sdkStarknet';
import type { IDBWalletType } from '../../../dbs/local/types';
import type { KeyringBase } from '../../base/KeyringBase';
import type {
  IBroadcastTransactionByCustomRpcParams,
  IBroadcastTransactionParams,
  IBuildAccountAddressDetailParams,
  IBuildDecodedTxParams,
  IBuildEncodedTxParams,
  IBuildUnsignedTxParams,
  IGetPrivateKeyFromImportedParams,
  IGetPrivateKeyFromImportedResult,
  ISendConfirmationPreparation,
  ITransferInfo,
  IUpdateUnsignedTxParams,
  IValidateGeneralInputParams,
} from '../../types';

type IStarknetLegEstimates = {
  invokeBounds: IStarknetResourceBounds;
  invokeEstimate: IStarknetFeeEstimate;
  deployBounds?: IStarknetResourceBounds;
  // the node's own overall_fee for the invoke leg, before our resource-bounds
  // overhead; the confirm screen shows it as the display minimum
  invokeOverallFee: string;
  deployOverallFee?: string;
};

export default class Vault extends VaultBase {
  override coreApi = coreChainApi.starknet.hd;

  override keyringMap: Record<IDBWalletType, typeof KeyringBase | undefined> = {
    hd: KeyringHd,
    qr: undefined,
    hw: KeyringHardware,
    imported: KeyringImported,
    watching: KeyringWatching,
    external: undefined,
  };

  private _getClientCache = memoizee(
    async (customRpcUrl: string) =>
      new ClientStarknet({
        networkId: this.networkId,
        backgroundApi: this.backgroundApi,
        customRpcUrl: customRpcUrl || undefined,
      }),
    {
      promise: true,
      maxAge: timerUtils.getTimeDurationMs({ minute: 3 }),
      normalizer: ([customRpcUrl]) => `${this.networkId}-${customRpcUrl}`,
    },
  );

  /** '' when no custom RPC is configured, which hands the client its default. */
  private async getCustomRpcUrl(): Promise<string> {
    const customRpc =
      await this.backgroundApi.serviceCustomRpc.getCustomRpcForNetwork(
        this.networkId,
      );
    return customRpc?.rpc && customRpc?.enabled ? customRpc.rpc : '';
  }

  /** The endpoint actually in use, or '' while requests go through the proxy. */
  override async getRpcUrl(): Promise<string> {
    return (await this.getClient()).rpcUrl;
  }

  async getClient(): Promise<ClientStarknet> {
    return this._getClientCache(await this.getCustomRpcUrl());
  }

  // ---------------------------------------------------------------- addresses

  override async buildAccountAddressDetail(
    params: IBuildAccountAddressDetailParams,
  ): Promise<INetworkAccountAddressDetail> {
    const { account, networkId } = params;
    const { normalizedAddress, displayAddress, isValid } =
      await this.validateAddress(account.address || '');

    return {
      networkId,
      normalizedAddress,
      displayAddress,
      address: displayAddress,
      baseAddress: normalizedAddress,
      isValid,
      allowEmptyAddress: false,
    };
  }

  /**
   * Any valid felt is a valid address: a counterfactual account that has never
   * been deployed still receives funds, so watching it must be allowed. That
   * also lets an EVM-shaped 0x + 40-hex string through, which is intentional:
   * Starknet felts carry no checksum and no length rule to reject it by.
   * Starknet has no checksum form, so display and normalized are the same
   * zero-padded lowercase string.
   */
  override async validateAddress(address: string): Promise<IAddressValidation> {
    if (!isValidStarknetAddress(address)) {
      return { isValid: false, normalizedAddress: '', displayAddress: '' };
    }
    const normalized = normalizeStarknetAddress(address);
    return {
      isValid: true,
      normalizedAddress: normalized,
      displayAddress: normalized,
    };
  }

  override async validateXpub(_xpub: string): Promise<IXpubValidation> {
    return { isValid: false };
  }

  override async validateXprvt(_xprvt: string): Promise<IXprvtValidation> {
    return { isValid: false };
  }

  override async validatePrivateKey(
    privateKey: string,
  ): Promise<IPrivateKeyValidation> {
    try {
      sdkStarknet.normalizeStarkPrivateKey(privateKey);
      return { isValid: true };
    } catch {
      return { isValid: false };
    }
  }

  override async validateGeneralInput(
    params: IValidateGeneralInputParams,
  ): Promise<IGeneralInputValidation> {
    const { result } = await this.baseValidateGeneralInput(params);
    return result;
  }

  override async getPrivateKeyFromImported(
    params: IGetPrivateKeyFromImportedParams,
  ): Promise<IGetPrivateKeyFromImportedResult> {
    const input = await decodeSensitiveTextAsync({ encodedText: params.input });
    // Argent and Braavos export a Stark private key felt, 0x-prefixed or not
    const normalized = sdkStarknet.normalizeStarkPrivateKey(input);
    const privateKey = await encodeSensitiveTextAsync({
      text: normalized.replace(/^0x/, ''),
    });
    return { privateKey };
  }

  // ---------------------------------------------------------------- build tx

  override async buildEncodedTx(
    params: IBuildEncodedTxParams,
  ): Promise<IEncodedTxStarknet> {
    const { transfersInfo } = params;
    if (!transfersInfo || transfersInfo.length === 0) {
      throw new OneKeyInternalError({
        key: ETranslations.feedback_failed_to_parse_transaction,
      });
    }
    if (transfersInfo.length > 1) {
      throw new NotImplemented();
    }

    const transferInfo = transfersInfo[0];
    const call = await this._buildTransferCall(transferInfo);
    return this._assembleEncodedTx({
      from: normalizeStarknetAddress(transferInfo.from),
      calls: [call],
    });
  }

  /**
   * STRK20 entry point, called by serviceStarknetPrivacy with calls the SDK
   * built. Multi-call lives here rather than in buildEncodedTx because the
   * privacy path needs `[approve, apply_actions]` in one transaction: the pool
   * pulls its STRK fee before doing anything, and a separate approve would be a
   * transparent transaction that re-arms the 10-block proving wait.
   */
  async buildPrivacyEncodedTx(params: {
    from: string;
    calls: IStarknetCall[];
    privacy: IEncodedTxStarknetPrivacy;
  }): Promise<IEncodedTxStarknet> {
    if (params.calls.length === 0) {
      throw new OneKeyInternalError({
        key: ETranslations.feedback_failed_to_parse_transaction,
      });
    }
    return this._assembleEncodedTx({
      from: normalizeStarknetAddress(params.from),
      calls: params.calls,
      privacy: params.privacy,
    });
  }

  async getAccountDeploymentProgress(txid?: string): Promise<{
    status?: EOnChainHistoryTxStatus;
    txid?: string;
  }> {
    const [client, accountAddress] = await Promise.all([
      this.getClient(),
      this.getAccountAddress(),
    ]);
    if (txid) {
      const receipt = await client.getTransactionReceipt(txid);
      if (receipt && receipt.type !== 'DEPLOY_ACCOUNT') {
        throw new OneKeyInternalError({
          key: ETranslations.send_verification_failure,
        });
      }
      const status = getReceiptTxStatus(receipt);
      if (
        status === EOnChainHistoryTxStatus.Success &&
        !(await client.isAccountDeployed(accountAddress, 'latest'))
      ) {
        return { status: EOnChainHistoryTxStatus.Pending, txid };
      }
      return { status, txid };
    }
    if (await client.isAccountDeployed(accountAddress, 'latest')) {
      return { status: EOnChainHistoryTxStatus.Success };
    }
    const pendingTxs =
      await this.backgroundApi.serviceHistory.getAccountLocalHistoryPendingTxs({
        networkId: this.networkId,
        accountAddress,
      });
    const activation = pendingTxs.find(
      ({ decodedTx }) =>
        (decodedTx.encodedTx as IEncodedTxStarknet | undefined)?.type ===
          'DEPLOY_ACCOUNT' ||
        (decodedTx.extraInfo as IDecodedTxExtraStarknet | undefined)
          ?.accountDeployment,
    )?.decodedTx.txid;
    if (!activation) return {};
    const receipt = await client.getTransactionReceipt(activation);
    const status = getReceiptTxStatus(receipt);
    return status === EOnChainHistoryTxStatus.Failed
      ? {}
      : { status: EOnChainHistoryTxStatus.Pending, txid: activation };
  }

  async buildAccountActivationTx(): Promise<IUnsignedTxPro | undefined> {
    const encodedTx = await this._assembleEncodedTx({
      from: await this.getAccountAddress(),
      calls: [],
      deployOnly: true,
    });
    return encodedTx.deployAccount
      ? this.buildUnsignedTx({ encodedTx })
      : undefined;
  }

  private async _assembleEncodedTx(params: {
    from: string;
    calls: IStarknetCall[];
    privacy?: IEncodedTxStarknetPrivacy;
    deployOnly?: boolean;
  }): Promise<IEncodedTxStarknet> {
    const { from, calls, privacy } = params;
    const [network, client] = await Promise.all([
      this.getNetwork(),
      this.getClient(),
    ]);

    // Deploy detection is authoritative per call and never cached: a previous
    // attempt may have deployed the account even though its invoke leg failed.
    const isDeployed = await client.isAccountDeployed(from, 'latest');

    const encodedTx: IEncodedTxStarknet = {
      chainId: sdkStarknet.toStarknetChainId(network.chainId),
      from,
      version: '0x3',
      nonce: '0x0',
      calls,
      resourceBounds: zeroResourceBounds(),
      tip: '0x0',
      paymasterData: [],
      accountDeploymentData: [],
      nonceDataAvailabilityMode: 'L1',
      feeDataAvailabilityMode: 'L1',
      ...(privacy ? { privacy } : {}),
    };

    if (isDeployed) {
      encodedTx.nonce = await client.getNonce(from);
    } else {
      const deployParams = await this._getAccountDeployParams(from);
      encodedTx.deployAccount = {
        ...deployParams,
        nonce: '0x0',
        resourceBounds: zeroResourceBounds(),
      };
      // the DEPLOY_ACCOUNT leg consumes nonce 0
      encodedTx.nonce = '0x1';
      if (params.deployOnly) {
        encodedTx.type = 'DEPLOY_ACCOUNT';
        encodedTx.nonce = '0x0';
      }
    }

    if (params.deployOnly && isDeployed) return encodedTx;

    // Price both legs now so the encodedTx is signable as it stands and the
    // deploy leg carries real bounds: IFeeStarknet can only round-trip the
    // invoke leg's bounds back through updateUnsignedTx.
    const estimates = await this._estimateLegs({ client, encodedTx });
    encodedTx.resourceBounds = estimates.invokeBounds;
    if (encodedTx.deployAccount && estimates.deployBounds) {
      encodedTx.deployAccount.resourceBounds = estimates.deployBounds;
    }

    return encodedTx;
  }

  private async _buildTransferCall(
    transferInfo: ITransferInfo,
  ): Promise<IStarknetCall> {
    const { from, to, amount, tokenInfo } = transferInfo;
    if (!from || !to) {
      throw new OneKeyInternalError({
        key: ETranslations.send_engine_incorrect_address,
      });
    }
    if (!tokenInfo) {
      throw new OneKeyInternalError({
        key: ETranslations.feedback_failed_to_parse_transaction,
      });
    }
    const baseUnits = new BigNumber(amount).shiftedBy(tokenInfo.decimals);
    if (!baseUnits.isInteger() || baseUnits.isNegative()) {
      throw new OneKeyInternalError({
        key: ETranslations.defi_action_invalid_amount__msg,
      });
    }
    return buildErc20TransferCall({
      tokenAddress: tokenInfo.address,
      to,
      amount: baseUnits.toFixed(),
    });
  }

  /**
   * Counterfactual deployment parameters for this account's own public key.
   * The recomputed address must equal the stored one, or the account was
   * created under different parameters and the deploy would fund a stranger.
   */
  // The OpenZeppelin and OKX derive types suffix their account ids; everything
  // else is the default Argent account
  override async getAddressEncoding(): Promise<EAddressEncodings | undefined> {
    const suffixed = [
      EAddressEncodings.STARKNET_OZ,
      EAddressEncodings.STARKNET_OKX,
    ];
    return suffixed.find((encoding) =>
      this.accountId.endsWith(`--${encoding}`),
    );
  }

  private async _getAccountDeployParams(expectedAddress: string) {
    const account = await this.getAccount();
    const publicKey = account.pub;
    if (!publicKey) {
      throw new OneKeyInternalError();
    }
    const addressEncoding = await this.getAddressEncoding();
    const { classHash, constructorCalldata, addressSalt, contractAddress } =
      sdkStarknet.getAccountDeployParams(
        publicKey,
        sdkStarknet.getAccountContractByEncoding(addressEncoding),
      );
    // compare padded on both sides: core returns spec felts with no leading
    // zeros in places, while the app stores addresses zero-padded
    if (
      normalizeStarknetAddress(contractAddress) !==
      normalizeStarknetAddress(expectedAddress)
    ) {
      throw new OneKeyInternalError({
        key: ETranslations.send_verification_failure,
      });
    }
    return { classHash, constructorCalldata, addressSalt };
  }

  /**
   * The same shape core signs, so the estimate prices the real transaction.
   * Felt encoding mirrors CoreChainSoftware.signTransaction: the app stores
   * addresses zero-padded and starknet.js emits decimal calldata, while the
   * RPC spec's FELT forbids both.
   */
  private _buildEstimateInvokeTx(
    encodedTx: IEncodedTxStarknet,
  ): IStarknetSignedInvoke {
    return {
      type: 'INVOKE',
      version: encodedTx.version,
      sender_address: sdkStarknet.toFelt(encodedTx.from),
      calldata: sdkStarknet.toFeltArray(
        sdkStarknet.buildExecuteCalldata(encodedTx.calls),
      ),
      signature: [...ZERO_SIGNATURE],
      nonce: sdkStarknet.toFelt(encodedTx.nonce),
      // zero bounds during estimation: the node ignores them for pricing, and
      // a funded bound would be charged to the deploy leg of a paired estimate
      resource_bounds: sdkStarknet.toRpcResourceBounds(zeroResourceBounds()),
      tip: sdkStarknet.toFelt(encodedTx.tip),
      paymaster_data: sdkStarknet.toFeltArray(encodedTx.paymasterData),
      account_deployment_data: sdkStarknet.toFeltArray(
        encodedTx.accountDeploymentData,
      ),
      nonce_data_availability_mode: encodedTx.nonceDataAvailabilityMode,
      fee_data_availability_mode: encodedTx.feeDataAvailabilityMode,
      // apply_actions reverts without its proof, so a privacy tx has to be
      // estimated with both halves present
      ...(encodedTx.privacy?.proofFacts.length
        ? { proof_facts: sdkStarknet.toFeltArray(encodedTx.privacy.proofFacts) }
        : {}),
    };
  }

  private _buildEstimateDeployAccountTx(
    encodedTx: IEncodedTxStarknet,
  ): IStarknetSignedDeployAccount | undefined {
    const { deployAccount } = encodedTx;
    if (!deployAccount) {
      return undefined;
    }
    return {
      type: 'DEPLOY_ACCOUNT',
      version: encodedTx.version,
      class_hash: sdkStarknet.toFelt(deployAccount.classHash),
      contract_address_salt: sdkStarknet.toFelt(deployAccount.addressSalt),
      constructor_calldata: sdkStarknet.toFeltArray(
        deployAccount.constructorCalldata,
      ),
      signature: [...ZERO_SIGNATURE],
      nonce: sdkStarknet.toFelt(deployAccount.nonce),
      resource_bounds: sdkStarknet.toRpcResourceBounds(zeroResourceBounds()),
      tip: sdkStarknet.toFelt(encodedTx.tip),
      paymaster_data: sdkStarknet.toFeltArray(encodedTx.paymasterData),
      nonce_data_availability_mode: encodedTx.nonceDataAvailabilityMode,
      fee_data_availability_mode: encodedTx.feeDataAvailabilityMode,
    };
  }

  /**
   * One starknet_estimateFee covering every leg. An undeployed sender cannot be
   * estimated on its own, so the deploy has to travel in the same array and the
   * invoke is priced against the state it leaves behind.
   */
  private async _estimateLegs({
    client,
    encodedTx,
  }: {
    client: ClientStarknet;
    encodedTx: IEncodedTxStarknet;
  }): Promise<IStarknetLegEstimates> {
    const deployment =
      encodedTx.deployAccount ??
      (encodedTx.deploymentDependency &&
      !(await client.isAccountDeployed(encodedTx.from))
        ? encodedTx.deploymentDependency
        : undefined);
    const deployTx = this._buildEstimateDeployAccountTx({
      ...encodedTx,
      deployAccount: deployment,
    });
    const invokeTx = this._buildEstimateInvokeTx(encodedTx);
    const broadcastInvokeTx: IStarknetBroadcastTx = encodedTx.privacy
      ? { ...invokeTx, proof: encodedTx.privacy.proof }
      : invokeTx;
    let transactions: IStarknetBroadcastTx[];
    if (encodedTx.type === 'DEPLOY_ACCOUNT') {
      transactions = [checkIsDefined(deployTx)];
    } else {
      transactions = deployTx
        ? [deployTx, broadcastInvokeTx]
        : [broadcastInvokeTx];
    }

    const estimates = await client.estimateFee(
      transactions,
      encodedTx.deployAccount ? 'latest' : undefined,
    );
    if (estimates.length !== transactions.length) {
      throw new FailedToEstimatedGasError();
    }
    const invokeEstimate = estimates[estimates.length - 1];
    const deployEstimate: IStarknetFeeEstimate | undefined = deployTx
      ? estimates[0]
      : undefined;

    return {
      invokeBounds: toResourceBounds(invokeEstimate),
      invokeEstimate,
      deployBounds: deployEstimate
        ? toResourceBounds(deployEstimate)
        : undefined,
      invokeOverallFee: hexToDecimalString(invokeEstimate.overall_fee),
      deployOverallFee: deployEstimate
        ? hexToDecimalString(deployEstimate.overall_fee)
        : undefined,
    };
  }

  override async buildUnsignedTx(
    params: IBuildUnsignedTxParams,
  ): Promise<IUnsignedTxPro> {
    const privacyTransfer = params.transfersInfo?.find(
      (item) => item.starknetPrivacyKind,
    );
    if (
      privacyTransfer?.starknetPrivacyKind &&
      params.encodedTx &&
      (params.encodedTx as IEncodedTxStarknet).privacy?.kind !==
        privacyTransfer.starknetPrivacyKind
    ) {
      throw new OneKeyInternalError({
        key: ETranslations.feedback_failed_to_parse_transaction,
      });
    }
    if (!params.encodedTx && privacyTransfer?.starknetPrivacyKind) {
      const { amount, tokenInfo, to, starknetPrivacyKind } = privacyTransfer;
      if (
        !tokenInfo ||
        (!tokenInfo.address && !tokenInfo.isNative) ||
        params.transfersInfo?.length !== 1
      ) {
        throw new OneKeyInternalError({
          key: ETranslations.feedback_failed_to_parse_transaction,
        });
      }
      const amountBase = new BigNumber(amount).shiftedBy(tokenInfo.decimals);
      if (!amountBase.isInteger() || !amountBase.isPositive()) {
        throw new OneKeyInternalError({
          key: ETranslations.defi_action_invalid_amount__msg,
        });
      }
      try {
        const { unsignedTx } =
          await this.backgroundApi.serviceStarknetPrivacy.buildPrivateTransferTx(
            {
              networkId: this.networkId,
              accountId: this.accountId,
              kind: starknetPrivacyKind,
              tokenAddress: tokenInfo.address || STRK_TOKEN_ADDRESS,
              amount: amountBase.toFixed(),
              recipient: to,
            },
          );
        return { ...unsignedTx, transfersInfo: params.transfersInfo };
      } catch (error) {
        if (error instanceof OneKeyError) throw error;
        const { code, translationKey } = mapStrk20Error(error);
        throw new OneKeyLocalError({
          key: translationKey,
          message: appLocale.intl.formatMessage({ id: translationKey }),
          data: { starknetPrivacyErrorCode: code },
        });
      }
    }
    const encodedTx = (params.encodedTx ??
      (await this.buildEncodedTx(params))) as IEncodedTxStarknet | undefined;
    if (!encodedTx) {
      throw new OneKeyInternalError({
        key: ETranslations.feedback_failed_to_parse_transaction,
      });
    }
    const unsignedTx: IUnsignedTxPro =
      params.unsignedTx ??
      ({
        encodedTx,
        transfersInfo: params.transfersInfo ?? [],
      } as IUnsignedTxPro);

    unsignedTx.encodedTx = encodedTx;
    unsignedTx.transfersInfo = params.transfersInfo ?? [];
    return unsignedTx;
  }

  override async updateUnsignedTx(
    params: IUpdateUnsignedTxParams,
  ): Promise<IUnsignedTxPro> {
    const { unsignedTx, nativeAmountInfo, feeInfo } = params;
    let encodedTx = unsignedTx.encodedTx as IEncodedTxStarknet;

    if (
      nativeAmountInfo &&
      !encodedTx.privacy &&
      unsignedTx.transfersInfo?.length
    ) {
      const newAmount =
        nativeAmountInfo.maxSendAmount ?? nativeAmountInfo.amount;
      if (newAmount) {
        const transfersInfo = [
          { ...unsignedTx.transfersInfo[0], amount: newAmount },
        ];
        const rebuilt = await this.buildEncodedTx({ transfersInfo });
        encodedTx = encodedTx.deploymentDependency
          ? {
              ...rebuilt,
              deployAccount: undefined,
              deploymentDependency:
                rebuilt.deployAccount ?? encodedTx.deploymentDependency,
            }
          : rebuilt;
        unsignedTx.transfersInfo = transfersInfo;
      }
    }

    // Each batch item updates its own bounds. A legacy combined payload keeps
    // the deployment bounds that buildEncodedTx already padded.
    const feeStarknet = feeInfo?.feeStarknet;
    if (feeStarknet) {
      const toBound = (bound: IFeeStarknetResourceBound) => ({
        max_amount: toHexFelt(bound.maxAmount),
        max_price_per_unit: toHexFelt(bound.maxPricePerUnit),
      });
      encodedTx = {
        ...encodedTx,
        resourceBounds: {
          l1_gas: toBound(feeStarknet.l1Gas),
          l2_gas: toBound(feeStarknet.l2Gas),
          l1_data_gas: toBound(feeStarknet.l1DataGas),
        },
      };
      if (encodedTx.type === 'DEPLOY_ACCOUNT') {
        encodedTx.deployAccount = {
          ...checkIsDefined(encodedTx.deployAccount),
          resourceBounds: encodedTx.resourceBounds,
        };
      }
    }

    unsignedTx.encodedTx = encodedTx;
    return unsignedTx;
  }

  override async prepareSendConfirmation(
    unsignedTxs: IUnsignedTxPro[],
    confirmPrerequisites: boolean,
  ): Promise<ISendConfirmationPreparation> {
    const prepared = { unsignedTxs: this.splitAccountDeployment(unsignedTxs) };
    const encodedTx = unsignedTxs[0]?.encodedTx as
      | IEncodedTxStarknet
      | undefined;
    const transfersInfo = unsignedTxs[0]?.transfersInfo;
    if (
      !confirmPrerequisites ||
      unsignedTxs.length !== 1 ||
      !transfersInfo?.length ||
      !encodedTx?.deployAccount ||
      encodedTx.type === 'DEPLOY_ACCOUNT'
    )
      return prepared;

    const [deployment, transfer] = prepared.unsignedTxs;
    const { status, txid } = await this.getAccountDeploymentProgress();
    return {
      unsignedTxs: [transfer],
      prerequisite:
        status === EOnChainHistoryTxStatus.Success
          ? { transfersInfo }
          : {
              transfersInfo,
              unsignedTx: txid ? undefined : deployment,
              pendingTxid: txid,
            },
    };
  }

  override async getSendPrerequisiteProgress(txid: string) {
    return this.getAccountDeploymentProgress(txid);
  }

  private splitAccountDeployment(
    unsignedTxs: IUnsignedTxPro[],
  ): IUnsignedTxPro[] {
    return unsignedTxs.flatMap((unsignedTx) => {
      const encodedTx = unsignedTx.encodedTx as IEncodedTxStarknet;
      if (encodedTx.type === 'DEPLOY_ACCOUNT' || !encodedTx.deployAccount) {
        return [unsignedTx];
      }
      const deployment = encodedTx.deployAccount;
      return [
        {
          ...unsignedTx,
          uuid: generateUUID(),
          transfersInfo: undefined,
          approveInfo: undefined,
          swapInfo: undefined,
          stakingInfo: undefined,
          feeInfo: undefined,
          encodedTx: {
            ...encodedTx,
            type: 'DEPLOY_ACCOUNT',
            nonce: deployment.nonce,
            resourceBounds: deployment.resourceBounds,
            calls: [],
            privacy: undefined,
          } satisfies IEncodedTxStarknet,
        },
        {
          ...unsignedTx,
          feeInfo: undefined,
          encodedTx: {
            ...encodedTx,
            deployAccount: undefined,
            deploymentDependency: deployment,
          } satisfies IEncodedTxStarknet,
        },
      ];
    });
  }

  override async buildDecodedTx(
    params: IBuildDecodedTxParams,
  ): Promise<IDecodedTx> {
    const { unsignedTx } = params;
    const encodedTx = unsignedTx.encodedTx as IEncodedTxStarknet;
    if (!encodedTx) {
      throw new OneKeyInternalError({
        key: ETranslations.feedback_failed_to_parse_transaction,
      });
    }

    const [accountAddress, network] = await Promise.all([
      this.getAccountAddress(),
      this.getNetwork(),
    ]);

    // A privacy tx's calldata is a compile_actions blob, not ERC-20 transfers,
    // so it is rendered from the intent that built it rather than decoded.
    const isDeployment = encodedTx.type === 'DEPLOY_ACCOUNT';
    let action: IDecodedTxAction;
    if (isDeployment) {
      action = {
        type: EDecodedTxActionType.FUNCTION_CALL,
        functionCall: {
          from: encodedTx.from,
          to: encodedTx.from,
          functionName: appLocale.intl.formatMessage({
            id: ETranslationsMock.starknet_account_activation_one_time,
          }),
          args: [],
        },
      };
    } else {
      action = encodedTx.privacy
        ? await this._buildPrivacyAction(encodedTx, encodedTx.privacy)
        : await this._buildTransferAction(encodedTx);
    }

    const invokeFee = sumResourceBounds(encodedTx.resourceBounds);
    const deployFee =
      encodedTx.deployAccount && !isDeployment
        ? sumResourceBounds(encodedTx.deployAccount.resourceBounds)
        : undefined;
    const totalFeeInNative = new BigNumber(invokeFee)
      .plus(deployFee ?? 0)
      .shiftedBy(-network.feeMeta.decimals)
      .toFixed();

    // Both halves are optional and independent, so build the object and only
    // fall back to null when nothing needs carrying.
    const extra: IDecodedTxExtraStarknet = isDeployment
      ? { accountDeployment: true }
      : {};
    if (deployFee) {
      extra.deployAccountFee = deployFee;
      extra.deployAccountTxId = this._computeDeployAccountTxId(encodedTx);
    }
    if (encodedTx.privacy) {
      const {
        kind,
        poolAddress,
        tokenAddress,
        amount,
        recipient,
        protocolFee,
        warnings,
      } = encodedTx.privacy;
      extra.privacy = {
        kind,
        poolAddress: normalizeStarknetAddress(poolAddress),
        ...(tokenAddress
          ? { tokenAddress: normalizeTokenAddress(tokenAddress) }
          : {}),
        ...(amount ? { amount } : {}),
        ...(recipient
          ? { recipient: normalizeStarknetAddress(recipient) }
          : {}),
        ...(protocolFee ? { protocolFee } : {}),
        ...(warnings?.length ? { warnings } : {}),
      };
    }
    const extraInfo: IDecodedTxExtraStarknet | null =
      Object.keys(extra).length > 0 ? extra : null;

    const decodedTx: IDecodedTx = {
      txid: '',
      owner: accountAddress,
      signer: encodedTx.from,
      nonce: Number(BigInt(encodedTx.nonce)),
      actions: [action],
      status: EDecodedTxStatus.Pending,
      networkId: this.networkId,
      accountId: this.accountId,
      extraInfo,
      encodedTx,
      totalFeeInNative,
      ...(isDeployment ? { nativeAmount: '0', isFeeOnly: true } : {}),
      ...(encodedTx.privacy
        ? {
            // The standard fee check spends public STRK, not private principal.
            nativeAmount: new BigNumber(encodedTx.privacy.protocolFee ?? 0)
              .plus(
                encodedTx.privacy.kind === 'deposit' &&
                  encodedTx.privacy.tokenAddress &&
                  BigInt(encodedTx.privacy.tokenAddress) ===
                    BigInt(STRK_TOKEN_ADDRESS)
                  ? (encodedTx.privacy.amount ?? 0)
                  : 0,
              )
              .shiftedBy(-network.feeMeta.decimals)
              .toFixed(),
          }
        : {}),
    };
    const privacyKind = encodedTx.privacy?.kind;
    const titleId = isDeployment
      ? ETranslationsMock.starknet_account_activation_one_time
      : privacyKind && starknetPrivacyOperationTitles[privacyKind];
    if (titleId) {
      const operationTitle = appLocale.intl.formatMessage({
        id: titleId,
        defaultMessage: titleId,
      });
      const typeComponent: IDisplayComponent = {
        type: EParseTxComponentType.Default,
        label: appLocale.intl.formatMessage({
          id: ETranslations.dexmarket_details_history_type,
        }),
        value: operationTitle,
      };
      let components =
        convertDecodedTxActionsToSignatureConfirmTxDisplayComponents({
          decodedTx,
          unsignedTx,
        }).filter(
          (component) =>
            !(
              component.type === EParseTxComponentType.Default &&
              component.label === 'Operation'
            ),
        );
      if (privacyKind === 'deposit' || privacyKind === 'withdraw') {
        const publicSide = appLocale.intl.formatMessage({
          id: ETranslations.privacy_balance_public__title,
        });
        const privateSide = appLocale.intl.formatMessage({
          id: ETranslations.privacy_history_shielded__title,
        });
        const direction: IDisplayComponent[] = [
          {
            type: EParseTxComponentType.Default,
            label: appLocale.intl.formatMessage({
              id: ETranslations.global_from,
            }),
            value: privacyKind === 'deposit' ? publicSide : privateSide,
          },
          {
            type: EParseTxComponentType.Default,
            label: appLocale.intl.formatMessage({
              id: ETranslations.global_to,
            }),
            value: privacyKind === 'deposit' ? privateSide : publicSide,
          },
        ];
        components = [
          typeComponent,
          ...direction,
          ...components.filter(
            (component) => component.type !== EParseTxComponentType.Address,
          ),
        ];
      } else {
        components = [typeComponent, ...components];
      }
      decodedTx.isLocalParsed = true;
      decodedTx.txDisplay = {
        title: operationTitle,
        components,
        alerts: [],
      };
    }
    return decodedTx;
  }

  private async _buildTransferAction(
    encodedTx: IEncodedTxStarknet,
  ): Promise<IDecodedTxAction> {
    if (
      encodedTx.calls.length === 0 ||
      encodedTx.calls.some(
        (call) =>
          call.entrypoint !== ERC20_ENTRYPOINT.transfer ||
          call.calldata.length !== 3,
      )
    ) {
      return {
        type: EDecodedTxActionType.UNKNOWN,
        unknownAction: {
          from: encodedTx.from,
          to:
            encodedTx.calls.length === 1
              ? encodedTx.calls[0].contractAddress
              : '',
        },
      };
    }
    const transfers = await this._buildTransfersFromCalls(encodedTx);
    return this.buildTxTransferAssetAction({
      from: encodedTx.from,
      to: transfers[0]?.to ?? '',
      transfers,
    });
  }

  /**
   * register has no asset movement; the other three do, and the counterparty is
   * the pool on a deposit and on a withdraw's shielded leg.
   */
  private async _buildPrivacyAction(
    encodedTx: IEncodedTxStarknet,
    privacy: IEncodedTxStarknetPrivacy,
  ): Promise<IDecodedTxAction> {
    if (privacy.kind === 'register') {
      return {
        type: EDecodedTxActionType.FUNCTION_CALL,
        functionCall: {
          from: encodedTx.from,
          to: normalizeStarknetAddress(privacy.poolAddress),
          functionName: appLocale.intl.formatMessage({
            id: ETranslations.privacy_enable__title,
          }),
          args: [],
        },
      };
    }
    if (!privacy.tokenAddress || !privacy.amount) {
      return {
        type: EDecodedTxActionType.UNKNOWN,
        unknownAction: {
          from: encodedTx.from,
          to: normalizeStarknetAddress(privacy.poolAddress),
          label: privacy.kind,
        },
      };
    }

    const tokenAddress = normalizeTokenAddress(privacy.tokenAddress);
    const token = await this._getTokenMetadataCache(tokenAddress);
    const pool = normalizeStarknetAddress(privacy.poolAddress);
    const defaultRecipient =
      privacy.kind === 'withdraw' ? encodedTx.from : pool;
    const counterparty = privacy.recipient
      ? normalizeStarknetAddress(privacy.recipient)
      : defaultRecipient;
    const from = privacy.kind === 'withdraw' ? pool : encodedTx.from;
    const to = privacy.kind === 'deposit' ? pool : counterparty;

    const action = await this.buildTxTransferAssetAction({
      from,
      to,
      transfers: [
        {
          from,
          to,
          amount: new BigNumber(privacy.amount)
            .shiftedBy(-token.decimals)
            .toFixed(),
          tokenIdOnNetwork: tokenAddress,
          icon: token.logoURI,
          name: token.name,
          symbol: token.symbol,
          isNFT: false,
          isNative: token.isNative,
        },
      ],
    });
    if (action.assetTransfer) {
      action.assetTransfer.label = appLocale.intl.formatMessage({
        id: starknetPrivacyOperationTitles[privacy.kind],
      });
    }
    return action;
  }

  private async _buildTransfersFromCalls(
    encodedTx: IEncodedTxStarknet,
  ): Promise<IDecodedTxTransferInfo[]> {
    return Promise.all(
      encodedTx.calls.map(async (call) => {
        const tokenAddress = normalizeTokenAddress(call.contractAddress);
        const token = await this._getTokenMetadataCache(tokenAddress);
        const [to, low, high] = call.calldata;
        return {
          from: encodedTx.from,
          to: normalizeStarknetAddress(to),
          amount: new BigNumber(u256ToDecimalString(low, high))
            .shiftedBy(-token.decimals)
            .toFixed(),
          tokenIdOnNetwork: tokenAddress,
          icon: token.logoURI,
          name: token.name,
          symbol: token.symbol,
          isNFT: false,
          isNative: token.isNative,
        };
      }),
    );
  }

  /**
   * The DEPLOY_ACCOUNT hash is a pure function of the encodedTx, so recompute it
   * rather than carrying it back from broadcast: buildDecodedTx runs after the
   * broadcast but receives the unsigned tx, and the vault instance that did the
   * broadcasting is not guaranteed to still be the cached one. Same inputs as
   * CoreChainSoftware.signTransaction, so the value matches what is broadcast.
   */
  private _computeDeployAccountTxId(
    encodedTx: IEncodedTxStarknet,
  ): string | undefined {
    const { deployAccount } = encodedTx;
    if (!deployAccount) {
      return undefined;
    }
    return sdkStarknet.calculateDeployAccountTxHash({
      contractAddress: encodedTx.from,
      classHash: deployAccount.classHash,
      constructorCalldata: deployAccount.constructorCalldata,
      addressSalt: deployAccount.addressSalt,
      version: encodedTx.version,
      chainId: encodedTx.chainId,
      nonce: deployAccount.nonce,
      nonceDataAvailabilityMode: encodedTx.nonceDataAvailabilityMode,
      feeDataAvailabilityMode: encodedTx.feeDataAvailabilityMode,
      resourceBounds: deployAccount.resourceBounds,
      tip: encodedTx.tip,
      paymasterData: encodedTx.paymasterData,
    });
  }

  // Account reads still use RPC. Preset-network token lists and details use
  // VaultBase's API path; the RPC implementations below serve custom networks.

  override async fetchAccountDetails(
    params: IFetchServerAccountDetailsParams,
  ): Promise<IFetchServerAccountDetailsResponse> {
    const [client, network] = await Promise.all([
      this.getClient(),
      this.getNetwork(),
    ]);
    const accountAddress = normalizeStarknetAddress(params.accountAddress);
    const networkInfo = await this.getNetworkInfo();
    const [[low, high], nonceFelt] = await Promise.all([
      client.getTokenBalance({
        tokenAddress: networkInfo.nativeTokenAddress ?? STRK_TOKEN_ADDRESS,
        accountAddress,
      }),
      params.withNonce
        ? client.getNonce(accountAddress).catch((error: unknown) => {
            if (
              parseRpcErrorCode(error) ===
              EStarknetRpcErrorCode.ContractNotFound
            )
              return '0x0';
            throw error;
          })
        : undefined,
    ]);
    const nonce =
      nonceFelt === undefined ? undefined : Number(BigInt(nonceFelt));
    const balance = u256ToDecimalString(low, high);

    return {
      data: {
        data: {
          address: params.accountAddress,
          nonce: Number.isSafeInteger(nonce) ? nonce : undefined,
          balance,
          balanceParsed: new BigNumber(balance)
            .shiftedBy(-network.decimals)
            .toFixed(),
        },
      },
    };
  }

  override async fetchTokenDetailsByRpc(
    params: IFetchServerTokenDetailParams,
  ): Promise<IFetchServerTokenDetailResponse> {
    const items = await this._fetchTokenItems({
      accountAddress: params.accountAddress ?? '',
      contractList: params.contractList?.length
        ? params.contractList
        : this._getPresetTokens().map((token) => token.address),
      throwOnTokenError: true,
    });

    const data: IFetchTokenDetailItem[] = items.map((item) => ({
      info: {
        decimals: item.info?.decimals ?? 0,
        name: item.info?.name ?? '',
        symbol: item.info?.symbol ?? '',
        address: item.info?.address ?? '',
        logoURI: item.info?.logoURI ?? '',
        networkId: this.networkId,
        isNative: item.info?.isNative ?? false,
      },
      balance: item.balance,
      balanceParsed: item.balanceParsed,
      fiatValue: '0',
      price: 0,
    }));

    return { data: { data } };
  }

  override async fetchTokenListByRpc(
    params: IFetchServerTokenListParams,
  ): Promise<IFetchServerTokenListResponse> {
    const { requestApiParams } = params;
    const accountTokenArray = await this._fetchTokenItems({
      accountAddress: requestApiParams.accountAddress ?? '',
      contractList: [
        ...this._getPresetTokens().map((token) => token.address),
        ...(requestApiParams.contractList ?? []),
      ],
      throwOnTokenError: false,
    });

    const hiddenTokenSet = new Set(requestApiParams.hiddenTokens ?? []);
    const sorted = orderBy(
      accountTokenArray,
      [(item) => item.info?.isNative, (item) => +(item.balanceParsed ?? 0)],
      ['desc', 'desc'],
    ).filter((item) => !hiddenTokenSet.has(item.info?.address ?? ''));

    return {
      data: {
        data: {
          tokens: this._parseAccountTokenArray(requestApiParams, sorted),
          riskTokens: this._parseAccountTokenArray(requestApiParams, []),
          smallBalanceTokens: this._parseAccountTokenArray(
            requestApiParams,
            [],
          ),
        },
      },
    };
  }

  /**
   * Custom networks read token metadata from the contract once and keep it.
   *
   * Deliberately not serviceToken.getToken: for a token it does not know yet,
   * that routes into serviceToken.fetchTokensDetails, which calls back into
   * this vault's fetchTokenDetailsByRpc and would loop.
   */
  private _getPresetTokens() {
    return STARKNET_PRESET_TOKENS[this.networkId] ?? [];
  }

  private _getTokenMetadataCache = memoizee(
    async (tokenAddress: string) => {
      const [client, network, networkInfo] = await Promise.all([
        this.getClient(),
        this.getNetwork(),
        this.getNetworkInfo(),
      ]);
      // padded on both sides: felts reach this cache from RPC results and from
      // settings, which write them in different forms
      const isNative =
        normalizeTokenAddress(tokenAddress) ===
        normalizeTokenAddress(networkInfo.nativeTokenAddress ?? '');
      if (isNative) {
        return {
          name: network.shortname,
          symbol: network.symbol,
          decimals: network.decimals,
          logoURI: network.logoURI ?? '',
          isNative: true,
        };
      }
      const preset = this._getPresetTokens().find(
        (token) =>
          normalizeTokenAddress(token.address) ===
          normalizeTokenAddress(tokenAddress),
      );
      if (preset) {
        return {
          name: preset.name,
          symbol: preset.symbol,
          decimals: preset.decimals,
          logoURI: '',
          isNative: false,
        };
      }
      const metadata = await client.getTokenMetadata(tokenAddress);
      return { ...metadata, logoURI: '', isNative: false };
    },
    {
      promise: true,
      maxAge: timerUtils.getTimeDurationMs({ hour: 1 }),
      normalizer: ([tokenAddress]) => `${this.networkId}-${tokenAddress}`,
    },
  );

  /**
   * Every Starknet asset including STRK is an ERC-20, so one balanceOf per
   * contract covers the native entry and every token alike. Custom-network
   * RPC responses have no backend pricing.
   */
  private async _fetchTokenItems({
    accountAddress,
    contractList,
    throwOnTokenError,
  }: {
    accountAddress: string;
    contractList: string[];
    // the add-custom-token form needs a bogus contract to fail loudly; the
    // portfolio list must not lose every balance over one bad entry
    throwOnTokenError: boolean;
  }): Promise<IServerAccountTokenItem[]> {
    const client = await this.getClient();

    const normalizedAddresses: string[] = [];
    for (const address of contractList) {
      try {
        normalizedAddresses.push(
          normalizeTokenAddress(address || STRK_TOKEN_ADDRESS),
        );
      } catch (error) {
        if (throwOnTokenError) throw error;
        defaultLogger.app.error.log(
          `Starknet token address skipped: ${address}: ${String(error)}`,
        );
      }
    }
    const addresses = [...new Set(normalizedAddresses)];

    const normalizedAccountAddress = accountAddress
      ? normalizeStarknetAddress(accountAddress)
      : '';

    const buildItem = async (tokenAddress: string) => {
      const metadata = await this._getTokenMetadataCache(tokenAddress);

      let balance = '0';
      if (normalizedAccountAddress) {
        const [low, high] = await client.getTokenBalance({
          tokenAddress,
          accountAddress: normalizedAccountAddress,
        });
        balance = u256ToDecimalString(low, high);
      }

      return {
        info: {
          decimals: metadata.decimals,
          name: metadata.name,
          symbol: metadata.symbol,
          address: tokenAddress,
          logoURI: metadata.logoURI,
          isNative: metadata.isNative,
        },
        balance,
        balanceParsed: new BigNumber(balance)
          .shiftedBy(-metadata.decimals)
          .toFixed(),
        fiatValue: '0',
        price: '0',
        price24h: 0,
      } as IServerAccountTokenItem;
    };

    if (throwOnTokenError) {
      return Promise.all(addresses.map(buildItem));
    }

    const settled = await Promise.allSettled(addresses.map(buildItem));
    return settled.flatMap((result, index) => {
      if (result.status === 'fulfilled') {
        return [result.value];
      }
      defaultLogger.app.error.log(
        `Starknet token read failed for ${addresses[index]}: ${String(
          result.reason,
        )}`,
      );
      return [];
    });
  }

  private _parseAccountTokenArray(
    { networkId, accountAddress }: IFetchServerTokenListApiParams,
    accountTokenArray: IServerAccountTokenItem[],
  ): ITokenData {
    const map: Record<string, ITokenFiat> = {};
    const data: IAccountToken[] = [];

    accountTokenArray.forEach((accountToken) => {
      const key = `${networkId}_${accountAddress}_${
        accountToken.info?.uniqueKey ?? accountToken?.info?.address ?? ''
      }`;
      map[key] = {
        price: 0,
        price24h: 0,
        balance: accountToken.balance,
        balanceParsed: accountToken.balanceParsed,
        fiatValue: '0',
      };
      data.push({ $key: key, ...accountToken?.info } as IAccountToken);
    });

    return {
      map,
      data: orderBy(data, [(item) => item.isNative], ['desc']),
      keys: md5(
        `${networkId}__${
          isEmpty(map) ? '' : Object.keys(map).join(',')
        }__${stringUtils.stableStringify(data)}`,
      ),
      fiatValue: undefined,
    };
  }

  override async estimateFee(
    params: IEstimateGasParams,
  ): Promise<IServerEstimateFeeResponse> {
    const encodedTx = params.encodedTx as IEncodedTxStarknet | undefined;
    if (!encodedTx) {
      throw new FailedToEstimatedGasError();
    }
    const [client, network] = await Promise.all([
      this.getClient(),
      this.getNetwork(),
    ]);
    const [
      { invokeBounds, invokeEstimate, invokeOverallFee, deployOverallFee },
      quote,
    ] = await Promise.all([
      this._estimateLegs({ client, encodedTx }),
      fetchLocalWalletNativeTokenQuote({
        backgroundApi: this.backgroundApi,
        networkId: this.networkId,
      }),
    ]);

    const feeStarknet: IFeeStarknet = {
      ...resourceBoundsToFee(invokeBounds, invokeEstimate),
      // the deploy leg keeps its own line; overallFee covers the invoke only
      overallFee: invokeOverallFee,
      // charged from the same balance and signed as part of the same send, so
      // it belongs in the headline total rather than a separate extra fee
      ...(encodedTx.deployAccount && encodedTx.type !== 'DEPLOY_ACCOUNT'
        ? {
            deployAccountFee: sumResourceBounds(
              encodedTx.deployAccount.resourceBounds,
            ),
            deployAccountOverallFee: deployOverallFee,
          }
        : {}),
    };

    return {
      data: {
        data: {
          isEIP1559: false,
          feeDecimals: network.feeMeta.decimals,
          feeSymbol: network.feeMeta.symbol,
          nativeDecimals: network.decimals,
          nativeSymbol: network.symbol,
          baseFee: '0',
          nativeTokenPrice:
            quote.price === undefined
              ? undefined
              : { price: quote.price, price24h: quote.price24h ?? 0 },
          feeStarknet: [feeStarknet],
        },
      },
    };
  }

  /**
   * Legacy combined sends were recorded as one row keyed by the INVOKE. Only
   * those rows carry a paired deploy hash; new batch items have separate fees.
   * Return FRI as a decimal string, or undefined while its receipt is unknown.
   */
  private async _fetchPairedDeployFee({
    client,
    localTx,
  }: {
    client: ClientStarknet;
    localTx: IAccountHistoryTx | undefined;
  }): Promise<string | undefined> {
    const extraInfo = localTx?.decodedTx.extraInfo as
      | IDecodedTxExtraStarknet
      | undefined;
    if (!extraInfo?.deployAccountTxId) {
      return '0';
    }
    const deployReceipt = await client
      .getTransactionReceipt(extraInfo.deployAccountTxId)
      .catch(() => undefined);
    return deployReceipt?.actual_fee?.unit === 'FRI'
      ? hexToDecimalString(deployReceipt.actual_fee.amount)
      : undefined;
  }

  private async _fetchProtocolFeeInNative({
    client,
    localTx,
    receipt,
  }: {
    client: ClientStarknet;
    localTx: IAccountHistoryTx | undefined;
    receipt: IStarknetReceipt | null;
  }): Promise<string | undefined> {
    const privacy = (
      localTx?.decodedTx.extraInfo as IDecodedTxExtraStarknet | undefined
    )?.privacy;
    if (!privacy || !receipt) return undefined;
    const status = getReceiptTxStatus(receipt);
    if (status === EOnChainHistoryTxStatus.Failed) return '0';
    if (
      status !== EOnChainHistoryTxStatus.Success ||
      receipt.block_number === undefined ||
      !receipt.events
    )
      return undefined;
    try {
      const blockId = { block_number: receipt.block_number };
      const [collector, fee, network] = await Promise.all([
        client.getPoolFeeCollector(privacy.poolAddress, blockId),
        client.getPoolFeeAmount(privacy.poolAddress, blockId),
        this.getNetwork(),
      ]);
      const payer = localTx?.decodedTx.owner;
      if (!payer) return undefined;
      const selector = sdkStarknet.buildExecuteCalldata([
        {
          contractAddress: STRK_TOKEN_ADDRESS,
          entrypoint: 'Transfer',
          calldata: [],
        },
      ])[2];
      const payments: (string | undefined)[] = [];
      receipt.events.forEach((event) => {
        if (
          BigInt(event.from_address) !== BigInt(STRK_TOKEN_ADDRESS) ||
          !event.keys[0] ||
          BigInt(event.keys[0]) !== BigInt(selector)
        )
          return;
        let from: string;
        let to: string;
        let low: string;
        let high: string;
        if (event.keys.length === 1 && event.data.length === 4) {
          [from, to, low, high] = event.data;
        } else if (event.keys.length === 3 && event.data.length === 2) {
          [, from, to] = event.keys;
          [low, high] = event.data;
        } else {
          payments.push(undefined);
          return;
        }
        if (BigInt(from) !== BigInt(payer) || BigInt(to) !== BigInt(collector))
          return;
        if (
          [low, high].some(
            (limb) => BigInt(limb) < 0n || BigInt(limb) >= 2n ** 128n,
          )
        ) {
          payments.push(undefined);
          return;
        }
        payments.push(u256ToDecimalString(low, high));
      });
      // An end-of-block collector/fee change or ambiguous payment stays unknown.
      if (fee === '0' && payments.length === 0) return '0';
      return payments.length === 1 && payments[0] === fee
        ? new BigNumber(payments[0])
            .shiftedBy(-network.feeMeta.decimals)
            .toFixed()
        : undefined;
    } catch {
      // Receipt status and network fee remain usable if an archive call fails.
      return undefined;
    }
  }

  override async fetchAccountHistoryDetail(
    params: IServerFetchAccountHistoryDetailParams,
  ): Promise<IServerFetchAccountHistoryDetailResp> {
    const client = await this.getClient();
    const network = await this.getNetwork();
    const receipt = await client.getTransactionReceipt(params.txid);
    const status = getReceiptTxStatus(receipt);

    const invokeFee =
      receipt?.actual_fee?.unit === 'FRI'
        ? hexToDecimalString(receipt.actual_fee.amount)
        : undefined;
    const localTx = params.accountAddress
      ? await this.backgroundApi.simpleDb.localHistory.getLocalHistoryTxById({
          networkId: this.networkId,
          accountAddress: params.accountAddress,
          historyId: accountUtils.buildLocalHistoryId({
            networkId: this.networkId,
            accountAddress: params.accountAddress,
            txid: params.txid,
          }),
        })
      : undefined;
    const deployFee = await this._fetchPairedDeployFee({ client, localTx });
    const gasFee =
      invokeFee !== undefined && deployFee !== undefined
        ? new BigNumber(invokeFee)
            .plus(deployFee)
            .shiftedBy(-network.feeMeta.decimals)
            .toFixed()
        : undefined;

    // A confirmed local send can affect the next proof. Opening a received
    // transaction must not change the current account's proving window.
    if (
      localTx?.decodedTx.signer &&
      params.accountAddress &&
      normalizeStarknetAddress(localTx.decodedTx.signer) ===
        normalizeStarknetAddress(params.accountAddress) &&
      receipt?.block_number !== undefined &&
      status === EOnChainHistoryTxStatus.Success
    ) {
      await this.backgroundApi.serviceStarknetPrivacy
        .noteAccountTouchedByTx({
          networkId: this.networkId,
          accountId: this.accountId,
          blockNumber: receipt.block_number,
        })
        .catch(() => undefined);
    }

    return {
      data: {
        data: {
          data: {
            key: params.txid,
            networkId: this.networkId,
            tx: params.txid,
            riskLevel: 0,
            type: EOnChainHistoryTxType.Send,
            sends: [],
            receives: [],
            status,
            from: params.accountAddress ?? '',
            to: '',
            timestamp:
              receipt?.block_number === undefined
                ? 0
                : ((await client.getBlockTimestamp(receipt.block_number)) ?? 0),
            nonce: undefined,
            gasFee,
            protocolFeeInNative: await this._fetchProtocolFeeInNative({
              client,
              localTx,
              receipt,
            }),
            functionCode: '',
            params: [],
            value: '0',
            label: '',
            block: receipt?.block_number,
          },
          tokens: {},
          nfts: {},
        },
      },
    };
  }

  // ---------------------------------------------------------------- broadcast

  override async broadcastTransaction(
    params: IBroadcastTransactionParams,
  ): Promise<ISignedTxPro> {
    const client = params.useDefaultRpc
      ? await this._getClientCache('')
      : await this.getClient();
    return this._broadcast({ client, signedTx: params.signedTx });
  }

  override async broadcastTransactionFromCustomRpc(
    params: IBroadcastTransactionByCustomRpcParams,
  ): Promise<ISignedTxPro> {
    const rpcUrl = params.customRpcInfo.rpc;
    if (!rpcUrl) {
      throw new OneKeyInternalError({
        key: ETranslations.form_custom_rpc_error_invalid,
      });
    }
    const client = new ClientStarknet({
      networkId: this.networkId,
      backgroundApi: this.backgroundApi,
      customRpcUrl: rpcUrl,
    });
    return this._broadcast({ client, signedTx: params.signedTx });
  }

  /**
   * DEPLOY_ACCOUNT first, then INVOKE. The two are separate transactions and
   * the sequence is not atomic: if the deploy lands and the invoke does not,
   * the next attempt re-detects the deployed account and reads its nonce.
   */
  private async _broadcast({
    client,
    signedTx,
  }: {
    client: ClientStarknet;
    signedTx: ISignedTxPro;
  }): Promise<ISignedTxPro> {
    const rawTx = JSON.parse(signedTx.rawTx) as
      | IStarknetRawTx
      | IStarknetRawDeployAccountTx;
    if ('type' in rawTx) {
      this._assertBroadcastHash(signedTx.txid, rawTx.deployAccountTxHash);
      const result = await client.addDeployAccountTransaction(
        rawTx.deployAccount,
      );
      this._assertBroadcastHash(result.transaction_hash, signedTx.txid);
      await this._notePrivacySubmitted({
        encodedTx: signedTx.encodedTx as IEncodedTxStarknet | undefined,
        txid: signedTx.txid,
      });
      return signedTx;
    }
    this._assertBroadcastHash(signedTx.txid, rawTx.invokeTxHash);
    this._assertPrivacyBuildIsFresh(
      signedTx.encodedTx as IEncodedTxStarknet | undefined,
    );
    const privacy = (signedTx.encodedTx as IEncodedTxStarknet | undefined)
      ?.privacy;
    const submitBroadcast = async (): Promise<ISignedTxPro> => {
      let deployAccountTxId: string | undefined;
      if (rawTx.deployAccount) {
        const expectedHash = checkIsDefined(rawTx.deployAccountTxHash);
        const deployResult = await client.addDeployAccountTransaction(
          rawTx.deployAccount,
        );
        this._assertBroadcastHash(deployResult.transaction_hash, expectedHash);
        deployAccountTxId = expectedHash;
      }

      try {
        const invokeResult = await client.addInvokeTransaction(
          rawTx.invoke,
          rawTx.proof,
        );
        this._assertBroadcastHash(invokeResult.transaction_hash, signedTx.txid);
        await this._notePrivacySubmitted({
          encodedTx: signedTx.encodedTx as IEncodedTxStarknet | undefined,
          txid: signedTx.txid,
        });
        return {
          ...signedTx,
          txid: signedTx.txid,
          encodedTx: signedTx.encodedTx,
        };
      } catch (error) {
        if (deployAccountTxId) {
          const localError = new OneKeyLocalError(
            appLocale.intl.formatMessage({
              id: ETranslationsMock.starknet_account_deployed_transfer_failed,
            }),
          );
          // preserve the original invoke error for diagnostics
          localError.cause = error;
          throw localError;
        }
        throw error;
      }
    };

    if (privacy) {
      return this.backgroundApi.serviceStarknetPrivacy.withPrivacyTxSubmitLock(
        {
          networkId: this.networkId,
          accountId: this.accountId,
          kind: privacy.kind,
        },
        submitBroadcast,
      );
    }
    return submitBroadcast();
  }

  private _assertBroadcastHash(actual: string, expected: string) {
    if (sdkStarknet.toFelt(actual) !== sdkStarknet.toFelt(expected)) {
      throw new OneKeyInternalError({
        key: ETranslations.send_verification_failure,
      });
    }
  }

  override async checkSignedTxBroadcastStatus({
    signedTx,
  }: {
    signedTx: ISignedTxPro;
    attemptedAt: number;
    isAcceptedByNode?: boolean;
  }): Promise<ESignedTxBroadcastStatus> {
    const receipt = await (
      await this.getClient()
    ).getTransactionReceipt(signedTx.txid);
    return receipt
      ? ESignedTxBroadcastStatus.Broadcast
      : ESignedTxBroadcastStatus.Unknown;
  }

  /**
   * Records public status once the node accepts a privacy transaction. Recording
   * failures must not make an accepted broadcast look like a failed submission.
   */
  private async _notePrivacySubmitted(params: {
    encodedTx: IEncodedTxStarknet | undefined;
    txid: string;
  }) {
    if (params.encodedTx?.type === 'DEPLOY_ACCOUNT') {
      try {
        await this.backgroundApi.serviceStarknetPrivacy.noteAccountActivationSubmitted(
          {
            networkId: this.networkId,
            accountId: this.accountId,
            txid: params.txid,
          },
        );
      } catch {
        // The normal local history still tracks an accepted deployment.
      }
      return;
    }
    const privacy = params.encodedTx?.privacy;
    if (!privacy) {
      return;
    }
    try {
      const key = {
        networkId: this.networkId,
        accountId: this.accountId,
        poolAddress: privacy.poolAddress,
        txid: params.txid,
      };
      if (privacy.kind === 'register') {
        await this.backgroundApi.serviceStarknetPrivacy.noteRegisterSubmitted(
          key,
        );
      } else {
        await this.backgroundApi.serviceStarknetPrivacy.notePrivateTransferSubmitted(
          {
            ...key,
            kind: privacy.kind,
          },
        );
      }
    } catch {
      // Broadcast already succeeded; recording its public status must not change the result.
    }
  }

  /**
   * A deposit's screening attestation is only valid for
   * STRK20_SCREENING_WINDOW_MS. Submitting a stale build wastes a real fee on a
   * SCREENING_REQUIRED revert, so refuse it here and let the UI rebuild. Only
   * deposits are screened, so nothing else is time-boxed.
   */
  private _assertPrivacyBuildIsFresh(
    encodedTx: IEncodedTxStarknet | undefined,
  ) {
    const privacy = encodedTx?.privacy;
    if (!privacy || privacy.kind !== 'deposit') {
      return;
    }
    if (Date.now() - privacy.builtAt <= STRK20_SCREENING_WINDOW_MS) {
      return;
    }
    throw new OneKeyLocalError({
      key: ETranslations.privacy_error_review_expired__msg,
      data: {
        starknetPrivacyErrorCode: EStrk20ErrorCode.ScreeningWindowExpired,
      },
      message: appLocale.intl.formatMessage({
        id: ETranslations.privacy_error_review_expired__msg,
      }),
    });
  }

  override async getCustomRpcEndpointStatus(
    params: IMeasureRpcStatusParams,
  ): Promise<IMeasureRpcStatusResult> {
    const { rpcUrl } = params;
    if (!rpcUrl) {
      throw new OneKeyInternalError({
        key: ETranslations.form_custom_rpc_error_invalid,
      });
    }
    const client = new ClientStarknet({
      networkId: this.networkId,
      backgroundApi: this.backgroundApi,
      customRpcUrl: rpcUrl,
    });
    const network = await this.getNetwork();

    const start = performance.now();
    const [chainId, bestBlockNumber] = await Promise.all([
      client.getChainId(),
      client.getBlockNumber(),
    ]);
    const responseTime = Math.floor(performance.now() - start);

    // felt equality, not string equality: a node may pad the chain id
    if (
      sdkStarknet.toFelt(chainId) !==
      sdkStarknet.toFelt(sdkStarknet.toStarknetChainId(network.chainId))
    ) {
      throw new OneKeyInternalError({
        key: ETranslations.form_custom_rpc_error_invalid,
      });
    }

    return { responseTime, bestBlockNumber };
  }
}
