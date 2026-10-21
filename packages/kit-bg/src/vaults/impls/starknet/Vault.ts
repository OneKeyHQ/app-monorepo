import BigNumber from 'bignumber.js';
import { md5 } from 'js-md5';
import { isEmpty, orderBy } from 'lodash';

import sdkStarknet from '@onekeyhq/core/src/chains/starknet/sdkStarknet';
import type {
  IDecodedTxExtraStarknet,
  IEncodedTxStarknet,
  IEncodedTxStarknetPrivacy,
  IStarknetCall,
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
  OneKeyInternalError,
  OneKeyLocalError,
} from '@onekeyhq/shared/src/errors';
import { ETranslationsMock } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import { EAddressEncodings } from '@onekeyhq/shared/src/types/address';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
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

import { KeyringHd } from './KeyringHd';
import { KeyringImported } from './KeyringImported';
import { KeyringWatching } from './KeyringWatching';
import {
  ClientStarknet,
  STARKNET_DEFAULT_TOKEN_ADDRESSES,
  STRK20_SCREENING_WINDOW_MS,
  ZERO_SIGNATURE,
} from './sdkStarknet';
import {
  buildErc20TransferCall,
  hexToDecimalString,
  isValidStarknetAddress,
  normalizeStarknetAddress,
  normalizeTokenAddress,
  resourceBoundsToFee,
  sumResourceBounds,
  toHexFelt,
  toResourceBounds,
  u256ToDecimalString,
  zeroResourceBounds,
} from './utils';

import type { IStarknetBroadcastTx, IStarknetFeeEstimate } from './sdkStarknet';
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
  ITransferInfo,
  IUpdateUnsignedTxParams,
  IValidateGeneralInputParams,
} from '../../types';

type IStarknetLegEstimates = {
  invokeBounds: IStarknetResourceBounds;
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
    hw: undefined,
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
      throw new OneKeyInternalError('transfersInfo is required');
    }
    if (transfersInfo.length > 1) {
      throw new OneKeyInternalError('Batch transfers not supported yet');
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
      throw new OneKeyInternalError('privacy tx needs at least one call');
    }
    return this._assembleEncodedTx({
      from: normalizeStarknetAddress(params.from),
      calls: params.calls,
      privacy: params.privacy,
    });
  }

  private async _assembleEncodedTx(params: {
    from: string;
    calls: IStarknetCall[];
    privacy?: IEncodedTxStarknetPrivacy;
  }): Promise<IEncodedTxStarknet> {
    const { from, calls, privacy } = params;
    const [network, client] = await Promise.all([
      this.getNetwork(),
      this.getClient(),
    ]);

    // Deploy detection is authoritative per call and never cached: a previous
    // attempt may have deployed the account even though its invoke leg failed.
    const isDeployed = await client.isAccountDeployed(from);

    const encodedTx: IEncodedTxStarknet = {
      chainId: network.chainId,
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
    }

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
      throw new OneKeyInternalError('from and to addresses are required');
    }
    if (!tokenInfo) {
      throw new OneKeyInternalError('tokenInfo is required');
    }
    const amountBN = new BigNumber(amount);
    if (!amountBN.isFinite() || amountBN.isNegative()) {
      throw new OneKeyInternalError(`Invalid transfer amount: ${amount}`);
    }
    return buildErc20TransferCall({
      tokenAddress: tokenInfo.address,
      to,
      amount: amountBN.shiftedBy(tokenInfo.decimals).toFixed(0),
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
    return suffixed.find((encoding) => this.accountId.endsWith(encoding));
  }

  private async _getAccountDeployParams(expectedAddress: string) {
    const account = await this.getAccount();
    const publicKey = account.pub;
    if (!publicKey) {
      throw new OneKeyInternalError(
        'Starknet account has no public key; cannot deploy it',
      );
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
      throw new OneKeyInternalError(
        'Starknet account address does not match its deployment parameters',
      );
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
    const deployTx = this._buildEstimateDeployAccountTx(encodedTx);
    const invokeTx = this._buildEstimateInvokeTx(encodedTx);
    const broadcastInvokeTx: IStarknetBroadcastTx = encodedTx.privacy
      ? { ...invokeTx, proof: encodedTx.privacy.proof }
      : invokeTx;
    const transactions: IStarknetBroadcastTx[] = deployTx
      ? [deployTx, broadcastInvokeTx]
      : [broadcastInvokeTx];

    const estimates = await client.estimateFee(transactions);
    if (estimates.length !== transactions.length) {
      throw new OneKeyLocalError(
        `Starknet fee estimation returned ${estimates.length} results for ${transactions.length} transactions`,
      );
    }
    const invokeEstimate = estimates[estimates.length - 1];
    const deployEstimate: IStarknetFeeEstimate | undefined = deployTx
      ? estimates[0]
      : undefined;

    return {
      invokeBounds: toResourceBounds(invokeEstimate),
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
    const encodedTx = (params.encodedTx ??
      (await this.buildEncodedTx(params))) as IEncodedTxStarknet | undefined;
    if (!encodedTx) {
      throw new OneKeyInternalError('encodedTx is required');
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

    if (nativeAmountInfo && unsignedTx.transfersInfo?.length) {
      const newAmount =
        nativeAmountInfo.maxSendAmount ?? nativeAmountInfo.amount;
      if (newAmount) {
        const transfersInfo = [
          { ...unsignedTx.transfersInfo[0], amount: newAmount },
        ];
        encodedTx = await this.buildEncodedTx({ transfersInfo });
        unsignedTx.transfersInfo = transfersInfo;
      }
    }

    // Only the invoke leg's bounds can round-trip through IFeeInfoUnit. The
    // deploy leg keeps the bounds buildEncodedTx gave it, which are already
    // padded and cover a fixed-cost operation.
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
    }

    unsignedTx.encodedTx = encodedTx;
    return unsignedTx;
  }

  override async buildDecodedTx(
    params: IBuildDecodedTxParams,
  ): Promise<IDecodedTx> {
    const { unsignedTx } = params;
    const encodedTx = unsignedTx.encodedTx as IEncodedTxStarknet;
    if (!encodedTx) {
      throw new OneKeyInternalError('encodedTx is required');
    }

    const [accountAddress, network] = await Promise.all([
      this.getAccountAddress(),
      this.getNetwork(),
    ]);

    // A privacy tx's calldata is a compile_actions blob, not ERC-20 transfers,
    // so it is rendered from the intent that built it rather than decoded.
    const action = encodedTx.privacy
      ? await this._buildPrivacyAction(encodedTx, encodedTx.privacy)
      : await this._buildTransferAction(encodedTx);

    const invokeFee = sumResourceBounds(encodedTx.resourceBounds);
    const deployFee = encodedTx.deployAccount
      ? sumResourceBounds(encodedTx.deployAccount.resourceBounds)
      : undefined;
    const totalFeeInNative = new BigNumber(invokeFee)
      .plus(deployFee ?? 0)
      .shiftedBy(-network.feeMeta.decimals)
      .toFixed();

    // Both halves are optional and independent, so build the object and only
    // fall back to null when nothing needs carrying.
    const extra: IDecodedTxExtraStarknet = {};
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

    return {
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
    };
  }

  private async _buildTransferAction(
    encodedTx: IEncodedTxStarknet,
  ): Promise<IDecodedTxAction> {
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
    if (
      privacy.kind === 'register' ||
      !privacy.tokenAddress ||
      !privacy.amount
    ) {
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
    const counterparty = privacy.recipient
      ? normalizeStarknetAddress(privacy.recipient)
      : pool;
    const from = privacy.kind === 'withdraw' ? pool : encodedTx.from;
    const to = privacy.kind === 'deposit' ? pool : counterparty;

    return this.buildTxTransferAssetAction({
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

  // ---------------------------------------------------------------- backend-less
  // Starknet has no backend coverage yet, so the top-level methods are
  // overridden rather than the *ByRpc siblings: VaultBase only routes to those
  // when the network is a user-added custom one, and both Starknet presets are
  // first-class networks.

  override async fetchAccountDetails(
    params: IFetchServerAccountDetailsParams,
  ): Promise<IFetchServerAccountDetailsResponse> {
    const [client, network] = await Promise.all([
      this.getClient(),
      this.getNetwork(),
    ]);
    const accountAddress = normalizeStarknetAddress(params.accountAddress);
    const networkInfo = await this.getNetworkInfo();
    const [low, high] = await client.getTokenBalance({
      tokenAddress: networkInfo.nativeTokenAddress ?? '',
      accountAddress,
    });
    const balance = u256ToDecimalString(low, high);

    return {
      data: {
        data: {
          address: params.accountAddress,
          balance,
          balanceParsed: new BigNumber(balance)
            .shiftedBy(-network.decimals)
            .toFixed(),
          nonce: 0,
        },
      },
    };
  }

  override async fetchTokenDetails(
    params: IFetchServerTokenDetailParams,
  ): Promise<IFetchServerTokenDetailResponse> {
    const items = await this._fetchTokenItems({
      accountAddress: params.accountAddress ?? '',
      contractList: params.contractList ?? [],
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

  override async fetchTokenList(
    params: IFetchServerTokenListParams,
  ): Promise<IFetchServerTokenListResponse> {
    const { requestApiParams } = params;
    const accountTokenArray = await this._fetchTokenItems({
      accountAddress: requestApiParams.accountAddress ?? '',
      contractList: requestApiParams.contractList ?? [],
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
   * Token metadata is immutable, and there is no token API for this chain, so
   * read it from the contract once and keep it.
   *
   * Deliberately not serviceToken.getToken: for a token it does not know yet,
   * that routes into serviceToken.fetchTokensDetails, which calls back into
   * this vault's fetchTokenDetails and would loop.
   */
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
   * contract covers the native entry and every token alike. Prices stay zero:
   * they only come from the backend token endpoints, which do not list this
   * chain yet.
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

    const requested = contractList
      .filter((contract): contract is string => Boolean(contract))
      .map((contract) => normalizeTokenAddress(contract));
    const addresses = Array.from(
      new Set([
        ...STARKNET_DEFAULT_TOKEN_ADDRESSES.map((address) =>
          normalizeTokenAddress(address),
        ),
        ...requested,
      ]),
    );

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
      console.error(
        `Starknet token read failed for ${addresses[index]}:`,
        result.reason,
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
        }__${JSON.stringify(data)}`,
      ),
      fiatValue: undefined,
    };
  }

  override async estimateFee(
    params: IEstimateGasParams,
  ): Promise<IServerEstimateFeeResponse> {
    const encodedTx = params.encodedTx as IEncodedTxStarknet | undefined;
    if (!encodedTx) {
      throw new OneKeyInternalError(
        'Starknet fee estimation requires an encodedTx',
      );
    }
    const [client, network] = await Promise.all([
      this.getClient(),
      this.getNetwork(),
    ]);
    const { invokeBounds, invokeOverallFee, deployOverallFee } =
      await this._estimateLegs({
        client,
        encodedTx,
      });

    const feeStarknet: IFeeStarknet = {
      ...resourceBoundsToFee(invokeBounds),
      // the deploy leg keeps its own line; overallFee covers the invoke only
      overallFee: invokeOverallFee,
      // charged from the same balance and signed as part of the same send, so
      // it belongs in the headline total rather than a separate extra fee
      ...(encodedTx.deployAccount
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
          nativeTokenPrice: { price: 0, price24h: 0 },
          feeStarknet: [feeStarknet],
        },
      },
    };
  }

  /**
   * An account's first send lands as two transactions, DEPLOY_ACCOUNT then the
   * INVOKE, but is recorded locally as one row keyed by the INVOKE. The deploy
   * hash rides in that row, so its fee is added here; FRI, decimal string.
   */
  private async _fetchPairedDeployFee({
    client,
    params,
  }: {
    client: ClientStarknet;
    params: IServerFetchAccountHistoryDetailParams;
  }): Promise<string> {
    if (!params.accountAddress) {
      return '0';
    }
    const localTx =
      await this.backgroundApi.simpleDb.localHistory.getLocalHistoryTxById({
        networkId: this.networkId,
        accountAddress: params.accountAddress,
        historyId: accountUtils.buildLocalHistoryId({
          networkId: this.networkId,
          accountAddress: params.accountAddress,
          txid: params.txid,
        }),
      });
    const extraInfo = localTx?.decodedTx.extraInfo as
      | IDecodedTxExtraStarknet
      | null
      | undefined;
    if (!extraInfo?.deployAccountTxId) {
      return '0';
    }
    const deployReceipt = await client.getTransactionReceipt(
      extraInfo.deployAccountTxId,
    );
    return deployReceipt?.actual_fee?.amount
      ? hexToDecimalString(deployReceipt.actual_fee.amount)
      : '0';
  }

  override async fetchAccountHistoryDetail(
    params: IServerFetchAccountHistoryDetailParams,
  ): Promise<IServerFetchAccountHistoryDetailResp> {
    const client = await this.getClient();
    const network = await this.getNetwork();
    const receipt = await client.getTransactionReceipt(params.txid);

    // execution_status alone is not enough: a RECEIVED or PRE_CONFIRMED receipt
    // already reports SUCCEEDED while the transaction can still be dropped, so
    // it stays Pending until the sequencer accepts it. REJECTED is terminal and
    // will never be accepted, so it resolves to Failed rather than polling
    // forever.
    let status = EOnChainHistoryTxStatus.Pending;
    if (receipt) {
      const isAccepted =
        receipt.finality_status === 'ACCEPTED_ON_L2' ||
        receipt.finality_status === 'ACCEPTED_ON_L1';
      if (isAccepted) {
        status =
          receipt.execution_status === 'SUCCEEDED'
            ? EOnChainHistoryTxStatus.Success
            : EOnChainHistoryTxStatus.Failed;
      } else if (receipt.finality_status === 'REJECTED') {
        status = EOnChainHistoryTxStatus.Failed;
      }
    }

    const invokeFee = receipt?.actual_fee?.amount
      ? hexToDecimalString(receipt.actual_fee.amount)
      : '0';
    const deployFee = await this._fetchPairedDeployFee({ client, params });
    const gasFee = new BigNumber(invokeFee)
      .plus(deployFee)
      .shiftedBy(-network.feeMeta.decimals)
      .toFixed();

    // STRK20 re-arms its proving wait after ANY transaction this account lands,
    // not just a private one: an ordinary ERC-20 transfer is state the next
    // proof reads. The service no-ops when the account has no privacy record.
    if (
      receipt?.block_number !== undefined &&
      status === EOnChainHistoryTxStatus.Success
    ) {
      void this.backgroundApi.serviceStarknetPrivacy.noteAccountTouchedByTx({
        networkId: this.networkId,
        accountId: this.accountId,
        blockNumber: receipt.block_number,
      });
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
            timestamp: 0,
            nonce: 0,
            gasFee,
            gasFeeFiatValue: '0',
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
    const client = await this.getClient();
    return this._broadcast({ client, signedTx: params.signedTx });
  }

  override async broadcastTransactionFromCustomRpc(
    params: IBroadcastTransactionByCustomRpcParams,
  ): Promise<ISignedTxPro> {
    const rpcUrl = params.customRpcInfo.rpc;
    if (!rpcUrl) {
      throw new OneKeyInternalError('Invalid rpc url');
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
   * the account exists with nonce 0 and the next attempt re-detects that.
   */
  private async _broadcast({
    client,
    signedTx,
  }: {
    client: ClientStarknet;
    signedTx: ISignedTxPro;
  }): Promise<ISignedTxPro> {
    const rawTx = JSON.parse(signedTx.rawTx) as IStarknetRawTx;
    this._assertPrivacyBuildIsFresh(
      signedTx.encodedTx as IEncodedTxStarknet | undefined,
    );

    let deployAccountTxId: string | undefined;
    if (rawTx.deployAccount) {
      const deployResult = await client.addDeployAccountTransaction(
        rawTx.deployAccount,
      );
      deployAccountTxId = deployResult.transaction_hash;
    }

    try {
      const invokeResult = await client.addInvokeTransaction(
        rawTx.invoke,
        rawTx.proof,
      );
      return {
        ...signedTx,
        txid: invokeResult.transaction_hash,
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
      key: ETranslationsMock.starknet_privacy_error_screening_window_expired,
      message: appLocale.intl.formatMessage({
        id: ETranslationsMock.starknet_privacy_error_screening_window_expired,
      }),
    });
  }

  override async getCustomRpcEndpointStatus(
    params: IMeasureRpcStatusParams,
  ): Promise<IMeasureRpcStatusResult> {
    const { rpcUrl } = params;
    if (!rpcUrl) {
      throw new OneKeyInternalError('Invalid rpc url');
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
    if (sdkStarknet.toFelt(chainId) !== sdkStarknet.toFelt(network.chainId)) {
      throw new OneKeyLocalError(
        `RPC endpoint serves chainId ${chainId}, expected ${network.chainId}`,
      );
    }

    return { responseTime, bestBlockNumber };
  }
}
