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

import simpleDb from '../dbs/simple/simpleDb';
import {
  activeAccountValueAtom,
  currencyPersistAtom,
} from '../states/jotai/atoms';
import { vaultFactory } from '../vaults/factory';

import ServiceBase from './ServiceBase';

import type { IDBUtxoAccount } from '../dbs/local/types';

@backgroundClass()
class ServiceAccountProfile extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

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
    } else {
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
  }: {
    fromAddress?: string;
    networkId: string;
    toAddress: string;
  }): Promise<{
    isScam: boolean;
    isContract: boolean;
    isCex: boolean;
    interacted: EAddressInteractionStatus;
    addressLabel?: string;
    badges: IAddressBadge[];
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
        },
      });
      const {
        isContract,
        interacted,
        label: addressLabel,
        isScam,
        isCex,
        badges,
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

  private async checkAccountBadges({
    networkId,
    accountId,
    toAddress,
    checkInteractionStatus,
    checkAddressContract,
    result,
  }: {
    accountId?: string;
    checkInteractionStatus?: boolean;
    checkAddressContract?: boolean;
    networkId: string;
    toAddress: string;
    result: IAddressQueryResult;
  }): Promise<void> {
    let fromAddress: string | undefined;
    if (accountId) {
      const acc = await this.backgroundApi.serviceAccount.getAccount({
        networkId,
        accountId,
      });
      fromAddress = acc.address;
    }
    const { isContract, interacted, addressLabel, isScam, isCex, badges } =
      await this.getAddressAccountBadge({
        networkId,
        fromAddress,
        toAddress,
      });
    if (
      checkInteractionStatus &&
      toAddress.toLowerCase() !== fromAddress &&
      fromAddress
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
    } catch (e) {
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
        const password =
          await this.backgroundApi.servicePassword.getCachedPassword();
        if (password) {
          // handleAddressBookName
          const addressBookItem =
            await this.backgroundApi.serviceAddressBook.findItem({
              networkId: !networkUtils.isEvmNetwork({ networkId })
                ? networkId
                : undefined,
              address: resolveAddress,
              password,
            });
          result.addressBookId = addressBookItem?.id;
          result.isAllowListed = addressBookItem?.isAllowListed;
          result.addressNote = addressBookItem?.note;
          result.addressMemo = addressBookItem?.memo;
          if (addressBookItem?.name) {
            result.addressBookName = `${appLocale.intl.formatMessage({
              id: ETranslations.global_contact,
            })} / ${addressBookItem?.name}`;
          }
        }
      } catch (e) {
        console.error(e);
      }
    }

    if (enableWalletName && resolveAddress) {
      let walletAccountItems: {
        walletName: string;
        accountName: string;
        accountId: string;
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
              const ownAccountItem = walletAccountItems.find((a) => {
                const accountParams = { accountId: a.accountId };
                return (
                  accountUtils.isHdAccount(accountParams) ||
                  accountUtils.isHwAccount(accountParams) ||
                  accountUtils.isQrAccount(accountParams) ||
                  accountUtils.isImportedAccount(accountParams)
                );
              });
              if (ownAccountItem) {
                item = ownAccountItem;
              }
            }
          }
        } catch (e) {
          console.error(e);
          // pass
        }
        result.walletAccountName = `${item.walletName} / ${item.accountName}`;
        result.walletAccountId = item.accountId;
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
      await this.checkAccountBadges({
        networkId,
        accountId,
        toAddress: resolveAddress,
        checkAddressContract: enableAddressContract,
        checkInteractionStatus: Boolean(
          enableAddressInteractionStatus && accountId,
        ),
        result,
      });
    }

    // Check if address is in allowlist
    if (enableAllowListValidation) {
      // Skip allowlist check if it's user's own account
      if (result.walletAccountId) {
        const accountParams = { accountId: result.walletAccountId };
        const isOwnAccount =
          accountUtils.isHdAccount(accountParams) ||
          accountUtils.isHwAccount(accountParams) ||
          accountUtils.isQrAccount(accountParams) ||
          accountUtils.isImportedAccount(accountParams);
        if (isOwnAccount) {
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
  }: {
    networkId: string;
    body: IProxyRequestParam;
  }): Promise<T> {
    const client = await this.getClient(EServiceEndpointEnum.Wallet);
    const request: {
      networkId: string;
    } & IProxyRequestParam = { networkId, ...body };
    const resp = await client.post<IProxyResponse<T> | IRpcProxyResponse<T>>(
      '/wallet/v1/proxy/trxres',
      request,
    );

    if (resp.data.code !== 0) {
      throw new OneKeyLocalError(
        resp.data.message ?? 'Failed to send proxy request with trx res',
      );
    }

    return resp.data.data as T;
  }

  @backgroundMethod()
  async updateAllNetworkAccountValue(params: {
    accountId: string;
    value: Record<string, string>;
    currency: string;
    updateAll?: boolean;
  }) {
    const { currency, value, updateAll } = params;

    const currencyMap = (await currencyPersistAtom.get()).currencyMap;

    let usdValue: Record<string, string> = value;

    if (currency !== 'usd') {
      const currencyInfo = currencyMap[currency];

      if (!currencyInfo) {
        throw new OneKeyLocalError('Currency not found');
      }
      usdValue = Object.entries(value).reduce((acc, [n, v]) => {
        acc[n] = new BigNumber(v)
          .div(new BigNumber(currencyInfo.value))
          .toFixed();
        return acc;
      }, {} as Record<string, string>);
    }

    const usdAccountValue = {
      ...params,
      value: usdValue,
      currency: 'usd',
    };

    if (updateAll) {
      await activeAccountValueAtom.set(usdAccountValue);
    } else {
      const accountsValue =
        await simpleDb.accountValue.getAllNetworkAccountsValue({
          accounts: [{ accountId: params.accountId }],
        });
      const currentAccountValue = accountsValue?.[0];
      if (currentAccountValue?.accountId !== params.accountId) {
        return;
      }

      await activeAccountValueAtom.set({
        ...usdAccountValue,
        value: {
          ...currentAccountValue.value,
          ...usdValue,
        },
      });
    }

    await simpleDb.accountValue.updateAllNetworkAccountValue(usdAccountValue);
  }

  @backgroundMethod()
  async getAllNetworkAccountsValue(params: {
    accounts: { accountId: string }[];
  }) {
    const accountsValue =
      await simpleDb.accountValue.getAllNetworkAccountsValue(params);
    return accountsValue;
  }

  @backgroundMethod()
  async getAccountsValue(params: { accounts: { accountId: string }[] }) {
    const accountsValue = await simpleDb.accountValue.getAccountsValue(params);
    return accountsValue;
  }

  @backgroundMethod()
  async updateAccountValue(params: {
    accountId: string;
    value: string;
    currency: string;
    shouldUpdateActiveAccountValue?: boolean;
  }) {
    if (params.shouldUpdateActiveAccountValue) {
      await activeAccountValueAtom.set(params);
    }

    await simpleDb.accountValue.updateAccountValue(params);
  }

  @backgroundMethod()
  async updateAccountValueForSingleNetwork(params: {
    accountId: string;
    value: string;
    currency: string;
  }) {
    const accountsValue = await simpleDb.accountValue.getAccountsValue({
      accounts: [{ accountId: params.accountId }],
    });
    const currentAccountValue = accountsValue?.[0];
    if (currentAccountValue?.accountId !== params.accountId) {
      return;
    }
    if (
      currentAccountValue?.currency &&
      params.currency &&
      currentAccountValue?.currency !== params.currency
    ) {
      return;
    }
    if (
      currentAccountValue?.value &&
      params.value &&
      new BigNumber(params.value).lte(currentAccountValue.value)
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
