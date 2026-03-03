import BigNumber from 'bignumber.js';
import { md5 } from 'js-md5';
import { isEmpty, isNaN, orderBy } from 'lodash';

import type { StellarSdk } from '@onekeyhq/core/src/chains/stellar/sdkStellar';
import type {
  IEncodedTxStellar,
  IStellarAsset,
} from '@onekeyhq/core/src/chains/stellar/types';
import { assembleTransaction } from '@onekeyhq/core/src/chains/stellar/utils/transaction';
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
  InvalidAccount,
  ManageTokenInsufficientBalanceError,
  OneKeyInternalError,
} from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
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
  Operation,
  StrKey,
  TransactionBuilder,
} from './sdkStellar';
import ClientStellar from './sdkStellar/ClientStellar';
import { EStellarAssetType } from './types';
import {
  BASE_FEE,
  ENTRY_RESERVE,
  MEMO_TEXT_MAX_BYTES,
  SAC_TOKEN_ASSET_TYPES,
  SAC_TOKEN_DECIMALS,
  buildMemoFromString,
  calculateAvailableBalance,
  calculateFrozenBalance,
  getNetworkPassphrase,
  getUtf8ByteLength,
  isValidAccountCreationAmount,
  parseTokenAddress,
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
  IUpdateUnsignedTxParams,
  IValidateGeneralInputParams,
} from '../../types';

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

  async getClient() {
    const customClient = await this.getCustomClient();
    if (customClient) {
      return customClient;
    }
    return this._getClientCache();
  }

  /**
   * Get network passphrase based on current networkId
   * Uses the utility function from utils.ts
   */
  async getNetworkPassphrase(): Promise<string> {
    return getNetworkPassphrase(this.networkId);
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
    const { from, assetCode, assetIssuer, limit } = params;

    const client = await this.getClient();

    // Get account sequence
    const fromAccountInfo = await client.getAccountInfo(from);
    if (!fromAccountInfo) {
      throw new InvalidAccount({
        key: ETranslations.feedback_address_not_activated_message,
      });
    }

    // Get network passphrase
    const networkPassphrase = getNetworkPassphrase(this.networkId);

    // Get suggested fee
    const fee = await client.getSuggestedFee();

    // Create account object
    const sourceAccount = new Account(from, fromAccountInfo.sequence);

    // Build transaction
    const transactionBuilder = new TransactionBuilder(sourceAccount, {
      fee,
      networkPassphrase,
    });

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
    transactionBuilder.setTimeout(
      timerUtils.getTimeDurationMs({ minute: 5 }) / 1000,
    );

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
  override async activateToken(params: { token: IAccountToken }): Promise<{
    token?: IAccountToken;
    isActivated: boolean;
  }> {
    const { token } = params;

    // Native XLM doesn't need activation
    if (token.isNative) {
      return Promise.resolve({ isActivated: true });
    }

    const dbAccount = await this.getAccount();
    const network = await this.getNetwork();
    const client = await this.getClient();

    const tokenAddressParsed = parseTokenAddress(token.address);

    let stellarAssetContractAddress: string | undefined;
    if (
      tokenAddressParsed.type === EStellarAssetType.ContractToken &&
      tokenAddressParsed.contractId
    ) {
      const contractTokenInfo = await client.getContractTokenInfo(
        tokenAddressParsed.contractId,
      );
      if (!contractTokenInfo) {
        throw new OneKeyInternalError('Contract token info not found');
      }
      const { symbol, admin, type } = contractTokenInfo;
      if (type === EStellarAssetType.ContractToken) {
        return Promise.resolve({ isActivated: true });
      }
      stellarAssetContractAddress = `${symbol}:${admin ?? ''}`;
      token.name = symbol;
      token.address = stellarAssetContractAddress;
    }

    const [assetCode, assetIssuer] = (
      stellarAssetContractAddress ?? token.address
    ).split(':');

    const hasTrustline = await client.hasTrustline(
      dbAccount.address,
      assetCode,
      assetIssuer,
    );
    const accountInfo = await client.getAccountInfo(dbAccount.address);
    if (!accountInfo) {
      throw new InvalidAccount();
    }

    if (hasTrustline) {
      return Promise.resolve({ isActivated: true });
    }

    const { available } = calculateAvailableBalance({
      balance: accountInfo.balance,
      numSubEntries: accountInfo.subentry_count,
    });
    const availableBalance = new BigNumber(available);
    const reserveRequired = new BigNumber(ENTRY_RESERVE).shiftedBy(
      network.decimals,
    );
    const feeRequired = new BigNumber(BASE_FEE);
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

      // await tx confirmed
      await client.waitForTransaction(signedTx.signedTx.txid);
      return { token, isActivated: !!signedTx.signedTx.txid };
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
    const isToMuxed = StrKey.isValidMed25519PublicKey(to);

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
      throw new InvalidAccount();
    }

    // Check if destination account exists
    const toAccountExists = await client.accountExists(to);

    // Get network passphrase
    const networkPassphrase = getNetworkPassphrase(this.networkId);

    // Get suggested fee or use default
    const fee = await client.getSuggestedFee();

    // Create account object
    const sourceAccount = new Account(from, fromAccountInfo.sequence);

    // Build transaction
    let transactionBuilder = new TransactionBuilder(sourceAccount, {
      fee,
      networkPassphrase,
    });

    // Add memo if provided
    const memoField = buildMemoFromString(transferInfo.memo);
    if (memoField) {
      transactionBuilder.addMemo(memoField);
    }

    // Set timeout
    transactionBuilder.setTimeout(
      timerUtils.getTimeDurationMs({ minute: 5 }) / 1000,
    );

    // Add operation based on account existence and token type
    if (tokenInfo.isNative) {
      // Native XLM transfer
      const amountInXlm = new BigNumber(amount).toFixed(network.decimals);

      if (!toAccountExists) {
        if (isToMuxed) {
          throw new OneKeyInternalError(
            'Cannot create account with a muxed (M...) address',
          );
        }
        // Use createAccount for non-existent accounts
        if (!isValidAccountCreationAmount(amountInXlm)) {
          throw new OneKeyInternalError({
            key: ETranslations.send_stellar_activation_minimum_hint,
          });
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
        throw new OneKeyInternalError({
          key: ETranslations.send_stellar_recipient_account_not_activated,
        });
      }

      // Parse token address to determine if it's classic or contract
      const tokenAddressParsed = parseTokenAddress(tokenInfo.address);

      if (tokenAddressParsed.type === 'contract') {
        // Contract Token (Soroban Token) transfer
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const contractId = tokenAddressParsed.contractId!;
        const amountFormatted = new BigNumber(amount)
          .shiftedBy(tokenInfo.decimals)
          .toFixed();

        // Build Soroban contract invocation for token transfer
        // Using invokeContractFunction to call contract's transfer function
        const fromAddress = new sdkStellar.StellarSdk.Address(from);
        const toAddress = new sdkStellar.StellarSdk.Address(to);

        transactionBuilder.addOperation(
          sdkStellar.StellarSdk.Operation.invokeContractFunction({
            contract: contractId,
            function: 'transfer',
            args: [
              fromAddress.toScVal(),
              toAddress.toScVal(),
              sdkStellar.StellarSdk.nativeToScVal(amountFormatted, {
                type: 'i128',
              }),
            ],
          }),
        );

        const transaction = transactionBuilder.build();
        const simulation = await client.simulateTransaction(
          transaction.toXDR(),
        );

        if (!simulation.minResourceFee || !simulation.transactionData) {
          throw new OneKeyInternalError('Soroban simulation failed');
        }

        const authEntry = simulation.results?.flatMap((result) => {
          return result.auth.map((auth) => {
            return sdkStellar.StellarSdk.xdr.SorobanAuthorizationEntry.fromXDR(
              Buffer.from(auth, 'base64'),
            );
          });
        });

        transactionBuilder = assembleTransaction(transaction, {
          minResourceFee: simulation.minResourceFee,
          transactionData: simulation.transactionData,
          auth: authEntry ?? [],
        });
      } else if (
        tokenAddressParsed.type === EStellarAssetType.StellarAsset &&
        tokenAddressParsed.code &&
        tokenAddressParsed.issuer
      ) {
        // Classic Asset transfer
        const assetCode = tokenAddressParsed.code;
        const assetIssuer = tokenAddressParsed.issuer;

        // Check if destination has trustline
        const hasTrustline = await client.hasTrustline(
          to,
          assetCode,
          assetIssuer,
        );

        if (!hasTrustline) {
          throw new OneKeyInternalError({
            key: ETranslations.send_recipient_token_not_activated,
          });
        }

        const asset = new Asset(assetCode, assetIssuer);
        const amountBN = new BigNumber(amount);
        if (amountBN.isZero() || !amountBN.isPositive()) {
          throw new OneKeyInternalError({
            key: ETranslations.send_cannot_send_amount_zero,
          });
        }
        const amountFormatted = amountBN.toFixed(tokenInfo.decimals);

        transactionBuilder.addOperation(
          Operation.payment({
            destination: to,
            asset,
            amount: amountFormatted,
          }),
        );
      } else {
        throw new OneKeyInternalError(
          `Invalid token address: ${tokenInfo.address}`,
        );
      }
    }

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
        const paymentOp = op;
        const from = paymentOp.source ?? tx.source ?? accountAddress;
        const to = paymentOp.destination;

        let tokenInfo = nativeToken;
        let tokenIdOnNetwork = nativeToken.address;
        let isNative = true;

        if (!paymentOp.asset.isNative()) {
          const assetInfo = this._convertAssetToIStellarAsset(paymentOp.asset);
          if (
            assetInfo.type === 'credit_alphanum4' ||
            assetInfo.type === 'credit_alphanum12'
          ) {
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
        const createAccountOp = op;
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
        const changeTrustOp = op;
        const assetLine = changeTrustOp.line;
        if (assetLine instanceof Asset) {
          const assetInfo = this._convertAssetToIStellarAsset(assetLine);
          if (
            assetInfo.type === 'credit_alphanum4' ||
            assetInfo.type === 'credit_alphanum12'
          ) {
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
      } else if (op.type === 'invokeHostFunction') {
        // Handle Soroban contract calls
        const invokeOp = op;
        const decodedContractCall = this._decodeContractCall(invokeOp);

        if (decodedContractCall?.isTokenTransfer) {
          const {
            contractId,
            from: transferFrom,
            to: transferTo,
            amount: transferAmount,
          } = decodedContractCall;
          const tokenIdOnNetwork = contractId;
          const tokenInfo = await ensureTokenInfo(tokenIdOnNetwork, {
            address: tokenIdOnNetwork,
            decimals: SAC_TOKEN_DECIMALS,
            logoURI: '',
            name: contractId.substring(0, 8), // Fallback name
            symbol: contractId.substring(0, 6), // Fallback symbol
            isNative: false,
          });

          const transfer: IDecodedTxTransferInfo = {
            from: transferFrom,
            to: transferTo,
            amount: new BigNumber(transferAmount)
              .shiftedBy(-tokenInfo.decimals)
              .toFixed(),
            tokenIdOnNetwork,
            icon: tokenInfo.logoURI ?? '',
            name: tokenInfo.name,
            symbol: tokenInfo.symbol,
            isNFT: false,
            isNative: false,
          };

          // eslint-disable-next-line no-await-in-loop
          action = await this.buildTxTransferAssetAction({
            from: transferFrom,
            to: transferTo,
            transfers: [transfer],
          });
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

  override async attachFeeInfoToDAppEncodedTx(_params: {
    encodedTx: IEncodedTx;
    feeInfo: IFeeInfoUnit;
  }): Promise<IEncodedTx> {
    // dApp not edit fee
    return Promise.resolve('');
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

    return unsignedTx;
  }

  override async updateUnsignedTx(
    params: IUpdateUnsignedTxParams,
  ): Promise<IUnsignedTxPro> {
    const { unsignedTx, nativeAmountInfo, feeInfo, nonceInfo } = params;
    const encodedTx = unsignedTx.encodedTx as IEncodedTxStellar;

    // dApp transactions should not be modified - they have already been simulated
    // with proper Soroban resource data
    if (encodedTx.isFromDapp) {
      return unsignedTx;
    }

    // If nothing to update, return original
    if (!nativeAmountInfo && !feeInfo && !nonceInfo) {
      return unsignedTx;
    }

    // For local transactions, we can rebuild with updated parameters
    // Use the original transfersInfo to rebuild the transaction
    if (unsignedTx.transfersInfo && unsignedTx.transfersInfo.length > 0) {
      const transfersInfo = unsignedTx.transfersInfo;

      // Update amount if provided
      if (nativeAmountInfo) {
        const newAmount =
          nativeAmountInfo.maxSendAmount ?? nativeAmountInfo.amount;
        if (newAmount) {
          transfersInfo[0] = {
            ...transfersInfo[0],
            amount: newAmount,
          };
        }
      }

      // Rebuild the transaction with updated parameters
      const newEncodedTx = (await this.buildEncodedTx({
        transfersInfo,
      })) as IEncodedTxStellar;

      unsignedTx.encodedTx = newEncodedTx;
    }

    return unsignedTx;
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
      return { type: 'native' };
    }
    const code = asset.getCode();
    const issuer = asset.getIssuer();
    return {
      type: code.length <= 4 ? 'credit_alphanum4' : 'credit_alphanum12',
      code,
      issuer,
    };
  }

  /**
   * Decode Soroban contract call to extract transfer information
   */
  private _decodeContractCall(op: StellarSdk.Operation.InvokeHostFunction): {
    isTokenTransfer: boolean;
    contractId: string;
    from: string;
    to: string;
    amount: string;
  } | null {
    try {
      // Extract contract address and function from the HostFunction
      const hostFunction = op.func;

      // Check if this is an invokeContract call
      if (hostFunction.switch().name !== 'hostFunctionTypeInvokeContract') {
        return null;
      }

      const invokeContract = hostFunction.invokeContract();
      const contractAddress = invokeContract.contractAddress();
      const functionName = invokeContract.functionName();
      const args = invokeContract.args();

      // Check if this is a 'transfer' function call
      const functionNameStr = functionName.toString('utf8');
      if (functionNameStr !== 'transfer') {
        return null;
      }

      // Parse contract address
      const contractId = sdkStellar.StellarSdk.StrKey.encodeContract(
        contractAddress.contractId() as unknown as Buffer,
      );

      // Extract transfer parameters: from, to, amount
      if (args.length < 3) {
        return null;
      }

      const fromScVal = args[0];
      const toScVal = args[1];
      const amountScVal = args[2];

      // Convert ScVal to native values
      const fromAddress = this._scValToAddress(fromScVal);
      const toAddress = this._scValToAddress(toScVal);
      const amount = this._scValToAmount(amountScVal);

      if (!fromAddress || !toAddress || !amount) {
        return null;
      }

      return {
        isTokenTransfer: true,
        contractId,
        from: fromAddress,
        to: toAddress,
        amount,
      };
    } catch (error) {
      console.error('Failed to decode contract call:', error);
      return null;
    }
  }

  /**
   * Convert ScVal (Soroban Value) to Stellar address string
   */
  private _scValToAddress(scVal: StellarSdk.xdr.ScVal): string | null {
    try {
      const address = sdkStellar.StellarSdk.Address.fromScVal(scVal);
      return address.toString();
    } catch {
      return null;
    }
  }

  /**
   * Convert ScVal to amount string
   */
  private _scValToAmount(scVal: StellarSdk.xdr.ScVal): string | null {
    try {
      // Try to convert to i128 or u128
      const value = sdkStellar.StellarSdk.scValToBigInt(scVal);
      return value.toString();
    } catch {
      return null;
    }
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

    try {
      const secretBuffer = sdkStellar.decodeSecretKey(input);
      privateKey = bufferUtils.bytesToHex(secretBuffer);
    } catch {
      throw new OneKeyInternalError('Invalid Stellar secret key');
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
      if (sdkStellar.StrKey.isValidEd25519SecretSeed(privateKey)) {
        return { isValid: true };
      }
      // hex private key
      // if (privateKey.length === 64) {
      //   return { isValid: /^[0-9a-fA-F]+$/.test(privateKey) };
      // }
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

  override async validateMemo(memo: string): Promise<{
    isValid: boolean;
    errorMessage?: string;
  }> {
    if (!memo || !memo.trim()) {
      return { isValid: true }; // Empty memo is valid
    }

    const trimmed = memo.trim();

    // Text memo: check byte length
    const byteLength = getUtf8ByteLength(trimmed);
    if (byteLength > MEMO_TEXT_MAX_BYTES) {
      return {
        isValid: false,
        errorMessage: appLocale.intl.formatMessage(
          { id: ETranslations.send_memo_size_exceeded },
          {
            limit: MEMO_TEXT_MAX_BYTES,
            current: byteLength,
            type: 'Bytes',
          },
        ),
      };
    }

    return { isValid: true };
  }

  // ========== LOCAL DEVELOPMENT RPC SUPPORT ==========
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

  private async getCustomClient(): Promise<ClientStellar | undefined> {
    const rpcInfo =
      await this.backgroundApi.serviceCustomRpc.getCustomRpcForNetwork(
        this.networkId,
      );

    if (rpcInfo?.rpc && rpcInfo?.enabled) {
      return this._getCustomClientCache(rpcInfo.rpc);
    }

    return undefined;
  }

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

    const frozenBalance = calculateFrozenBalance({
      numSubEntries: accountInfo.subentry_count,
    });
    const frozenBalanceParsed = new BigNumber(frozenBalance)
      .shiftedBy(-network.decimals)
      .toFixed();

    const balance = BigNumber.max(
      new BigNumber(accountInfo.balance ?? '0').minus(frozenBalance),
      0,
    ).toFixed();
    const balanceParsed = new BigNumber(balance)
      .shiftedBy(-network.decimals)
      .toFixed();

    return {
      data: {
        data: {
          address: params.accountAddress,
          balance,
          balanceParsed,
          nonce: parseInt(accountInfo.sequence, 10),
          frozenBalance,
          frozenBalanceParsed,
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
    const contractList = params.contractList ?? [];

    // Separate classic assets and contract tokens
    const classicAssetList: Array<{ assetCode: string; assetIssuer: string }> =
      [];
    const contractTokenList: string[] = [];

    for (const contract of contractList) {
      if (!contract || contract === networkInfo.nativeTokenAddress) {
        // eslint-disable-next-line no-continue
        continue;
      }

      const parsed = parseTokenAddress(contract);
      if (parsed.type === 'contract') {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        contractTokenList.push(parsed.contractId!);
      } else if (parsed.type === 'classic') {
        classicAssetList.push({
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          assetCode: parsed.code!,
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          assetIssuer: parsed.issuer!,
        });
      }
    }

    // Get classic asset balances
    const tokenBalances = hasAccountAddress
      ? await client.getStellarAssetBalances(
          accountAddress ?? '',
          classicAssetList,
        )
      : [];
    const balancesByContract = new Map(
      tokenBalances.map((balance) => [
        `${balance.asset_code}:${balance.asset_issuer}`,
        balance,
      ]),
    );

    // Get contract token balances
    const contractBalances =
      hasAccountAddress && contractTokenList.length > 0
        ? await client.getContractTokenBalances(
            accountAddress ?? '',
            contractTokenList,
          )
        : [];
    const balancesByContractId = new Map(
      contractBalances.map((b) => [b.contractId, b.balance]),
    );

    const resp: (IFetchTokenDetailItem | undefined)[] = await Promise.all(
      contractList?.map(async (contract) => {
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
            frozenBalance: accountDetails?.frozenBalance ?? '0',
            frozenBalanceParsed: accountDetails?.frozenBalanceParsed ?? '0',
            fiatValue: '0',
            price: 0,
          };

          return nativeItem;
        }

        // Parse token address to determine type
        const parsed = parseTokenAddress(contract);

        if (parsed.type === EStellarAssetType.ContractToken) {
          // Contract Token
          const contractTokenInfo = await client.getContractTokenInfo(
            parsed.contractId ?? '',
          );
          if (!contractTokenInfo) {
            return undefined;
          }
          const { name, symbol, decimals, admin, type } = contractTokenInfo;
          let balanceForAccount = '0';
          let balanceParsedForAccount = '0';

          if (hasAccountAddress) {
            const contractBalance = balancesByContractId.get(
              parsed.contractId ?? '',
            );
            if (contractBalance) {
              balanceForAccount = contractBalance;
              balanceParsedForAccount = new BigNumber(contractBalance)
                .shiftedBy(-decimals)
                .toFixed();
            }
          }

          let contractAddress = parsed.contractId;
          if (type === EStellarAssetType.StellarAssetContract) {
            contractAddress = `${symbol}:${admin ?? ''}`;
          }

          let tokenName = name;
          if (type === EStellarAssetType.StellarAssetContract) {
            tokenName = symbol;
          }

          return {
            info: {
              decimals,
              name: tokenName,
              symbol,
              address: contract,
              networkId: network.id,
              logoURI: '',
              isNative: false,
              stellarContractAddress: contractAddress,
              stellarTokenType: type,
            },
            balance: balanceForAccount,
            balanceParsed: balanceParsedForAccount,
            fiatValue: '0',
            price: 0,
          };
        }

        // Classic Asset
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const assetCode = parsed.code!;
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const assetIssuer = parsed.issuer!;

        let balanceForAccount = '0';
        let balanceParsedForAccount = '0';

        if (hasAccountAddress) {
          const tokenBalance = balancesByContract.get(
            `${assetCode}:${assetIssuer}`,
          );

          if (tokenBalance) {
            // tokenBalance.balance is already in smallest unit (stroops) from HorizonTransport
            balanceForAccount = tokenBalance.balance;
            balanceParsedForAccount = new BigNumber(tokenBalance.balance)
              .shiftedBy(-SAC_TOKEN_DECIMALS)
              .toFixed();
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
            stellarContractAddress: contract,
            stellarTokenType: EStellarAssetType.StellarAsset,
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
        frozenBalance: nativeToken.frozenBalance ?? '0',
        frozenBalanceParsed: nativeToken.frozenBalanceParsed ?? '0',
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
    const contractList = params.requestApiParams.contractList ?? [];
    const classicAssetList: Array<{ assetCode: string; assetIssuer: string }> =
      [];
    const contractTokenList: string[] = [];

    for (const contract of contractList) {
      if (!contract || contract === networkInfo.nativeTokenAddress) {
        // eslint-disable-next-line no-continue
        continue;
      }
      try {
        const parsed = parseTokenAddress(contract);
        if (parsed.type === EStellarAssetType.ContractToken) {
          if (parsed.contractId) {
            contractTokenList.push(parsed.contractId);
          }
        } else if (parsed.type === EStellarAssetType.StellarAsset) {
          if (parsed.code && parsed.issuer) {
            classicAssetList.push({
              assetCode: parsed.code,
              assetIssuer: parsed.issuer,
            });
          }
        }
      } catch {
        // Skip invalid token address format
      }
    }
    const balances = await client.getStellarAssetBalances(
      params.requestApiParams.accountAddress ?? '',
      classicAssetList.length ? classicAssetList : undefined,
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

    const contractBalances =
      contractTokenList.length > 0
        ? await client.getContractTokenBalances(
            params.requestApiParams.accountAddress ?? '',
            contractTokenList,
          )
        : [];
    const balancesByContractId = new Map(
      contractBalances.map((b) => [b.contractId, b.balance]),
    );
    const contractTokenInfos =
      contractTokenList.length > 0
        ? await Promise.all(
            contractTokenList.map(async (contractId) => ({
              contractId,
              info: await client.getContractTokenInfo(contractId),
            })),
          )
        : [];
    const tokenInfoByContractId = new Map(
      contractTokenInfos.map((item) => [item.contractId, item.info]),
    );
    for (const contractId of contractTokenList) {
      const contractTokenInfo = tokenInfoByContractId.get(contractId);
      if (!contractTokenInfo) {
        // eslint-disable-next-line no-continue
        continue;
      }

      const { name, symbol, decimals, type } = contractTokenInfo;
      const balance = balancesByContractId.get(contractId) ?? '0';
      let balanceParsed = '0';
      if (balance) {
        balanceParsed = new BigNumber(balance).shiftedBy(-decimals).toFixed();
      }

      let tokenName = name;
      if (type === EStellarAssetType.StellarAssetContract) {
        tokenName = symbol;
      }

      accountTokenArray.push({
        info: {
          decimals,
          name: tokenName,
          symbol,
          address: contractId,
          logoURI: '',
          isNative: false,
        },
        balance,
        balanceParsed,
        fiatValue: '0',
        price: '0',
        price24h: 0,
      });
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

    // Get suggested fee (per op) from network
    const fee = await client.getSuggestedFee();
    const encodedTx = _params.encodedTx as IEncodedTxStellar | undefined;
    const operationCount = this._getOperationCountFromEncodedTx(encodedTx);
    const safeOperationCount = Math.max(operationCount, 1);

    // If RPC supports simulateTransaction, include minResourceFee for Soroban txs
    let minResourceFee = new BigNumber(0);
    if (encodedTx?.xdr) {
      try {
        const simulateResult = await client.simulateTransaction(encodedTx.xdr);
        const minResourceFeeValue = simulateResult?.minResourceFee;
        if (minResourceFeeValue) {
          minResourceFee = new BigNumber(minResourceFeeValue).multipliedBy(1.1);
        }
      } catch (error) {
        // Fall back to fee stats only if simulation is unavailable or fails
        console.warn(
          'simulateTransaction failed, fallback to fee stats',
          error,
        );
      }
    }

    const feePerOp = new BigNumber(fee);
    const totalFeeStroops = feePerOp
      .multipliedBy(safeOperationCount)
      .plus(minResourceFee);
    const gasPriceStroops = totalFeeStroops
      .dividedBy(safeOperationCount)
      .decimalPlaces(0, BigNumber.ROUND_CEIL);

    // Convert fee from stroops to XLM for display
    const gasPrice = gasPriceStroops
      .shiftedBy(-feeDecimals)
      .toFixed()
      .toString();
    const gasLimit = safeOperationCount.toString();

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
      let operations: StellarSdk.Operation[] = [];
      if (stellarTx instanceof sdkStellar.StellarSdk.FeeBumpTransaction) {
        operations = stellarTx.innerTransaction.operations;
      } else {
        operations = stellarTx.operations;
      }
      return operations?.length ?? 1;
    } catch (error) {
      console.error('Failed to parse Stellar operations count', error);
      return 1;
    }
  }
}
