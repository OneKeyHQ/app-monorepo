/* eslint-disable spellcheck/spell-checker */
import BigNumber from 'bignumber.js';
import { md5 } from 'js-md5';
import { isEmpty, isNaN, orderBy } from 'lodash';

import type {
  IEncodedTxStellar,
  IStellarAsset,
} from '@onekeyhq/core/src/chains/stellar/types';
import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';
import {
  decodeSensitiveTextAsync,
  encodeSensitiveTextAsync,
} from '@onekeyhq/core/src/secret';
import type {
  IEncodedTx,
  ISignedTxPro,
  IUnsignedTxPro,
} from '@onekeyhq/core/src/types';
import {
  ManageTokenInsufficientBalanceError,
  OneKeyInternalError,
} from '@onekeyhq/shared/src/errors';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';
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
  IFeeInfoUnit,
  IServerEstimateFeeResponse,
} from '@onekeyhq/shared/types/fee';
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
  IToken,
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
  EDecodedTxDirection,
  EDecodedTxStatus,
} from '@onekeyhq/shared/types/tx';

import { VaultBase } from '../../base/VaultBase';

import { KeyringExternal } from './KeyringExternal';
import { KeyringHardware } from './KeyringHardware';
import { KeyringHd } from './KeyringHd';
import { KeyringImported } from './KeyringImported';
import { KeyringWatching } from './KeyringWatching';
import sdkStellar, {
  Account,
  Asset,
  Memo,
  Operation,
  StrKey,
  TransactionBuilder,
} from './sdkStellar';
import ClientStellar from './sdkStellar/ClientStellar';
import {
  BASE_FEE,
  ENTRY_RESERVE,
  SAC_TOKEN_ASSET_TYPES,
  SAC_TOKEN_DECIMALS,
  buildMemoFromString,
  calculateAvailableBalance,
  isValidAccountCreationAmount,
} from './utils';

import type { IDBWalletType } from '../../../dbs/local/types';
import type { KeyringBase } from '../../base/KeyringBase';
import type {
  IBroadcastTransactionByCustomRpcParams,
  IBuildAccountAddressDetailParams,
  IBuildDecodedTxParams,
  IBuildEncodedTxParams,
  IBuildUnsignedTxParams,
  IGetPrivateKeyFromImportedParams,
  IGetPrivateKeyFromImportedResult,
  INativeAmountInfo,
  IUpdateUnsignedTxParams,
  IValidateGeneralInputParams,
} from '../../types';
import type * as StellarSdk from '@stellar/stellar-base';

export default class Vault extends VaultBase {
  override coreApi = coreChainApi.stellar.hd;

  override keyringMap: Record<IDBWalletType, typeof KeyringBase | undefined> = {
    hd: KeyringHd,
    qr: undefined,
    hw: KeyringHardware,
    imported: KeyringImported,
    watching: KeyringWatching,
    external: KeyringExternal,
  };

  _getClientCache = memoizee(
    async () =>
      new ClientStellar({
        networkId: this.networkId,
        backgroundApi: this.backgroundApi,
      }),
    {
      maxAge: timerUtils.getTimeDurationMs({ minute: 3 }),
    },
  );

  // ========== START: LOCAL DEVELOPMENT RPC SUPPORT ==========
  // This modification allows using custom RPC for all Stellar operations
  // Priority: Custom RPC (if enabled) > Default server RPC
  //
  // To use local RPC:
  //   await backgroundApi.serviceCustomRpc.addCustomRpc({
  //     customRpc: {
  //       networkId: 'stellar--0',
  //       rpc: 'http://localhost:8000',
  //       enabled: true,
  //       isCustomNetwork: false,
  //       updatedAt: Date.now(),
  //     },
  //   });
  //
  // To rollback: Replace getClient() body with: return this._getClientCache();
  async getClient() {
    const customClient = await this.getCustomClient();
    if (customClient) {
      return customClient;
    }
    return this._getClientCache();
  }
  // ========== END: LOCAL DEVELOPMENT RPC SUPPORT ==========

  /**
   * Check if account exists on the network
   */
  async checkAccountExists(address: string): Promise<boolean> {
    const client = await this.getClient();
    const network = await this.getNetwork();
    return client.accountExists(address);
  }

  /**
   * Get available balance considering reserves
   */
  async getAvailableBalance(address: string): Promise<string> {
    const client = await this.getClient();
    const accountInfo = await client.getAccountInfo(address);

    if (!accountInfo) {
      return '0';
    }

    return calculateAvailableBalance({
      balance: accountInfo.balance,
      numSubEntries: accountInfo.subentry_count,
    });
  }

  /**
   * Build changeTrust transaction to add/remove trustline
   */
  async buildChangeTrustTx(params: {
    from: string;
    assetCode: string;
    assetIssuer: string;
    limit?: string; // undefined = unlimited, '0' = remove trustline
    memo?: string;
  }): Promise<IEncodedTxStellar> {
    const { from, assetCode, assetIssuer, limit, memo } = params;

    const client = await this.getClient();

    // Get account sequence
    const fromAccountInfo = await client.getAccountInfo(from);
    if (!fromAccountInfo) {
      throw new OneKeyInternalError(
        `Source account ${from} not found on network`,
      );
    }

    // Get network passphrase
    const networkPassphrase = await client.getNetworkPassphrase();

    // Get suggested fee
    const fee = await client.getSuggestedFee();

    // Create account object
    const sourceAccount = new Account(from, fromAccountInfo.sequence);

    // Build transaction
    const transactionBuilder = new TransactionBuilder(sourceAccount, {
      fee,
      networkPassphrase,
    });

    // Add memo if provided
    const memoField = buildMemoFromString(memo);
    if (memoField) {
      transactionBuilder.addMemo(memoField);
    }

    // Create asset
    const asset = new Asset(assetCode, assetIssuer);

    // Add changeTrust operation
    transactionBuilder.addOperation(
      Operation.changeTrust({
        asset,
        limit,
      }),
    );

    // Set timeout
    transactionBuilder.setTimeout(30);

    // Build transaction
    const transaction = transactionBuilder.build();
    const xdr = transaction.toXDR();

    // Return encoded transaction (XDR as single source of truth)
    return {
      xdr,
      networkPassphrase,
    };
  }

  /**
   * Activate token by creating trustline
   * Stellar requires trustline to receive non-native tokens
   */
  override async activateToken(params: {
    token: IAccountToken;
  }): Promise<boolean> {
    const { token } = params;

    // Native XLM doesn't need activation
    if (token.isNative) {
      return Promise.resolve(true);
    }

    const dbAccount = await this.getAccount();
    const network = await this.getNetwork();
    const client = await this.getClient();
    const [assetCode, assetIssuer] = token.address.split(':');
    if (!assetCode || !assetIssuer) {
      throw new OneKeyInternalError(
        `Invalid token address format: ${token.address}. Expected "assetCode:assetIssuer"`,
      );
    }

    const accountInfo = await client.getAccountInfo(dbAccount.address);
    if (!accountInfo) {
      throw new OneKeyInternalError(
        `Account ${dbAccount.address} not found on network`,
      );
    }

    // Check if trustline already exists
    const hasTrustline = accountInfo.balances?.some(
      (b) => b.asset_code === assetCode && b.asset_issuer === assetIssuer,
    );

    if (hasTrustline) {
      return Promise.resolve(true);
    }

    const availableBalance = new BigNumber(
      calculateAvailableBalance({
        balance: accountInfo.balance,
        numSubEntries: accountInfo.subentry_count,
      }),
    );
    const reserveRequired = new BigNumber(ENTRY_RESERVE);
    const feeRequired = new BigNumber(BASE_FEE).shiftedBy(-network.decimals);
    if (availableBalance.lt(reserveRequired.plus(feeRequired))) {
      throw new ManageTokenInsufficientBalanceError({
        info: {
          token: token.symbol,
        },
      });
    }

    // Build changeTrust transaction to add trustline
    const unsignedTx = await this.buildUnsignedTx({
      encodedTx: await this.buildChangeTrustTx({
        from: dbAccount.address,
        assetCode,
        assetIssuer,
        limit: undefined, // unlimited
      }),
    });

    try {
      const [signedTx] =
        await this.backgroundApi.serviceSend.batchSignAndSendTransaction({
          accountId: this.accountId,
          networkId: this.networkId,
          unsignedTxs: [unsignedTx],
          transferPayload: undefined,
        });

      return !!signedTx.signedTx.txid;
    } catch (error) {
      // Handle insufficient balance error
      if (
        error instanceof Error &&
        (error.message.includes('insufficient') ||
          error.message.includes('underfunded'))
      ) {
        // Insufficient XLM to create trustline. Minimum 0.5 XLM reserve is required.
        throw new ManageTokenInsufficientBalanceError({
          info: {
            token: token.symbol,
          },
        });
      }
      throw error;
    }
  }

  override async buildAccountAddressDetail(
    params: IBuildAccountAddressDetailParams,
  ): Promise<INetworkAccountAddressDetail> {
    const { account, networkId } = params;
    const address = account.address || '';

    const { normalizedAddress, displayAddress, isValid } =
      await this.validateAddress(address);

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

  override async buildEncodedTx(
    params: IBuildEncodedTxParams,
  ): Promise<IEncodedTx> {
    const { transfersInfo } = params;

    if (!transfersInfo || transfersInfo.length === 0) {
      throw new OneKeyInternalError('transfersInfo is required');
    }

    if (transfersInfo.length > 1) {
      throw new OneKeyInternalError('Batch transfers not supported yet');
    }

    const transferInfo = transfersInfo[0];
    const { from, to, amount, tokenInfo } = transferInfo;

    if (!from || !to) {
      throw new OneKeyInternalError('from and to addresses are required');
    }

    if (!tokenInfo) {
      throw new OneKeyInternalError('tokenInfo is required');
    }

    const client = await this.getClient();
    const network = await this.getNetwork();

    // Get account sequence
    const fromAccountInfo = await client.getAccountInfo(from);
    if (!fromAccountInfo) {
      throw new OneKeyInternalError(
        `Source account ${from} not found on network`,
      );
    }

    // Check if destination account exists
    const toAccountExists = await client.accountExists(to);

    // Get network passphrase
    const networkPassphrase = await client.getNetworkPassphrase();

    // Get suggested fee or use default
    const fee = await client.getSuggestedFee();

    // Create account object
    const sourceAccount = new Account(from, fromAccountInfo.sequence);

    // Build transaction
    const transactionBuilder = new TransactionBuilder(sourceAccount, {
      fee,
      networkPassphrase,
    });

    // Add memo if provided
    const memoField = buildMemoFromString(transferInfo.memo);
    if (memoField) {
      transactionBuilder.addMemo(memoField);
    }

    // Add operation based on account existence and token type
    if (tokenInfo.isNative) {
      // Native XLM transfer
      const amountInXlm = new BigNumber(amount).toFixed(network.decimals);

      if (!toAccountExists) {
        // Use createAccount for non-existent accounts
        if (!isValidAccountCreationAmount(amountInXlm)) {
          throw new OneKeyInternalError(
            `Minimum 1 XLM required to create account, got ${amountInXlm}`,
          );
        }

        transactionBuilder.addOperation(
          Operation.createAccount({
            destination: to,
            startingBalance: amountInXlm,
          }),
        );
      } else {
        // Regular payment
        transactionBuilder.addOperation(
          Operation.payment({
            destination: to,
            asset: Asset.native(),
            amount: amountInXlm,
          }),
        );
      }
    } else {
      // Token transfer
      if (!toAccountExists) {
        throw new OneKeyInternalError(
          `Destination account ${to} does not exist. Cannot send tokens to non-existent account.`,
        );
      }

      // Parse token address: format is "assetCode:assetIssuer"
      const [assetCode, assetIssuer] = tokenInfo.address.split(':');
      if (!assetCode || !assetIssuer) {
        throw new OneKeyInternalError(
          `Invalid token address format: ${tokenInfo.address}. Expected "assetCode:assetIssuer"`,
        );
      }

      // Check if destination has trustline
      const hasTrustline = await client.hasTrustline(
        to,
        assetCode,
        assetIssuer,
      );

      if (!hasTrustline) {
        throw new OneKeyInternalError(
          `Destination account does not have trustline for ${assetCode}`,
        );
      }

      const asset = new Asset(assetCode, assetIssuer);
      const amountFormatted = new BigNumber(amount).toFixed(tokenInfo.decimals);

      transactionBuilder.addOperation(
        Operation.payment({
          destination: to,
          asset,
          amount: amountFormatted,
        }),
      );
    }

    // Set timeout
    const timeoutSeconds = timerUtils.getTimeDurationMs({ minute: 5 }) / 1000;
    transactionBuilder.setTimeout(timeoutSeconds);

    // Build transaction
    const transaction = transactionBuilder.build();
    const xdr = transaction.toXDR();

    // Return encoded transaction (XDR as single source of truth)
    const encodedTx: IEncodedTxStellar = {
      xdr,
      networkPassphrase,
    };

    return encodedTx;
  }

  override async buildDecodedTx(
    params: IBuildDecodedTxParams,
  ): Promise<IDecodedTx> {
    const { unsignedTx } = params;
    const encodedTx = unsignedTx.encodedTx as IEncodedTxStellar;
    if (!encodedTx) {
      throw new OneKeyInternalError('encodedTx is required');
    }

    const [accountAddress, network, networkInfo] = await Promise.all([
      this.getAccountAddress(),
      this.getNetwork(),
      this.getNetworkInfo(),
    ]);

    const parsedTx = sdkStellar.StellarSdk.TransactionBuilder.fromXDR(
      encodedTx.xdr,
      encodedTx.networkPassphrase,
    );
    if (!(parsedTx instanceof sdkStellar.StellarSdk.Transaction)) {
      throw new OneKeyInternalError(
        'Only classic transactions can be decoded currently.',
      );
    }
    const tx = parsedTx;

    const tokenCache: Record<string, IToken> = {};
    const buildTokenCacheKey = (tokenId: string) => tokenId || '__native__';
    const ensureTokenInfo = async (
      tokenIdOnNetwork: string,
      fallback: IToken,
    ): Promise<IToken> => {
      const cacheKey = buildTokenCacheKey(tokenIdOnNetwork);
      if (!tokenCache[cacheKey]) {
        const fetchedToken =
          (await this.backgroundApi.serviceToken.getToken({
            accountId: this.accountId,
            networkId: this.networkId,
            tokenIdOnNetwork,
          })) ?? fallback;
        tokenCache[cacheKey] = fetchedToken;
      }
      return tokenCache[cacheKey];
    };

    const nativeTokenId = networkInfo.nativeTokenAddress ?? '';
    const nativeToken = await ensureTokenInfo(nativeTokenId, {
      address: nativeTokenId,
      decimals: network.decimals,
      logoURI: network.logoURI,
      name: network.shortname ?? network.name ?? network.symbol,
      symbol: network.symbol,
      isNative: true,
    });

    const buildUnknownAction = (
      from: string,
      to?: string,
    ): IDecodedTxAction => ({
      type: EDecodedTxActionType.UNKNOWN,
      direction: EDecodedTxDirection.OTHER,
      unknownAction: {
        from,
        to: to ?? '',
      },
    });

    const operations = tx.operations ?? [];
    const actions: IDecodedTxAction[] = [];

    for (const op of operations) {
      let action: IDecodedTxAction | null = null;

      if (op.type === 'payment') {
        const paymentOp = op as StellarSdk.Operation.Payment;
        const from = paymentOp.source ?? tx.source ?? accountAddress;
        const to = paymentOp.destination;

        let tokenInfo = nativeToken;
        let tokenIdOnNetwork = nativeToken.address;
        let isNative = true;

        if (!paymentOp.asset.isNative()) {
          const assetInfo = this._convertAssetToIStellarAsset(paymentOp.asset);
          if (assetInfo.type !== 'NATIVE') {
            tokenIdOnNetwork = `${assetInfo.code}:${assetInfo.issuer}`;
            tokenInfo = await ensureTokenInfo(tokenIdOnNetwork, {
              address: tokenIdOnNetwork,
              decimals: network.decimals,
              logoURI: '',
              name: assetInfo.code,
              symbol: assetInfo.code,
              isNative: false,
            });
            isNative = false;
          }
        }

        const transfer: IDecodedTxTransferInfo = {
          from,
          to,
          amount: new BigNumber(paymentOp.amount).toFixed(),
          tokenIdOnNetwork,
          icon: tokenInfo.logoURI ?? '',
          name: tokenInfo.name,
          symbol: tokenInfo.symbol,
          isNFT: false,
          isNative,
        };

        // eslint-disable-next-line no-await-in-loop
        action = await this.buildTxTransferAssetAction({
          from,
          to,
          transfers: [transfer],
        });
      } else if (op.type === 'createAccount') {
        const createAccountOp = op as StellarSdk.Operation.CreateAccount;
        const from = createAccountOp.source ?? tx.source ?? accountAddress;
        const to = createAccountOp.destination;
        const transfer: IDecodedTxTransferInfo = {
          from,
          to,
          amount: new BigNumber(createAccountOp.startingBalance).toFixed(),
          tokenIdOnNetwork: nativeToken.address,
          icon: nativeToken.logoURI ?? '',
          name: nativeToken.name,
          symbol: nativeToken.symbol,
          isNFT: false,
          isNative: true,
        };

        // eslint-disable-next-line no-await-in-loop
        action = await this.buildTxTransferAssetAction({
          from,
          to,
          transfers: [transfer],
        });
      } else if (op.type === 'changeTrust') {
        const changeTrustOp = op as StellarSdk.Operation.ChangeTrust;
        const assetLine = changeTrustOp.line;
        if (assetLine instanceof Asset) {
          const assetInfo = this._convertAssetToIStellarAsset(assetLine);
          if (assetInfo.type !== 'NATIVE') {
            const tokenIdOnNetwork = `${assetInfo.code}:${assetInfo.issuer}`;
            const tokenInfo = await ensureTokenInfo(tokenIdOnNetwork, {
              address: tokenIdOnNetwork,
              decimals: network.decimals,
              logoURI: '',
              name: assetInfo.code,
              symbol: assetInfo.code,
              isNative: false,
            });
            const owner = changeTrustOp.source ?? tx.source ?? accountAddress;
            action = {
              type: EDecodedTxActionType.TOKEN_ACTIVATE,
              tokenActivate: {
                from: owner,
                to: owner,
                icon: tokenInfo.logoURI ?? '',
                name: tokenInfo.name,
                symbol: tokenInfo.symbol,
                decimals: tokenInfo.decimals,
                tokenIdOnNetwork: tokenInfo.address,
              },
            };
          }
        }
      }

      if (action) {
        actions.push(action);
      } else {
        const fallbackFrom = op.source ?? tx.source ?? accountAddress;
        const fallbackTo =
          'destination' in op
            ? (op as { destination?: string }).destination
            : '';
        actions.push(buildUnknownAction(fallbackFrom, fallbackTo));
      }
    }

    if (actions.length === 0) {
      actions.push(buildUnknownAction(tx.source ?? accountAddress));
    }

    const operationCount = Math.max(operations.length, 1);
    const totalFeeNative = new BigNumber(tx.fee ?? 0)
      .shiftedBy(-network.decimals)
      .toFixed();
    const gasPrice = new BigNumber(tx.fee ?? 0)
      .div(operationCount)
      .shiftedBy(-network.decimals)
      .toFixed();

    const decodedTx: IDecodedTx = {
      txid: '',
      owner: accountAddress,
      signer: accountAddress,
      nonce: new BigNumber(tx.sequence ?? 0).toNumber(),
      actions,
      status: EDecodedTxStatus.Pending,
      networkId: this.networkId,
      accountId: this.accountId,
      feeInfo: {
        common: {
          feeDecimals: network.decimals,
          feeSymbol: network.symbol,
          nativeDecimals: network.decimals,
          nativeSymbol: network.symbol,
        },
        gas: {
          gasPrice,
          gasLimit: operationCount.toString(),
        },
      },
      extraInfo: null,
      encodedTx,
      totalFeeInNative: totalFeeNative,
    };

    return decodedTx;
  }

  override async buildUnsignedTx(
    params: IBuildUnsignedTxParams,
  ): Promise<IUnsignedTxPro> {
    const builtEncodedTx = (params.encodedTx ??
      (await this.buildEncodedTx(params))) as IEncodedTxStellar | undefined;

    if (!builtEncodedTx) {
      throw new OneKeyInternalError('encodedTx is required');
    }

    const unsignedTx: IUnsignedTxPro =
      params.unsignedTx ??
      ({
        encodedTx: builtEncodedTx,
        transfersInfo: params.transfersInfo ?? [],
      } as IUnsignedTxPro);

    unsignedTx.encodedTx = builtEncodedTx;
    unsignedTx.transfersInfo = params.transfersInfo ?? [];

    if (typeof params.prevNonce === 'number') {
      unsignedTx.nonce = new BigNumber(params.prevNonce).plus(1).toNumber();
    }

    return unsignedTx;
  }

  override async updateUnsignedTx(
    params: IUpdateUnsignedTxParams,
  ): Promise<IUnsignedTxPro> {
    const { unsignedTx, nativeAmountInfo, feeInfo, nonceInfo } = params;
    const encodedTx = unsignedTx.encodedTx as IEncodedTxStellar;

    // If nothing to update, return original
    if (!nativeAmountInfo && !feeInfo && !nonceInfo) {
      return unsignedTx;
    }

    try {
      // For Stellar SDK, we need to rebuild the entire transaction
      // This is the simplest approach for modifications
      const newXdr = await this._updateTransactionXdr({
        xdr: encodedTx.xdr,
        networkPassphrase: encodedTx.networkPassphrase,
        nativeAmountInfo,
        feeInfo,
        nonceInfo,
      });

      if (nonceInfo) {
        unsignedTx.nonce = nonceInfo.nonce;
      }

      unsignedTx.encodedTx = {
        ...encodedTx,
        xdr: newXdr,
      };

      return unsignedTx;
    } catch (error) {
      console.error('Failed to update unsigned tx:', error);
      throw new OneKeyInternalError('Failed to update transaction');
    }
  }

  /**
   * Update transaction XDR with new values
   * Simpler approach: parse minimal info and rebuild
   */
  private async _updateTransactionXdr(params: {
    xdr: string;
    networkPassphrase: string;
    nativeAmountInfo?: INativeAmountInfo;
    feeInfo?: IFeeInfoUnit;
    nonceInfo?: { nonce: number };
  }): Promise<string> {
    const { xdr, networkPassphrase, nativeAmountInfo, feeInfo, nonceInfo } =
      params;

    const network = await this.getNetwork();
    const parsedTx = sdkStellar.StellarSdk.TransactionBuilder.fromXDR(
      xdr,
      networkPassphrase,
    );
    if (!(parsedTx instanceof sdkStellar.StellarSdk.Transaction)) {
      throw new OneKeyInternalError(
        'Only classic transactions can be updated currently.',
      );
    }
    const tx = parsedTx;

    const resolvedFee = this._resolveStellarFeeFromFeeInfo(
      feeInfo,
      network.decimals,
    );
    const cloneOverrides = resolvedFee
      ? {
          fee: resolvedFee,
        }
      : undefined;

    const builder = sdkStellar.StellarSdk.TransactionBuilder.cloneFrom(
      tx,
      cloneOverrides,
    );

    if (nonceInfo) {
      const targetSequence = new BigNumber(nonceInfo.nonce);
      if (!targetSequence.isInteger() || targetSequence.lte(0)) {
        throw new OneKeyInternalError('Invalid nonce value provided.');
      }
      const builderSequence = targetSequence.minus(1).toFixed(0);
      const builderWithSource = builder as StellarSdk.TransactionBuilder & {
        source?: StellarSdk.Account | StellarSdk.MuxedAccount;
      };
      builderWithSource.source = StrKey.isValidMed25519PublicKey(tx.source)
        ? sdkStellar.StellarSdk.MuxedAccount.fromAddress(
            tx.source,
            builderSequence,
          )
        : new Account(tx.source, builderSequence);
    }

    const txEnvelope = tx.toEnvelope();
    const envelopeType = txEnvelope.switch();
    if (
      envelopeType !== sdkStellar.xdr.EnvelopeType.envelopeTypeTx() &&
      envelopeType !== sdkStellar.xdr.EnvelopeType.envelopeTypeTxV0()
    ) {
      throw new OneKeyInternalError(
        'Unsupported transaction envelope type when rebuilding.',
      );
    }
    let rawOperations: StellarSdk.xdr.Operation[] = [];
    if (envelopeType === sdkStellar.xdr.EnvelopeType.envelopeTypeTxV0()) {
      const inner = txEnvelope.value() as StellarSdk.xdr.TransactionV0Envelope;
      rawOperations = inner.tx().operations() ?? [];
    } else if (envelopeType === sdkStellar.xdr.EnvelopeType.envelopeTypeTx()) {
      const inner = txEnvelope.value() as StellarSdk.xdr.TransactionV1Envelope;
      rawOperations = inner.tx().operations() ?? [];
    }

    builder.clearOperations();

    for (let i = 0; i < tx.operations.length; i += 1) {
      const op = tx.operations[i];
      let handled = false;

      if (nativeAmountInfo && op.type === 'payment') {
        const paymentOp = op;
        if (paymentOp.asset.isNative()) {
          const newAmount =
            nativeAmountInfo.maxSendAmount ?? nativeAmountInfo.amount;
          if (newAmount) {
            builder.addOperation(
              Operation.payment({
                destination: paymentOp.destination,
                asset: Asset.native(),
                amount: new BigNumber(newAmount).toFixed(network.decimals),
                source: paymentOp.source,
              }),
            );
            handled = true;
          }
        }
      }

      if (!handled && nativeAmountInfo && op.type === 'createAccount') {
        const createOp = op;
        const newAmount =
          nativeAmountInfo.maxSendAmount ?? nativeAmountInfo.amount;
        if (newAmount) {
          builder.addOperation(
            Operation.createAccount({
              destination: createOp.destination,
              startingBalance: new BigNumber(newAmount).toFixed(
                network.decimals,
              ),
              source: createOp.source,
            }),
          );
          handled = true;
        }
      }

      if (handled) {
        // Already replaced operation with updated value
        // eslint-disable-next-line no-continue
        continue;
      }

      const opXdr = rawOperations[i];
      if (!opXdr) {
        throw new OneKeyInternalError(
          'Failed to locate original operation XDR data.',
        );
      }
      builder.addOperation(opXdr);
    }

    if (!tx.timeBounds) {
      builder.setTimeout(300);
    }

    return builder.build().toXDR();
  }

  /**
   * Convert Stellar SDK Asset to IStellarAsset format
   */
  private _convertAssetToIStellarAsset(
    asset: StellarSdk.Asset | StellarSdk.LiquidityPoolAsset,
  ): IStellarAsset {
    if (!(asset instanceof Asset)) {
      throw new OneKeyInternalError('Liquidity pool assets are not supported.');
    }
    if (asset.isNative()) {
      return { type: 'NATIVE' };
    }
    const code = asset.getCode();
    const issuer = asset.getIssuer();
    return {
      type: code.length <= 4 ? 'ALPHANUM4' : 'ALPHANUM12',
      code,
      issuer,
    };
  }

  override async validateAddress(address: string): Promise<IAddressValidation> {
    const isValid = sdkStellar.isValidAddress(address);

    return {
      isValid,
      normalizedAddress: isValid ? address : '',
      displayAddress: isValid ? address : '',
    };
  }

  override async validateXpub(_xpub: string): Promise<IXpubValidation> {
    return {
      isValid: false,
    };
  }

  override async getPrivateKeyFromImported(
    params: IGetPrivateKeyFromImportedParams,
  ): Promise<IGetPrivateKeyFromImportedResult> {
    const input = await decodeSensitiveTextAsync({
      encodedText: params.input,
    });

    let privateKey: string;

    // Check if input is a Stellar secret key (S...)
    if (input.startsWith('S') && input.length === 56) {
      try {
        const secretBuffer = sdkStellar.decodeSecretKey(input);
        privateKey = bufferUtils.bytesToHex(secretBuffer);
      } catch {
        throw new OneKeyInternalError('Invalid Stellar secret key');
      }
    } else {
      // Assume it's a hex private key
      privateKey = input;
    }

    privateKey = await encodeSensitiveTextAsync({ text: privateKey });

    return {
      privateKey,
    };
  }

  override async validateXprvt(_xprvt: string): Promise<IXprvtValidation> {
    return {
      isValid: false,
    };
  }

  override async validatePrivateKey(
    privateKey: string,
  ): Promise<IPrivateKeyValidation> {
    try {
      // Check if it's a Stellar secret key format (S...)
      if (privateKey.startsWith('S') && privateKey.length === 56) {
        const isValid = sdkStellar.isValidAddress(privateKey);
        return {
          isValid,
        };
      }

      // Check if it's a hex private key
      if (privateKey.length === 64) {
        return {
          isValid: true,
        };
      }
    } catch {
      // Invalid format
    }

    return {
      isValid: false,
    };
  }

  override async validateGeneralInput(
    params: IValidateGeneralInputParams,
  ): Promise<IGeneralInputValidation> {
    const { result } = await this.baseValidateGeneralInput(params);
    return result;
  }

  // Custom RPC Client
  private _getCustomClientCache = memoizee(
    async (url: string): Promise<ClientStellar> => {
      return new ClientStellar({
        networkId: this.networkId,
        backgroundApi: this.backgroundApi,
        customRpcUrl: url,
      });
    },
    {
      promise: true,
      maxAge: timerUtils.getTimeDurationMs({ seconds: 10 }),
      normalizer: ([url]) => {
        return `${this.networkId}-${url}`;
      },
    },
  );

  // ========== START: LOCAL DEVELOPMENT RPC SUPPORT ==========
  // Modified to check 'enabled' flag instead of 'isCustomNetwork'
  // Original code: if (rpcInfo?.isCustomNetwork) { ... }
  async getCustomClient(): Promise<ClientStellar | undefined> {
    const rpcInfo =
      await this.backgroundApi.serviceCustomRpc.getCustomRpcForNetwork(
        this.networkId,
      );

    if (rpcInfo?.rpc && rpcInfo?.enabled) {
      return this._getCustomClientCache(rpcInfo.rpc);
    }

    return undefined;
  }
  // ========== END: LOCAL DEVELOPMENT RPC SUPPORT ==========

  override async getCustomRpcEndpointStatus(
    params: IMeasureRpcStatusParams,
  ): Promise<IMeasureRpcStatusResult> {
    const rpcUrl = params.rpcUrl;
    if (!rpcUrl) {
      throw new OneKeyInternalError('Invalid rpc url');
    }

    try {
      const client = new ClientStellar({
        networkId: this.networkId,
        backgroundApi: this.backgroundApi,
        customRpcUrl: rpcUrl,
      });

      const start = performance.now();
      const ledger = await client.getLatestLedger();
      const responseTime = Math.floor(performance.now() - start);

      return {
        responseTime,
        bestBlockNumber: ledger.sequence,
      };
    } catch (error) {
      console.error('getCustomRpcEndpointStatus ERROR:', error);
      throw error;
    }
  }

  override async broadcastTransactionFromCustomRpc(
    params: IBroadcastTransactionByCustomRpcParams,
  ): Promise<ISignedTxPro> {
    const { customRpcInfo, signedTx } = params;
    const rpcUrl = customRpcInfo.rpc;
    if (!rpcUrl) {
      throw new OneKeyInternalError('Invalid rpc url');
    }

    const client = new ClientStellar({
      networkId: this.networkId,
      backgroundApi: this.backgroundApi,
      customRpcUrl: rpcUrl,
    });

    const txHash = await client.submitTransaction(signedTx.rawTx);

    console.log('broadcastTransaction END:', {
      txid: txHash,
      rawTx: signedTx.rawTx,
    });

    return {
      ...params.signedTx,
      txid: txHash,
    };
  }

  override async fetchAccountDetailsByRpc(
    params: IFetchServerAccountDetailsParams,
  ): Promise<IFetchServerAccountDetailsResponse> {
    const client = await this.getCustomClient();
    if (!client) {
      throw new OneKeyInternalError('No RPC url');
    }

    const accountInfo = await client.getAccountInfo(params.accountAddress);
    if (!accountInfo) {
      return {
        data: {
          data: {
            address: params.accountAddress,
            balance: '0',
            balanceParsed: '0',
            nonce: 0,
          },
        },
      };
    }

    const network = await this.getNetwork();
    const balance = new BigNumber(accountInfo.balance ?? '0').toFixed();
    const balanceParsed = new BigNumber(accountInfo.balance ?? '0')
      .shiftedBy(-network.decimals)
      .toFixed();

    return {
      data: {
        data: {
          address: params.accountAddress,
          balance,
          balanceParsed: balanceParsed,
          nonce: parseInt(accountInfo.sequence, 10),
        },
      },
    };
  }

  override async fetchTokenDetailsByRpc(
    params: IFetchServerTokenDetailParams,
  ): Promise<IFetchServerTokenDetailResponse> {
    const networkInfo = await this.getNetworkInfo();
    const network = await this.getNetwork();
    const client = await this.getCustomClient();

    if (!client) {
      throw new OneKeyInternalError('No RPC url');
    }

    const accountAddress = params.accountAddress;
    const hasAccountAddress = Boolean(accountAddress);
    const resp: (IFetchTokenDetailItem | undefined)[] = await Promise.all(
      params.contractList?.map(async (contract) => {
        if (contract === networkInfo.nativeTokenAddress) {
          let accountDetails:
            | IFetchServerAccountDetailsResponse['data']['data']
            | undefined;
          if (hasAccountAddress) {
            accountDetails = (
              await this.fetchAccountDetailsByRpc({
                accountAddress: accountAddress ?? '',
                networkId: params.networkId,
                accountId: params.accountId ?? '',
              })
            ).data.data;
          }

          const nativeItem: IFetchTokenDetailItem = {
            info: {
              decimals: network.decimals,
              name: network.shortname,
              symbol: network.symbol,
              address: networkInfo.nativeTokenAddress,
              logoURI: network.logoURI,
              networkId: network.id,
              isNative: true,
            },
            balance: accountDetails?.balance ?? '0',
            balanceParsed: accountDetails?.balanceParsed ?? '0',
            fiatValue: '0',
            price: 0,
          };

          return nativeItem;
        }

        // Parse token contract address: assetCode:assetIssuer
        const [assetCode, assetIssuer] = contract.split(':');
        if (!assetCode || !assetIssuer) {
          return undefined;
        }

        let balanceForAccount = '0';
        let balanceParsedForAccount = '0';

        if (hasAccountAddress) {
          const balances = await client.getTokenBalances(accountAddress ?? '');
          const tokenBalance = balances.find(
            (b) => b.asset_code === assetCode && b.asset_issuer === assetIssuer,
          );

          if (tokenBalance) {
            balanceForAccount = new BigNumber(tokenBalance.balance)
              .shiftedBy(SAC_TOKEN_DECIMALS)
              .decimalPlaces(0, BigNumber.ROUND_DOWN)
              .toFixed(0);
            balanceParsedForAccount = tokenBalance.balance;
          }
        }

        return {
          info: {
            decimals: SAC_TOKEN_DECIMALS, // Stellar standard decimals
            name: assetCode,
            symbol: assetCode,
            address: contract,
            networkId: network.id,
            logoURI: '',
            isNative: false,
          },
          balance: balanceForAccount,
          balanceParsed: balanceParsedForAccount,
          fiatValue: '0',
          price: 0,
        };
      }) ?? [],
    );

    const items = resp.filter((item): item is IFetchTokenDetailItem =>
      Boolean(item),
    );

    return {
      data: {
        data: items,
      },
    };
  }

  _parseAccountTokenArray(
    { networkId, accountAddress }: IFetchServerTokenListApiParams,
    accountTokenArray: IServerAccountTokenItem[],
  ): ITokenData {
    let fiatValue = BigNumber(0);
    const map: Record<string, ITokenFiat> = {};
    const data: IAccountToken[] = [];

    accountTokenArray.forEach((accountToken) => {
      if (!isNaN(Number(accountToken.fiatValue))) {
        fiatValue = fiatValue.plus(accountToken.fiatValue);
      }
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

      data.push({
        $key: key,
        ...accountToken?.info,
      } as IAccountToken);
    });

    return {
      map,
      data: orderBy(
        data,
        [
          // @ts-expect-error
          // eslint-disable-next-line @typescript-eslint/no-unsafe-return
          (item) => map?.[item.$key]?.order ?? 9999,
          (item) => item.isNative,
          (item) => +(map?.[item.$key]?.fiatValue ?? 0),
        ],
        ['asc', 'desc', 'desc'],
      ),
      keys: md5(
        `${networkId}__${
          isEmpty(map) ? '' : Object.keys(map).join(',')
        }__${JSON.stringify(data)}`,
      ),
      fiatValue: undefined,
    };
  }

  override async fetchTokenListByRpc(
    params: IFetchServerTokenListParams,
  ): Promise<IFetchServerTokenListResponse> {
    const client = await this.getCustomClient();
    if (!client) {
      throw new OneKeyInternalError('No RPC url');
    }

    const networkInfo = await this.getNetworkInfo();
    const tokenDetails = await this.fetchTokenDetailsByRpc({
      accountAddress: params.requestApiParams.accountAddress ?? '',
      networkId: params.requestApiParams.networkId,
      accountId: params.accountId ?? '',
      contractList: [networkInfo.nativeTokenAddress ?? ''],
    });

    const localNativeTokenInfo = await this.backgroundApi.serviceToken.getToken(
      {
        accountId: this.accountId,
        networkId: this.networkId,
        tokenIdOnNetwork: networkInfo.nativeTokenAddress ?? '',
      },
    );
    const accountTokenArray: IServerAccountTokenItem[] = [];

    // Add native token if available
    const nativeToken = tokenDetails.data.data[0];

    if (nativeToken?.info) {
      accountTokenArray.push({
        info: {
          decimals: nativeToken.info.decimals,
          name: nativeToken.info.name,
          symbol: nativeToken.info.symbol,
          address: nativeToken.info.address,
          logoURI: nativeToken.info.logoURI,
          isNative: true,
        },
        balance: nativeToken.balance,
        balanceParsed: new BigNumber(nativeToken.balanceParsed).toFixed(),
        fiatValue: '0',
        price: '0',
        price24h: 0,
      });
    } else if (localNativeTokenInfo) {
      // account not activated
      accountTokenArray.push({
        info: {
          decimals: localNativeTokenInfo.decimals,
          name: localNativeTokenInfo.name,
          symbol: localNativeTokenInfo.symbol,
          address: localNativeTokenInfo.address,
          logoURI: localNativeTokenInfo.logoURI,
          isNative: true,
        },
        balance: '0',
        balanceParsed: '0',
        fiatValue: '0',
        price: '0',
        price24h: 0,
      });
    }

    // Fetch additional token balances
    const balances = await client.getTokenBalances(
      params.requestApiParams.accountAddress ?? '',
    );
    for (const balance of balances) {
      if (SAC_TOKEN_ASSET_TYPES.includes(balance.asset_type)) {
        const contract = `${balance.asset_code}:${balance.asset_issuer}`;
        accountTokenArray.push({
          info: {
            decimals: SAC_TOKEN_DECIMALS,
            name: balance.asset_code,
            symbol: balance.asset_code,
            address: contract,
            logoURI: '',
            isNative: false,
          },
          balance: balance.balance,
          balanceParsed: new BigNumber(balance.balance)
            .shiftedBy(-SAC_TOKEN_DECIMALS)
            .toFixed(),
          fiatValue: '0',
          price: '0',
          price24h: 0,
        });
      }
    }

    const hiddenTokenSet = new Set(params.requestApiParams.hiddenTokens ?? []);
    const sortedAccountTokenArray = orderBy(
      accountTokenArray,
      [(item) => item.info?.isNative, (item) => +(item.fiatValue ?? 0)],
      ['desc', 'desc'],
    ).filter((n) => !hiddenTokenSet.has(n.info?.address ?? ''));

    const smallTokenArray: IServerAccountTokenItem[] = [];
    const riskTokenArray: IServerAccountTokenItem[] = [];

    const tokens = this._parseAccountTokenArray(
      params.requestApiParams,
      sortedAccountTokenArray,
    );
    const riskTokens = this._parseAccountTokenArray(
      params.requestApiParams,
      riskTokenArray,
    );
    const smallBalanceTokens = this._parseAccountTokenArray(
      params.requestApiParams,
      smallTokenArray,
    );

    return {
      data: {
        data: {
          tokens,
          riskTokens,
          smallBalanceTokens,
        },
      },
    };
  }

  override async estimateFeeByRpc(_params: {
    encodedTx?: IEncodedTx;
  }): Promise<IServerEstimateFeeResponse> {
    const client = await this.getCustomClient();
    if (!client) {
      throw new OneKeyInternalError('No RPC url');
    }

    const network = await this.getNetwork();
    const feeDecimals = network.decimals;
    const feeSymbol = network.symbol;

    // Get suggested fee from network
    const fee = await client.getSuggestedFee();

    // Convert fee from stroops to XLM for display
    const gasPrice = new BigNumber(fee)
      .shiftedBy(-feeDecimals)
      .toFixed()
      .toString();
    const operationCount = this._getOperationCountFromEncodedTx(
      _params.encodedTx as IEncodedTxStellar,
    );
    const gasLimit = operationCount.toString();

    return {
      data: {
        data: {
          isEIP1559: false,
          feeDecimals,
          feeSymbol,
          nativeDecimals: network.decimals,
          nativeSymbol: network.symbol,
          baseFee: '0',
          nativeTokenPrice: {
            price: 0,
            price24h: 0,
          },
          gas: [
            {
              gasPrice,
              gasLimitForDisplay: gasLimit,
              gasLimit,
            },
          ],
        },
      },
    };
  }

  private _getOperationCountFromEncodedTx(
    encodedTx?: IEncodedTxStellar,
  ): number {
    if (!encodedTx?.xdr || !encodedTx.networkPassphrase) {
      return 1;
    }
    try {
      const stellarTx = TransactionBuilder.fromXDR(
        encodedTx.xdr,
        encodedTx.networkPassphrase,
      );
      const operations =
        (stellarTx as any)?.innerTransaction?.operations ??
        (stellarTx as any)?.operations;
      return operations?.length ?? 1;
    } catch (error) {
      console.error('Failed to parse Stellar operations count', error);
      return 1;
    }
  }

  private _resolveStellarFeeFromFeeInfo(
    feeInfo?: IFeeInfoUnit,
    fallbackDecimals?: number,
  ): string | undefined {
    if (!feeInfo) {
      return undefined;
    }
    const decimals = feeInfo.common?.feeDecimals ?? fallbackDecimals ?? 0;
    const gasPrice = feeInfo.gas?.gasPrice;
    if (gasPrice) {
      const resolved = new BigNumber(gasPrice)
        .shiftedBy(decimals)
        .decimalPlaces(0, BigNumber.ROUND_CEIL)
        .toFixed();
      if (new BigNumber(resolved).gt(0)) {
        return resolved;
      }
    }
    const baseFee = feeInfo.common?.baseFee;
    if (baseFee) {
      const baseFeeBN = new BigNumber(baseFee);
      if (baseFeeBN.gt(0)) {
        if (baseFee.includes('.') || baseFeeBN.lt(1)) {
          return baseFeeBN
            .shiftedBy(decimals)
            .decimalPlaces(0, BigNumber.ROUND_CEIL)
            .toFixed();
        }
        return baseFeeBN.decimalPlaces(0, BigNumber.ROUND_CEIL).toFixed();
      }
    }
    return undefined;
  }
}
