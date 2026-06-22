import BigNumber from 'bignumber.js';

import type { IAddressQueryResult } from '@onekeyhq/kit/src/components/AddressInput';
import {
  backgroundClass,
  backgroundMethod,
  toastIfError,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import { parseRPCResponse } from '@onekeyhq/shared/src/request/utils';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { promiseAllSettledEnhanced } from '@onekeyhq/shared/src/utils/promiseUtils';
import type { INetworkAccount } from '@onekeyhq/shared/types/account';
import { ERequestWalletTypeEnum } from '@onekeyhq/shared/types/account';
import type {
  IAddressBadge,
  IFetchAccountDetailsParams,
  IFetchAccountDetailsResp,
  IQueryCheckAddressArgs,
  IServerAccountBadgeResp,
} from '@onekeyhq/shared/types/address';
import {
  EAddressInteractionStatus,
  EServerInteractedStatus,
} from '@onekeyhq/shared/types/address';
import { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';
import type { IResolveNameResp } from '@onekeyhq/shared/types/name';
import type {
  IProxyRequest,
  IProxyRequestItem,
  IProxyRequestParam,
  IProxyResponse,
  IRpcProxyResponse,
} from '@onekeyhq/shared/types/proxy';
import { EDecodedTxStatus } from '@onekeyhq/shared/types/tx';

import simpleDb from '../dbs/simple/simpleDb';
import {
  activeAccountValueAtom,
  currencyPersistAtom,
} from '../states/jotai/atoms';
import { vaultFactory } from '../vaults/factory';
import { mergeClaimedUtxos } from '../vaults/impls/btc/sdkBtc/findAddressUtils';

import ServiceBase from './ServiceBase';

import type { IDBUtxoAccount } from '../dbs/local/types';
import type BTCVault from '../vaults/impls/btc/Vault';

type IAccountBadgeResult = {
  isScam: boolean;
  isContract: boolean;
  isCex: boolean;
  interacted: EAddressInteractionStatus;
  addressLabel?: string;
  badges: IAddressBadge[];
  similarAddress?: string;
};

function emptyAccountBadgeResult(): IAccountBadgeResult {
  return {
    isScam: false,
    isContract: false,
    isCex: false,
    interacted: EAddressInteractionStatus.UNKNOWN,
    badges: [],
  };
}

// Merge multiple /badges responses (one per xpub on merge-derive chains)
// into a single result. Semantics:
//   - any-true wins for boolean risk flags (a scam/contract/cex match on
//     ANY derive path is significant)
//   - `interacted` is escalated from UNKNOWN → NOT_INTERACTED → INTERACTED
//     so we never demote a positive interaction on one path with a
//     negative on another
//   - `addressLabel` / `similarAddress` take the first non-empty response
//   - badges come only from responses whose own `interacted` matches the
//     merged status, so xpub-scoped "First transfer" / "Transferred" badges
//     cannot coexist in the final array (OK-53278). Address-scoped static
//     labels (OKX / Scam / CEX / ...) are present in every response, so they
//     still surface through the matching subset.
function mergeAccountBadgeResults(
  responses: IAccountBadgeResult[],
): IAccountBadgeResult {
  const merged = emptyAccountBadgeResult();

  for (const r of responses) {
    merged.isScam = merged.isScam || r.isScam;
    merged.isContract = merged.isContract || r.isContract;
    merged.isCex = merged.isCex || r.isCex;

    if (r.interacted === EAddressInteractionStatus.INTERACTED) {
      merged.interacted = EAddressInteractionStatus.INTERACTED;
    } else if (
      merged.interacted === EAddressInteractionStatus.UNKNOWN &&
      r.interacted === EAddressInteractionStatus.NOT_INTERACTED
    ) {
      merged.interacted = EAddressInteractionStatus.NOT_INTERACTED;
    }

    if (!merged.addressLabel && r.addressLabel) {
      merged.addressLabel = r.addressLabel;
    }
    if (!merged.similarAddress && r.similarAddress) {
      merged.similarAddress = r.similarAddress;
    }
  }

  const seenBadgeKeys = new Set<string>();
  for (const r of responses) {
    if (r.interacted === merged.interacted) {
      for (const badge of r.badges) {
        const key = `${badge.type ?? ''}:${badge.label ?? ''}`;
        if (!seenBadgeKeys.has(key)) {
          seenBadgeKeys.add(key);
          merged.badges.push(badge);
        }
      }
    }
  }

  return merged;
}

@backgroundClass()
class ServiceAccountProfile extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  private _pendingBadgeRequests = new Map<
    string,
    Promise<IAccountBadgeResult>
  >();

  _fetchAccountDetailsControllers: AbortController[] = [];

  @backgroundMethod()
  public async abortFetchAccountDetails() {
    this._fetchAccountDetailsControllers.forEach((controller) =>
      controller.abort(),
    );
    this._fetchAccountDetailsControllers = [];
  }

  @backgroundMethod()
  public async fetchAccountNativeBalance({
    account,
    networkId,
  }: {
    account: INetworkAccount;
    networkId: string;
  }) {
    let xpub: string | undefined = (account as IDBUtxoAccount)?.xpub;
    const vault = await vaultFactory.getChainOnlyVault({
      networkId,
    });
    xpub = await vault.getXpubFromAccount(account);

    // let cardanoPubKey: string | undefined;
    // if (networkId && networkUtils.getNetworkImpl({ networkId }) === IMPL_ADA) {
    //   cardanoPubKey = xpub;
    //   xpub = undefined;
    // }

    return this.fetchAccountInfo({
      accountId: account?.id || '',
      networkId,
      accountAddress:
        account?.addressDetail?.displayAddress || account?.address,
      xpub,
      // cardanoPubKey, // only for UTXO query, not for balance query
      withNetWorth: true,
    }).catch((e) => {
      throw e;
    });
  }

  @backgroundMethod()
  public async fetchAccountInfo(
    params: IFetchAccountDetailsParams & {
      accountAddress: string;
      xpub?: string;
    },
  ): Promise<IFetchAccountDetailsResp> {
    const vault = await vaultFactory.getVault({
      accountId: params.accountId,
      networkId: params.networkId,
    });
    const controller = new AbortController();
    this._fetchAccountDetailsControllers.push(controller);
    const resp = await vault.fetchAccountDetails({
      ...params,
      signal: controller.signal,
    });
    return resp.data.data;
  }

  @backgroundMethod()
  public async fetchAccountDetails(
    params: IFetchAccountDetailsParams,
  ): Promise<IFetchAccountDetailsResp> {
    const { accountId, networkId } = params;
    let accountAddress = params.accountAddress;
    let xpub: string | undefined;
    if (!accountAddress) {
      const [x, a] = await Promise.all([
        this.backgroundApi.serviceAccount.getAccountXpub({
          accountId,
          networkId,
        }),
        this.backgroundApi.serviceAccount.getAccountAddressForApi({
          accountId,
          networkId,
        }),
      ]);
      xpub = x;
      accountAddress = a;
    } else if (!params.queryByAddressOnly) {
      xpub = await this.backgroundApi.serviceAccount.getAccountXpub({
        accountId,
        networkId,
      });
    }

    const accountDetails = await this.fetchAccountInfo({
      ...params,
      accountAddress,
      xpub,
    });

    const vault = await vaultFactory.getVault({ networkId, accountId });
    return vault.fillAccountDetails({ accountDetails });
  }

  @backgroundMethod()
  async getAddressAccountBadge({
    networkId,
    fromAddress,
    toAddress,
    checkInteraction,
    xpub,
  }: {
    fromAddress?: string;
    networkId: string;
    toAddress: string;
    checkInteraction?: boolean;
    xpub?: string;
  }): Promise<{
    isScam: boolean;
    isContract: boolean;
    isCex: boolean;
    interacted: EAddressInteractionStatus;
    addressLabel?: string;
    badges: IAddressBadge[];
    similarAddress?: string;
  }> {
    const isCustomNetwork =
      await this.backgroundApi.serviceNetwork.isCustomNetwork({
        networkId,
      });
    if (isCustomNetwork) {
      return {
        isScam: false,
        isContract: false,
        isCex: false,
        interacted: EAddressInteractionStatus.UNKNOWN,
        badges: [],
      };
    }
    const client = await this.getClient(EServiceEndpointEnum.Wallet);
    try {
      const resp = await client.get<{
        data: IServerAccountBadgeResp;
      }>('/wallet/v1/account/badges', {
        params: {
          networkId,
          fromAddress,
          toAddress,
          checkInteraction,
          xpub,
        },
      });
      const {
        isContract,
        interacted,
        label: addressLabel,
        isScam,
        isCex,
        badges,
        similarAddress,
      } = resp.data.data;
      const statusMap: Record<
        EServerInteractedStatus,
        EAddressInteractionStatus
      > = {
        [EServerInteractedStatus.FALSE]:
          EAddressInteractionStatus.NOT_INTERACTED,
        [EServerInteractedStatus.TRUE]: EAddressInteractionStatus.INTERACTED,
        [EServerInteractedStatus.UNKNOWN]: EAddressInteractionStatus.UNKNOWN,
      };
      return {
        isScam: isScam ?? false,
        isContract: isContract ?? false,
        isCex: isCex ?? false,
        interacted: statusMap[interacted] ?? EAddressInteractionStatus.UNKNOWN,
        addressLabel,
        badges: badges ?? [],
        similarAddress,
      };
    } catch {
      return {
        isScam: false,
        isContract: false,
        isCex: false,
        interacted: EAddressInteractionStatus.UNKNOWN,
        badges: [],
      };
    }
  }

  // Dedup concurrent in-flight badge requests for the same address
  private async fetchBadgesDeduped({
    networkId,
    accountId,
    toAddress,
    checkInteractionStatus,
  }: {
    networkId: string;
    accountId?: string;
    toAddress: string;
    checkInteractionStatus?: boolean;
  }): Promise<IAccountBadgeResult> {
    const dedupKey = `${networkId}:${accountId ?? ''}:${toAddress.toLowerCase()}:${checkInteractionStatus ? '1' : '0'}`;

    const pending = this._pendingBadgeRequests.get(dedupKey);
    if (pending) {
      return pending;
    }

    const request = this._fetchBadgesUncached({
      networkId,
      accountId,
      toAddress,
      checkInteractionStatus,
    })
      .then((r) => {
        this._pendingBadgeRequests.delete(dedupKey);
        return r;
      })
      .catch((err) => {
        this._pendingBadgeRequests.delete(dedupKey);
        throw err;
      });

    this._pendingBadgeRequests.set(dedupKey, request);
    return request;
  }

  private async _fetchBadgesUncached({
    networkId,
    accountId,
    toAddress,
    checkInteractionStatus,
  }: {
    networkId: string;
    accountId?: string;
    toAddress: string;
    checkInteractionStatus?: boolean;
  }): Promise<IAccountBadgeResult> {
    const { serviceAccount } = this.backgroundApi;
    let fromAddress: string | undefined;
    if (accountId) {
      const acc = await serviceAccount.getAccount({
        networkId,
        accountId,
      });
      fromAddress = acc.address;
    }

    // Only fan-out across multiple xpubs when interaction status is needed.
    // Scam/CEX/contract badges are address-scoped and don't need xpub fan-out.
    const xpubEntries =
      checkInteractionStatus && accountId
        ? await serviceAccount.safeGetAccountXpubsForAllDeriveTypes({
            accountId,
            networkId,
          })
        : [];

    if (xpubEntries.length > 1) {
      const settled = await promiseAllSettledEnhanced(
        xpubEntries.map(
          (entry) => () =>
            this.getAddressAccountBadge({
              networkId,
              fromAddress,
              toAddress,
              xpub: entry.xpub,
            }),
        ),
        { continueOnError: true, concurrency: xpubEntries.length },
      );
      const responses = settled.filter((r): r is IAccountBadgeResult => !!r);
      return responses.length
        ? mergeAccountBadgeResults(responses)
        : emptyAccountBadgeResult();
    }

    return this.getAddressAccountBadge({
      networkId,
      fromAddress,
      toAddress,
      xpub: xpubEntries[0]?.xpub,
    });
  }

  private async checkAccountBadges({
    networkId,
    accountId,
    toAddress,
    fromAddress,
    checkInteractionStatus,
    checkAddressContract,
    result,
  }: {
    accountId?: string;
    fromAddress?: string;
    checkInteractionStatus?: boolean;
    checkAddressContract?: boolean;
    networkId: string;
    toAddress: string;
    result: IAddressQueryResult;
  }): Promise<void> {
    const merged = await this.fetchBadgesDeduped({
      networkId,
      accountId,
      toAddress,
      checkInteractionStatus,
    });

    const {
      isContract,
      interacted,
      addressLabel,
      isScam,
      isCex,
      badges,
      similarAddress,
    } = merged;
    if (
      checkInteractionStatus &&
      fromAddress &&
      toAddress.toLowerCase() !== fromAddress.toLowerCase()
    ) {
      result.addressInteractionStatus = interacted;
    }
    if (checkAddressContract) {
      result.isContract = isContract;
      result.addressLabel = addressLabel;
    }
    result.isScam = isScam;
    result.isCex = isCex;
    result.addressBadges = badges;
    result.similarAddress = similarAddress;
  }

  private async verifyCannotSendToSelf({
    networkId,
    accountId,
    accountAddress,
  }: {
    networkId: string;
    accountId: string;
    accountAddress: string;
  }): Promise<boolean> {
    const vault = await vaultFactory.getVault({ networkId, accountId });
    const vaultSettings = await vault.getVaultSettings();
    if (!vaultSettings.cannotSendToSelf) {
      return false;
    }
    const acc = await this.backgroundApi.serviceAccount.getAccount({
      networkId,
      accountId,
    });
    const addressValidation = await vault.validateAddress(accountAddress);
    return (
      acc.addressDetail.displayAddress === addressValidation.displayAddress
    );
  }

  @backgroundMethod()
  public async queryAddress({
    networkId,
    address: rawAddress,
    accountId,
    enableNameResolve,
    enableAddressBook,
    enableWalletName,
    enableAddressInteractionStatus,
    enableAddressContract,
    enableVerifySendFundToSelf,
    enableAllowListValidation,
    skipValidateAddress,
    enableAddressDeriveInfo,
    walletAccountItem,
    ignoreSimilarAddressInAddressBook,
    enableCheckSimilarAddressInAddressBook,
  }: IQueryCheckAddressArgs): Promise<IAddressQueryResult> {
    const { serviceValidator, serviceSetting } = this.backgroundApi;

    let address = rawAddress.trim();

    const result: IAddressQueryResult = {
      input: rawAddress,
    };

    try {
      const { displayAddress, isValid } =
        await this.backgroundApi.serviceValidator.localValidateAddress({
          networkId,
          address,
        });
      if (isValid) {
        address = displayAddress;
        result.validAddress = address;
      }
    } catch (_e) {
      // noop
    }

    if (!networkId) {
      return result;
    }

    if (!skipValidateAddress) {
      result.validStatus = await serviceValidator.validateAddress({
        networkId,
        address,
      });
    }

    if (enableNameResolve) {
      const vault = await vaultFactory.getChainOnlyVault({ networkId });
      const isDomain = await vault.checkIsDomainName({ name: address });
      if (isDomain) {
        await this.handleNameSolve(networkId, address, result);
      }
    }
    if (!skipValidateAddress && result.validStatus !== 'valid') {
      return result;
    }
    const resolveAddress = result.resolveAddress ?? address;
    if (enableVerifySendFundToSelf && accountId && resolveAddress) {
      const disableFundToSelf = await this.verifyCannotSendToSelf({
        networkId,
        accountId,
        accountAddress: resolveAddress,
      });
      if (disableFundToSelf) {
        result.validStatus = 'prohibit-send-to-self';
        return result;
      }
    }
    if (enableAddressBook && resolveAddress) {
      try {
        // handleAddressBookName
        const addressBookItem =
          await this.backgroundApi.serviceAddressBook.findItem({
            networkId: !networkUtils.isEvmNetwork({ networkId })
              ? networkId
              : undefined,
            address: resolveAddress,
          });
        result.addressBookId = addressBookItem?.id;
        result.isAllowListed = addressBookItem?.isAllowListed;
        result.addressNote = addressBookItem?.note;
        result.addressMemo = addressBookItem?.memo;
        if (addressBookItem?.name) {
          result.addressBookName = `${appLocale.intl.formatMessage({
            id: ETranslations.address_book_title,
          })} / ${addressBookItem?.name}`;
        }
      } catch (e) {
        console.error(e);
      }
    }

    if ((enableWalletName || enableAllowListValidation) && resolveAddress) {
      let walletAccountItems: {
        walletName: string;
        accountName: string;
        accountId: string;
        walletId?: string;
      }[] = [];

      try {
        // handleWalletAccountName
        walletAccountItems =
          await this.backgroundApi.serviceAccount.getAccountNameFromAddress({
            networkId,
            address: resolveAddress,
          });
      } catch (e) {
        console.error(e);
      }

      if (
        walletAccountItems.length === 0 &&
        walletAccountItem &&
        walletAccountItem.accountId &&
        walletAccountItem.walletName &&
        walletAccountItem.accountName
      ) {
        walletAccountItems = [walletAccountItem];
      }

      if (
        walletAccountItems.length === 0 &&
        networkUtils.isBTCNetwork(networkId)
      ) {
        walletAccountItems =
          await this.backgroundApi.serviceFreshAddress.getAccountNameFromFreshAddress(
            {
              address,
              networkId,
            },
          );
      }

      if (walletAccountItems.length > 0) {
        let item = walletAccountItems[0];
        try {
          if (accountId) {
            const account = await this.backgroundApi.serviceAccount.getAccount({
              accountId,
              networkId,
            });
            const accountItem = walletAccountItems.find(
              (a) =>
                account.indexedAccountId === a.accountId ||
                account.id === a.accountId,
            );
            if (accountItem) {
              item = accountItem;
            }

            // Fix the issue where an address can be both an HD/HW account and a watch-only account
            // When an address exists in both HD/HW wallet and watch-only wallet,
            // prioritize showing the HD/HW wallet name since it has higher security level.
            if (
              accountUtils.isWatchingAccount({ accountId: item.accountId }) ||
              accountUtils.isOthersAccount({ accountId: item.accountId })
            ) {
              const ownAccountItem = walletAccountItems.find((a) =>
                accountUtils.isOwnAccount({ accountId: a.accountId }),
              );
              if (ownAccountItem) {
                item = ownAccountItem;
              }
            }
          }
        } catch (e) {
          console.error(e);
          // pass
        }
        result.walletName = item.walletName;
        result.accountName = item.accountName;
        result.walletAccountName = `${item.walletName} / ${item.accountName}`;
        result.walletAccountId = item.accountId;
        result.walletId = item.walletId;
        if (enableAddressDeriveInfo) {
          const account =
            await this.backgroundApi.serviceAccount.getNetworkAccountsInSameIndexedAccountIdWithDeriveTypes(
              {
                networkId,
                indexedAccountId: item.accountId,
                excludeEmptyAccount: true,
              },
            );
          const matchedAccount = account.networkAccounts?.find(
            (a) => a.account?.address === resolveAddress,
          );
          if (matchedAccount) {
            result.addressDeriveInfo = matchedAccount.deriveInfo;
            result.addressDeriveType = matchedAccount.deriveType;
          }
        }
      }
    }
    if (
      resolveAddress &&
      (enableAddressContract || (enableAddressInteractionStatus && accountId))
    ) {
      let senderAddress: string | undefined;
      if (accountId) {
        try {
          const acc = await this.backgroundApi.serviceAccount.getAccount({
            networkId,
            accountId,
          });
          senderAddress = acc.address;
        } catch {
          // non-fatal
        }
      }
      await this.checkAccountBadges({
        networkId,
        accountId,
        toAddress: resolveAddress,
        fromAddress: senderAddress,
        checkAddressContract: enableAddressContract,
        checkInteractionStatus: Boolean(
          enableAddressInteractionStatus && accountId,
        ),
        result,
      });

      // For EVM networks, override interaction status with transfer-recipient data
      // so that cross-chain transfers are recognized as "previously transferred"
      // Skip if badges API already confirmed interaction
      if (
        enableAddressInteractionStatus &&
        accountId &&
        networkUtils.isEvmNetwork({ networkId }) &&
        result.addressInteractionStatus !== EAddressInteractionStatus.INTERACTED
      ) {
        try {
          const targetLower = resolveAddress.toLowerCase();
          let isInRecipients = false;

          // Use evm--1 (not current networkId) because the backend aggregates
          // all EVM chain transfer recipients under evm--1. This ensures an
          // address transferred to on Arbitrum is recognized as "interacted"
          // when sending on Ethereum mainnet (consistent with useRecentRecipientsData).
          const { data: recipients } =
            await this.backgroundApi.serviceHistory.fetchTransferRecipients({
              accountId,
              networkId: 'evm--1',
              limit: 10,
            });
          isInRecipients = recipients.some(
            (r) => r.address.toLowerCase() === targetLower,
          );

          if (!isInRecipients) {
            // Scope to current networkId instead of onekeyall to avoid
            // loading all-network history on every address input change
            const localTxs =
              await this.backgroundApi.serviceHistory.getAccountsLocalHistoryTxs(
                {
                  accountId,
                  networkId,
                  excludeTestNetwork: true,
                },
              );
            for (const tx of localTxs) {
              const decodedTx = tx.decodedTx;
              if (!decodedTx) {
                // eslint-disable-next-line no-continue
                continue;
              }
              // Skip failed/dropped transactions to avoid false interaction status
              if (
                decodedTx.status === EDecodedTxStatus.Failed ||
                decodedTx.status === EDecodedTxStatus.Dropped
              ) {
                // eslint-disable-next-line no-continue
                continue;
              }
              const actions = decodedTx.actions;
              if (!actions) {
                // eslint-disable-next-line no-continue
                continue;
              }
              for (const action of actions) {
                const sends = action.assetTransfer?.sends;
                if (sends?.some((s) => s.to?.toLowerCase() === targetLower)) {
                  isInRecipients = true;
                  break;
                }
              }
              if (isInRecipients) break;
            }
          }

          if (isInRecipients) {
            result.addressInteractionStatus =
              EAddressInteractionStatus.INTERACTED;
            // Only override interaction status, never filter out warning/critical
            // badges — those may indicate phishing/sanctioned addresses
          }
        } catch {
          // Keep original badges API result on failure
        }
      }

      if (result.similarAddress && ignoreSimilarAddressInAddressBook) {
        if (result.addressBookId) {
          result.similarAddress = undefined;
        }
      }
    }

    if (
      !result.similarAddress &&
      !result.addressBookId &&
      !result.walletAccountId &&
      enableCheckSimilarAddressInAddressBook
    ) {
      const addressBookItems =
        await this.backgroundApi.serviceAddressBook.getItemsByNetwork({
          networkId: !networkUtils.isEvmNetwork({ networkId })
            ? networkId
            : undefined,
        });
      for (const item of addressBookItems) {
        if (accountUtils.isSimilarAddress(item.address, resolveAddress)) {
          result.similarAddress = item.address;
          break;
        }
      }
    }

    // Check if address is in allowlist
    if (enableAllowListValidation) {
      // Skip allowlist check if it's user's own account
      if (result.walletAccountId) {
        if (accountUtils.isOwnAccount({ accountId: result.walletAccountId })) {
          return result;
        }
      }

      // Skip allowlist check if it's in address book
      if (result.addressBookId) {
        return result;
      }

      // Check if address is in allowlist when allowlist feature is enabled
      const isEnableTransferAllowList =
        await serviceSetting.getIsEnableTransferAllowList();
      if (isEnableTransferAllowList && !result.isAllowListed) {
        result.validStatus = 'address-not-allowlist';
        return result;
      }
    }
    return result;
  }

  private async handleNameSolve(
    networkId: string,
    address: string,
    result: IAddressQueryResult,
  ) {
    const { serviceValidator } = this.backgroundApi;
    const vault = await vaultFactory.getChainOnlyVault({ networkId });
    let resolveNames: IResolveNameResp | null | undefined =
      await vault.resolveDomainName({
        name: address,
      });

    if (!resolveNames) {
      resolveNames = await this.backgroundApi.serviceNameResolver.resolveName({
        name: address,
        networkId,
      });
    }

    if (resolveNames && resolveNames.names?.length) {
      result.resolveAddress = resolveNames.names?.[0].value;
      result.resolveOptions = resolveNames.names?.map((o) => o.value);
      if (result.validStatus !== 'valid') {
        result.validStatus = await serviceValidator.validateAddress({
          networkId,
          address: result.resolveAddress,
        });
      }
    }
    return result;
  }

  @backgroundMethod()
  @toastIfError()
  async sendProxyRequest<T>({
    networkId,
    body,
    returnRawData,
    isJsonRpc,
  }: {
    networkId: string;
    body: IProxyRequestItem[];
    returnRawData?: boolean;
    isJsonRpc?: boolean;
  }): Promise<T[]> {
    const client = await this.getClient(EServiceEndpointEnum.Wallet);
    const request: IProxyRequest = { networkId, body };
    const resp = await client.post<IProxyResponse<T> | IRpcProxyResponse<T>>(
      '/wallet/v1/proxy/wallet',
      request,
    );

    if (isJsonRpc) {
      const data = resp.data.data.data as IRpcProxyResponse<T>['data']['data'];
      return Promise.all(data.map((item) => parseRPCResponse<T>(item)));
    }

    const data = resp.data.data.data as IProxyResponse<T>['data']['data'];
    const failedRequest = data.find((item) => !item.success);
    if (failedRequest) {
      if (returnRawData) {
        // @ts-expect-error
        return data;
      }
      throw new OneKeyLocalError(
        failedRequest.error ?? 'Failed to send proxy request',
      );
    }
    return data.map((item) => item.data);
  }

  @backgroundMethod()
  @toastIfError()
  async sendProxyRequestWithTrxRes<T>({
    networkId,
    body,
    returnRawData,
  }: {
    networkId: string;
    body: IProxyRequestParam;
    returnRawData?: boolean;
  }): Promise<T> {
    const client = await this.getClient(EServiceEndpointEnum.Wallet);
    const request: {
      networkId: string;
    } & IProxyRequestParam = { networkId, ...body };
    const resp = await client.post<IProxyResponse<T> | IRpcProxyResponse<T>>(
      '/wallet/v1/proxy/trxres',
      request,
    );

    if (returnRawData) {
      return resp.data as T;
    }

    if (resp.data.code !== 0) {
      throw new OneKeyLocalError(
        resp.data.message ?? 'Failed to send proxy request with trx res',
      );
    }

    return resp.data.data as T;
  }

  // Resolve a (accountId, networkId) to its on-chain identifiers used as
  // the SimpleDb key. Returns null when either lookup fails so callers can
  // skip the write/read gracefully.
  private async resolveAddressKey({
    accountId,
    networkId,
  }: {
    accountId: string;
    networkId: string;
  }): Promise<{ accountAddress?: string; xpub?: string } | null> {
    try {
      const [xpub, accountAddress] = await Promise.all([
        this.backgroundApi.serviceAccount.getAccountXpub({
          accountId,
          networkId,
        }),
        this.backgroundApi.serviceAccount.getAccountAddressForApi({
          accountId,
          networkId,
        }),
      ]);
      if (!xpub && !accountAddress) {
        return null;
      }
      return { accountAddress, xpub };
    } catch {
      return null;
    }
  }

  private async convertOneToUsd(value: string, currency: string) {
    if (currency === 'usd') return value;
    const currencyMap = (await currencyPersistAtom.get()).currencyMap;
    const info = currencyMap[currency];
    if (!info) {
      throw new OneKeyLocalError('Currency not found');
    }
    return new BigNumber(value).div(new BigNumber(info.value)).toFixed();
  }

  private async convertMapToUsd(
    value: Record<string, string>,
    currency: string,
  ): Promise<Record<string, string>> {
    if (currency === 'usd') return value;
    const currencyMap = (await currencyPersistAtom.get()).currencyMap;
    const info = currencyMap[currency];
    if (!info) {
      throw new OneKeyLocalError('Currency not found');
    }
    return Object.entries(value).reduce<Record<string, string>>(
      (acc, [k, v]) => {
        acc[k] = new BigNumber(v).div(new BigNumber(info.value)).toFixed();
        return acc;
      },
      {},
    );
  }

  @backgroundMethod()
  async updateAllNetworkAccountValue(params: {
    accountId: string;
    // Record<accountValueKey, value> where accountValueKey = `${networkAccount.id}_${networkId}`,
    // produced by accountUtils.buildAccountValueKey in UI layer.
    value: Record<string, string>;
    currency: string;
    updateAll?: boolean;
  }) {
    const { currency, value, updateAll, accountId } = params;

    const usdValueMap = await this.convertMapToUsd(value, currency);

    // Atom snapshot stays in the compound-key shape because consumers look
    // entries up via `buildAccountValueKey(accountId, networkId)`.
    type IWriteItem = {
      accountAddress?: string;
      xpub?: string;
      networkId: string;
      value: string;
    };
    const resolveCache = new Map<
      string,
      Promise<{ accountAddress?: string; xpub?: string } | null>
    >();
    const resolved = await Promise.all(
      Object.entries(usdValueMap).map<Promise<IWriteItem | null>>(
        async ([accountValueKey, usdValue]) => {
          const parsed = accountUtils.parseAccountValueKey({
            key: accountValueKey,
          });
          if (!parsed.accountId || !parsed.networkId) return null;
          const cacheKey = `${parsed.accountId}:${parsed.networkId}`;
          let pending = resolveCache.get(cacheKey);
          if (!pending) {
            pending = this.resolveAddressKey({
              accountId: parsed.accountId,
              networkId: parsed.networkId,
            });
            resolveCache.set(cacheKey, pending);
          }
          const r = await pending;
          if (!r) return null;
          return {
            accountAddress: r.accountAddress,
            xpub: r.xpub,
            networkId: parsed.networkId,
            value: usdValue,
          };
        },
      ),
    );
    const writeItems = resolved.filter((x): x is IWriteItem => x !== null);

    if (updateAll) {
      await activeAccountValueAtom.set({
        accountId,
        value: usdValueMap,
        currency: 'usd',
      });
    } else {
      const current = await activeAccountValueAtom.get();
      const mergedAtomValue =
        current?.accountId === accountId &&
        typeof current.value === 'object' &&
        current.value !== null
          ? {
              ...current.value,
              ...usdValueMap,
            }
          : usdValueMap;
      await activeAccountValueAtom.set({
        accountId,
        value: mergedAtomValue,
        currency: 'usd',
      });
    }

    await simpleDb.accountValue.updateAllNetworkAccountValue({
      items: writeItems,
      currency: 'usd',
      updateAll,
    });

    // Check DEPOSIT task for rookie guide (fire-and-forget)
    void this.backgroundApi.serviceRookieGuide.checkAndRecordDepositTask(
      accountId,
    );
  }

  @backgroundMethod()
  async getAllNetworkAccountsValue(params: {
    accounts: {
      accountId: string;
      networkId?: string;
      indexedAccountId?: string;
      accountAddress?: string;
      xpub?: string;
    }[];
  }) {
    const items = await Promise.all(
      params.accounts.map(async (a) => {
        if (a.accountAddress || a.xpub) {
          return { accountAddress: a.accountAddress, xpub: a.xpub };
        }
        if (a.networkId) {
          const resolved = await this.resolveAddressKey({
            accountId: a.accountId,
            networkId: a.networkId,
          });
          if (resolved) {
            return {
              accountAddress: resolved.accountAddress,
              xpub: resolved.xpub,
            };
          }
        }
        return {} as { accountAddress?: string; xpub?: string };
      }),
    );

    const values = await simpleDb.accountValue.getAllNetworkAccountsValue({
      items,
    });

    return params.accounts.map((a, i) => ({
      accountId: a.accountId,
      value: values[i]?.value,
      currency: values[i]?.currency,
    }));
  }

  // Aggregate "All Networks" worth for a single indexedAccount when the caller
  // doesn't already know each network's address.
  @backgroundMethod()
  async getAllNetworkAccountsValueByIndexedAccount(params: {
    indexedAccountId: string;
  }) {
    const { indexedAccountId } = params;
    try {
      const { accounts: dbAccounts } =
        await this.backgroundApi.serviceAccount.getAccountsInSameIndexedAccountId(
          { indexedAccountId },
        );

      const items: { accountAddress?: string; xpub?: string }[] = [];
      const seen = new Set<string>();
      for (const acc of dbAccounts ?? []) {
        const xpub = accountUtils.pickXpubFromDBAccount(acc);
        if (acc.address || xpub) {
          const ak = accountUtils.buildAccountLocalAssetsKey({
            accountAddress: acc.address,
            xpub,
          });
          if (!seen.has(ak)) {
            seen.add(ak);
            items.push({ accountAddress: acc.address, xpub });
          }
        }
      }

      if (items.length === 0) {
        return {
          accountId: indexedAccountId,
          value: undefined,
          currency: undefined,
        };
      }

      const entries = await simpleDb.accountValue.getAllNetworkAccountsValue({
        items,
      });

      // Sum (not overwrite) per networkId across entries. Multiple address-keyed
      // entries under one indexed account commonly share a networkId — e.g. BTC
      // native / nested / taproot all writing to `btc--0--0` from different
      // xpubs — so the aggregate must add them, not pick whichever was iterated
      // last.
      const mergedValue: Record<string, string> = {};
      let currency: 'usd' | undefined;
      for (const entry of entries) {
        if (entry?.value) {
          for (const [nId, v] of Object.entries(entry.value)) {
            const prev = mergedValue[nId];
            mergedValue[nId] = prev
              ? new BigNumber(prev).plus(v ?? '0').toFixed()
              : v;
          }
          currency = entry.currency;
        }
      }

      if (Object.keys(mergedValue).length === 0) {
        return {
          accountId: indexedAccountId,
          value: undefined,
          currency: undefined,
        };
      }

      return {
        accountId: indexedAccountId,
        value: mergedValue,
        currency,
      };
    } catch {
      return {
        accountId: indexedAccountId,
        value: undefined,
        currency: undefined,
      };
    }
  }

  // Returns worth for a specific (accountAddress, xpub) pair, shaped as
  // `Record<${networkAccountId}_${networkId}, value>` with the caller-supplied
  // `networkAccountId` as the compound-key prefix. SimpleDb entries are keyed
  // only by (address, xpub), so identical-address rows from different wallets
  // read the same entry; the per-wallet prefix only re-labels the output key.
  @backgroundMethod()
  async getAllNetworkAccountsValueByAddress(params: {
    networkAccountId: string;
    accountAddress?: string;
    xpub?: string;
  }) {
    const { networkAccountId, accountAddress, xpub } = params;
    const empty = {
      accountId: networkAccountId,
      value: undefined as Record<string, string> | undefined,
      currency: undefined as 'usd' | undefined,
    };
    if (!accountAddress && !xpub) {
      return empty;
    }
    try {
      const [entry] = await simpleDb.accountValue.getAllNetworkAccountsValue({
        items: [{ accountAddress, xpub }],
      });
      if (!entry?.value || Object.keys(entry.value).length === 0) {
        return empty;
      }
      const value: Record<string, string> = {};
      for (const [networkId, v] of Object.entries(entry.value)) {
        const compoundKey = accountUtils.buildAccountValueKey({
          accountId: networkAccountId,
          networkId,
        });
        value[compoundKey] = v;
      }
      return { accountId: networkAccountId, value, currency: entry.currency };
    } catch {
      return empty;
    }
  }

  // Batched variant of `getAllNetworkAccountsValueByAccountId` for callers
  // like the account selector that resolve worth for tens of accounts at a
  // time. Folds the per-account `simpleDb.accountValue.getAllNetworkAccountsValue`
  // call into a single read (the SimpleDb entity has caching disabled, so
  // each per-account call previously paid a fresh storage deserialization).
  @backgroundMethod()
  async getAllNetworkAccountsValueByAccountIdBatch(params: {
    accounts: {
      accountId: string;
      accountAddress?: string;
      xpub?: string;
    }[];
  }): Promise<
    Array<{
      accountId: string;
      value: Record<string, string> | undefined;
      currency: 'usd' | undefined;
    }>
  > {
    const { accounts } = params;
    if (!accounts.length) return [];

    type IResolved = {
      ownerAccountId: string;
      // Account id used as the compound-key prefix. For Others, this is the
      // owner accountId; for HD, it is the per-derive dbAccount.id so the
      // deriveType filter and merge-derive-assets paths keep working.
      compoundKeyAccountId: string;
      accountAddress?: string;
      xpub?: string;
    };
    const resolved: IResolved[] = [];

    await Promise.all(
      accounts.map(async (a) => {
        if (!a.accountId) return;
        try {
          if (accountUtils.isOthersAccount({ accountId: a.accountId })) {
            // Others: reuse pre-resolved address/xpub if upstream supplied
            // it, otherwise fetch the dbAccount once.
            if (a.accountAddress || a.xpub) {
              resolved.push({
                ownerAccountId: a.accountId,
                compoundKeyAccountId: a.accountId,
                accountAddress: a.accountAddress,
                xpub: a.xpub,
              });
              return;
            }
            const acc =
              await this.backgroundApi.serviceAccount.getDBAccountSafe({
                accountId: a.accountId,
              });
            const xpub = accountUtils.pickXpubFromDBAccount(acc);
            if (acc && (acc.address || xpub)) {
              resolved.push({
                ownerAccountId: a.accountId,
                compoundKeyAccountId: a.accountId,
                accountAddress: acc.address,
                xpub,
              });
            }
            return;
          }

          // HD/HW indexed account: expand to all derives so ChainSelector
          // can use per-derive compound keys.
          const { accounts: dbAccountsList } =
            await this.backgroundApi.serviceAccount.getAccountsInSameIndexedAccountId(
              { indexedAccountId: a.accountId },
            );
          for (const dbAcc of dbAccountsList ?? []) {
            const xpub = accountUtils.pickXpubFromDBAccount(dbAcc);
            if (dbAcc.address || xpub) {
              resolved.push({
                ownerAccountId: a.accountId,
                compoundKeyAccountId: dbAcc.id,
                accountAddress: dbAcc.address,
                xpub,
              });
            }
          }
        } catch {
          // Skip this account; its slot in the result will fall back to
          // the empty shape below.
        }
      }),
    );

    if (resolved.length === 0) {
      return accounts.map((a) => ({
        accountId: a.accountId,
        value: undefined,
        currency: undefined,
      }));
    }

    // Single SimpleDb read for the whole batch.
    const entries = await simpleDb.accountValue.getAllNetworkAccountsValue({
      items: resolved.map((r) => ({
        accountAddress: r.accountAddress,
        xpub: r.xpub,
      })),
    });

    const grouped = new Map<
      string,
      { value: Record<string, string>; currency?: 'usd' }
    >();
    resolved.forEach((r, i) => {
      const entry = entries[i];
      if (!entry?.value) return;
      let agg = grouped.get(r.ownerAccountId);
      if (!agg) {
        agg = { value: {} };
        grouped.set(r.ownerAccountId, agg);
      }
      for (const [nId, v] of Object.entries(entry.value)) {
        const compoundKey = accountUtils.buildAccountValueKey({
          accountId: r.compoundKeyAccountId,
          networkId: nId,
        });
        agg.value[compoundKey] = v;
      }
      agg.currency = entry.currency;
    });

    return accounts.map((a) => {
      const g = grouped.get(a.accountId);
      const hasValue = g && Object.keys(g.value).length > 0;
      return {
        accountId: a.accountId,
        value: hasValue ? g.value : undefined,
        currency: g?.currency,
      } as {
        accountId: string;
        value: Record<string, string> | undefined;
        currency: 'usd' | undefined;
      };
    });
  }

  // Returns per-network worth for a logical account in the compound-key shape
  // `Record<${networkAccountId}_${networkId}, value>` consumed by
  // `sortChainSelectorNetworksByValue` and `ChainSelector.tsx`. For HD/HW the
  // compound prefix is the per-derive `dbAccount.id` so the deriveType filter
  // and merge-derive-assets paths keep working.
  @backgroundMethod()
  async getAllNetworkAccountsValueByAccountId(params: { accountId: string }) {
    const { accountId } = params;
    const empty = {
      accountId,
      value: undefined as Record<string, string> | undefined,
      currency: undefined as 'usd' | undefined,
    };
    if (!accountId) {
      return empty;
    }

    try {
      if (accountUtils.isOthersAccount({ accountId })) {
        const account =
          await this.backgroundApi.serviceAccount.getDBAccountSafe({
            accountId,
          });
        const xpub = accountUtils.pickXpubFromDBAccount(account);
        if (!account || (!account.address && !xpub)) {
          return empty;
        }
        const [entry] = await simpleDb.accountValue.getAllNetworkAccountsValue({
          items: [{ accountAddress: account.address, xpub }],
        });
        if (!entry?.value || Object.keys(entry.value).length === 0) {
          return empty;
        }
        const value: Record<string, string> = {};
        for (const [networkId, v] of Object.entries(entry.value)) {
          const compoundKey = accountUtils.buildAccountValueKey({
            accountId,
            networkId,
          });
          value[compoundKey] = v;
        }
        return { accountId, value, currency: entry.currency };
      }

      // HD/HW indexed account path.
      const { accounts: dbAccounts } =
        await this.backgroundApi.serviceAccount.getAccountsInSameIndexedAccountId(
          { indexedAccountId: accountId },
        );

      const items: {
        dbAccountId: string;
        accountAddress?: string;
        xpub?: string;
      }[] = [];
      for (const acc of dbAccounts ?? []) {
        const xpub = accountUtils.pickXpubFromDBAccount(acc);
        if (acc.address || xpub) {
          items.push({
            dbAccountId: acc.id,
            accountAddress: acc.address,
            xpub,
          });
        }
      }
      if (items.length === 0) {
        return empty;
      }

      const entries = await simpleDb.accountValue.getAllNetworkAccountsValue({
        items: items.map((i) => ({
          accountAddress: i.accountAddress,
          xpub: i.xpub,
        })),
      });

      const value: Record<string, string> = {};
      let currency: 'usd' | undefined;
      entries.forEach((entry, idx) => {
        if (!entry?.value) return;
        const dbAccountId = items[idx].dbAccountId;
        for (const [networkId, v] of Object.entries(entry.value)) {
          const compoundKey = accountUtils.buildAccountValueKey({
            accountId: dbAccountId,
            networkId,
          });
          value[compoundKey] = v;
        }
        currency = entry.currency;
      });

      if (Object.keys(value).length === 0) {
        return empty;
      }
      return { accountId, value, currency };
    } catch {
      return empty;
    }
  }

  @backgroundMethod()
  async getAccountsValue(params: {
    accounts: {
      accountId: string;
      networkId: string;
      accountAddress?: string;
      xpub?: string;
    }[];
  }) {
    const items = await Promise.all(
      params.accounts.map(async (a) => {
        if (a.accountAddress || a.xpub) {
          return {
            networkId: a.networkId,
            accountAddress: a.accountAddress,
            xpub: a.xpub,
          };
        }
        const resolved = await this.resolveAddressKey({
          accountId: a.accountId,
          networkId: a.networkId,
        });
        if (resolved) {
          return {
            networkId: a.networkId,
            accountAddress: resolved.accountAddress,
            xpub: resolved.xpub,
          };
        }
        return { networkId: a.networkId };
      }),
    );

    const values = await simpleDb.accountValue.getAccountsValue({ items });

    return params.accounts.map((a, i) => ({
      accountId: a.accountId,
      value: values[i]?.value,
      currency: values[i]?.currency,
    }));
  }

  @backgroundMethod()
  async updateAccountValue(params: {
    // Logical account id for the activeAccountValueAtom — indexedAccountId for
    // HD/HW, account.id for Others (matches the account selector's keying).
    accountId: string;
    // The active networkAccount's account.id; required because HD/HW callers
    // pass indexedAccountId as `accountId` which can't resolve a chain address.
    networkAccountId: string;
    networkId: string;
    value: string;
    currency: string;
    shouldUpdateActiveAccountValue?: boolean;
  }) {
    if (params.shouldUpdateActiveAccountValue) {
      await activeAccountValueAtom.set({
        accountId: params.accountId,
        value: params.value,
        currency: params.currency,
      });
    }

    const usdValue = await this.convertOneToUsd(params.value, params.currency);
    const resolved = await this.resolveAddressKey({
      accountId: params.networkAccountId,
      networkId: params.networkId,
    });
    if (!resolved) return;

    await simpleDb.accountValue.updateAccountValue({
      networkId: params.networkId,
      accountAddress: resolved.accountAddress,
      xpub: resolved.xpub,
      value: usdValue,
      currency: 'usd',
    });
  }

  @backgroundMethod()
  async updateAccountValueForSingleNetwork(params: {
    accountId: string;
    networkAccountId: string;
    networkId: string;
    value: string;
    currency: string;
  }) {
    const resolved = await this.resolveAddressKey({
      accountId: params.networkAccountId,
      networkId: params.networkId,
    });
    if (!resolved) return;

    const [existing] = await simpleDb.accountValue.getAccountsValue({
      items: [
        {
          networkId: params.networkId,
          accountAddress: resolved.accountAddress,
          xpub: resolved.xpub,
        },
      ],
    });

    const usdValue = await this.convertOneToUsd(params.value, params.currency);
    if (
      existing?.value &&
      usdValue &&
      new BigNumber(usdValue).lte(existing.value)
    ) {
      return;
    }
    await this.updateAccountValue(params);
  }

  @backgroundMethod()
  async isSoftwareWalletOnlyUser() {
    const hwQrWallets =
      await this.backgroundApi.serviceAccount.getAllHwQrWalletWithDevice({
        filterHiddenWallet: true,
      });
    return Object.keys(hwQrWallets).length === 0;
  }

  @backgroundMethod()
  public async getAccountUtxos({
    accountId,
    networkId,
    includeClaimedAddresses,
  }: {
    accountId: string;
    networkId: string;
    // btc find-address feature: opt-in display of claimed off-gap UTXOs,
    // they are never included by default
    includeClaimedAddresses?: boolean;
  }) {
    const vault = await vaultFactory.getVault({
      networkId,
      accountId,
    });
    const vaultSettings = await vault.getVaultSettings();
    if (!vaultSettings.coinControlEnabled) {
      throw new OneKeyLocalError(
        'CoinControl is not supported for this network',
      );
    }
    const btcVault = vault as BTCVault;
    const { utxoList } = await btcVault._collectUTXOsInfoByApi();

    if (!includeClaimedAddresses) {
      return utxoList;
    }

    const { utxoList: claimedUtxos } =
      await btcVault._collectClaimedUtxosInfo();
    return mergeClaimedUtxos({ poolUtxos: utxoList, claimedUtxos });
  }

  // Get wallet type
  // hd
  // private-key
  // watched-only
  // hw-classic
  // hw-classic1s
  // hw-mini
  // hw-touch
  // hw-pro
  // url
  // third-party
  async _getWalletTypeHeader(params: {
    walletId?: string;
    otherWalletId?: string;
    accountId?: string;
  }) {
    return {
      'X-OneKey-Wallet-Type': await this._getRequestWalletType(params),
    };
  }

  async _getRequestWalletType({
    walletId,
    accountId,
  }: {
    walletId?: string;
    otherWalletId?: string;
    accountId?: string;
  }) {
    if (walletId) {
      if (accountUtils.isKeylessWallet({ walletId })) {
        return ERequestWalletTypeEnum.KEYLESS_WALLET;
      }
      if (accountUtils.isHdWallet({ walletId })) {
        return ERequestWalletTypeEnum.HD;
      }
      if (accountUtils.isImportedWallet({ walletId })) {
        return ERequestWalletTypeEnum.PRIVATE_KEY;
      }
      if (accountUtils.isWatchingWallet({ walletId })) {
        return ERequestWalletTypeEnum.WATCHED_ONLY;
      }
      if (accountUtils.isExternalWallet({ walletId })) {
        return ERequestWalletTypeEnum.THIRD_PARTY;
      }
      if (accountUtils.isHwWallet({ walletId })) {
        // TODO: fetch device type
        return ERequestWalletTypeEnum.HW;
      }
      if (accountUtils.isQrWallet({ walletId })) {
        return ERequestWalletTypeEnum.HW_QRCODE;
      }
    }
    if (accountId) {
      if (accountUtils.isKeylessAccount({ accountId })) {
        return ERequestWalletTypeEnum.KEYLESS_WALLET;
      }
      if (accountUtils.isHdAccount({ accountId })) {
        return ERequestWalletTypeEnum.HD;
      }
      // urlAccount must be checked before watchAccount
      if (accountUtils.isUrlAccountFn({ accountId })) {
        return ERequestWalletTypeEnum.URL;
      }
      if (accountUtils.isImportedAccount({ accountId })) {
        return ERequestWalletTypeEnum.PRIVATE_KEY;
      }
      if (accountUtils.isWatchingAccount({ accountId })) {
        return ERequestWalletTypeEnum.WATCHED_ONLY;
      }
      if (accountUtils.isExternalAccount({ accountId })) {
        return ERequestWalletTypeEnum.THIRD_PARTY;
      }
      if (accountUtils.isHwAccount({ accountId })) {
        // TODO: fetch device type
        return ERequestWalletTypeEnum.HW;
      }
      if (accountUtils.isQrAccount({ accountId })) {
        return ERequestWalletTypeEnum.HW_QRCODE;
      }
    }
    return ERequestWalletTypeEnum.UNKNOWN;
  }
}

export default ServiceAccountProfile;
