import { networkList } from '@onekeyfe/network-list';
import { pick } from 'lodash';
import semver from 'semver';

import { getWalletTypeFromAccountId } from '@onekeyhq/engine/src/managers/account';
import {
  getDBAccountTemplate,
  getDefaultAccountNameInfoByImpl,
  getImplByCoinType,
  migrateNextAccountIds,
} from '@onekeyhq/engine/src/managers/impl';
import { setAccountDerivationDbMigrationVersion } from '@onekeyhq/kit/src/store/reducers/settings';
import { updateAutoSwitchDefaultRpcAtVersion } from '@onekeyhq/kit/src/store/reducers/status';
import {
  backgroundClass,
  backgroundMethod,
  bindThis,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { fetchData } from '@onekeyhq/shared/src/background/backgroundUtils';
import {
  ACCOUNT_DERIVATION_DB_MIGRATION_VERSION,
  AUTO_SWITCH_DEFAULT_RPC_AT_VERSION,
  COINTYPE_COSMOS,
  COINTYPE_SUI,
  FIX_COSMOS_TEMPLATE_DB_MIGRATION_VERSION,
  IMPL_COSMOS,
  INDEX_PLACEHOLDER,
  enabledAccountDynamicNetworkIds,
} from '@onekeyhq/shared/src/engine/engineConsts';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import ServiceBase from './ServiceBase';

// should upate AUTO_SWITCH_DEFAULT_RPC_AT_VERSION version first
const defaultNetworkRpcs: Record<string, string> = {
  'aptos--1': 'https://fullnode.mainnet.aptoslabs.com',
  'bch--0': 'https://fiat.onekeycn.com/book/bch',
  'btc--0': 'https://rpc.onekey.so/btc/',
  'evm--1': 'https://mainnet.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161',
  'evm--10': 'https://mainnet.optimism.io',
  'evm--100': 'https://rpc.gnosischain.com',
  'evm--10001': 'https://mainnet.ethereumpow.org',
  'evm--128': 'https://http-mainnet.hecochain.com',
  'evm--1313161554': 'https://mainnet.aurora.dev',
  'evm--137': 'https://polygon-rpc.com',
  'evm--25': 'https://mmf-rpc.xstaking.sg',
  'evm--250': 'https://rpc.ftm.tools',
  'evm--288': 'https://mainnet.boba.network',
  'evm--42161': 'https://arb1.arbitrum.io/rpc',
  'evm--42220': 'https://rpc.ankr.com/celo',
  'evm--43114': 'https://api.avax.network/ext/bc/C/rpc',
  'evm--513100': 'https://rpc.etherfair.org',
  'evm--56': 'https://bsc-dataseed1.ninicoin.io',
  'evm--61': 'https://www.ethercluster.com/etc',
  'evm--66': 'https://exchainrpc.okex.org',
  'near--0': 'https://rpc.mainnet.near.org',
  'sol--101': 'https://solana-mainnet.phantom.tech/',
  'stc--1': 'https://main-seed.starcoin.org',
  'tron--0x2b6653dc': 'https://tron-mainnet.token.im',
  'ltc--0': 'https://fiat.onekeycn.com/book/ltc',
  'doge--0': 'https://fiat.onekeycn.com/book/doge',
  'cfx--1029': 'https://main.confluxrpc.com',
  'algo--4160': 'https://algosigner.api.purestake.io/mainnet/algod',
  'evm--73927': 'https://geth.mvm.dev',
  'cosmos--cosmoshub-4': 'https://lcd-cosmoshub.keplr.app',
  'cosmos--juno-1': 'https://lcd-juno.keplr.app',
  'cosmos--crypto-org-chain-mainnet-1':
    'https://api-cryptoorgchain-ia.cosmosia.notional.ventures',
  'cosmos--secret-4': 'https://lcd-secret.keplr.app/',
  'cosmos--akashnet-2': 'https://lcd-akash.keplr.app/',
  'cosmos--osmosis-1': 'https://lcd-osmosis.keplr.app/',
  'cosmos--fetchhub-4': 'https://lcd-fetchhub.keplr.app',
};

@backgroundClass()
export default class ServiceBootstrap extends ServiceBase {
  private fetchFiatTimer: NodeJS.Timeout | null = null;

  @bindThis()
  async preBootstrap() {
    // not use appSelector
    await this.removeDeprecatedNetworks();
  }

  @bindThis()
  bootstrap() {
    const {
      serviceOverview,
      serviceAccount,
      serviceToken,
      serviceNetwork,
      serviceSwap,
      serviceSetting,
      serviceOnboarding,
      serviceCloudBackup,
      serviceTranslation,
      serviceDiscover,
    } = this.backgroundApi;

    this.migrateAccountDerivationTable();
    this.migrateCosmosTemplateInDB();
    serviceToken.registerEvents();
    serviceOverview.registerEvents();
    serviceNetwork.registerEvents();
    serviceSwap.registerEvents();
    serviceAccount.registerEvents();

    this.syncAccounts();
    this.fetchFiatMoneyRate();
    this.switchDefaultRpcToOnekeyRpcNode();
    serviceOnboarding.checkOnboardingStatus();
    serviceSetting.updateRemoteSetting();
    serviceCloudBackup.initCloudBackup();
    serviceTranslation.getTranslations();
    serviceDiscover.getCompactList();
  }
  // eslint-disable-next-line
  @backgroundMethod()
  async checkShouldShowNotificationGuide(): Promise<boolean> {
    const { appSelector } = this.backgroundApi;
    const { accountId, pushNotification, guideToPushFirstTime, networkId } =
      appSelector((s) => ({
        accountId: s.general.activeAccountId,
        networkId: s.general.activeNetworkId,
        pushNotification: s.settings.pushNotification,
        guideToPushFirstTime: s.status.guideToPushFirstTime,
      }));
    if (!accountId) {
      return false;
    }
    if (!pushNotification) {
      return false;
    }
    const { pushEnable } = pushNotification;
    if (pushEnable) {
      return false;
    }
    if (guideToPushFirstTime) {
      return false;
    }
    if (!enabledAccountDynamicNetworkIds.includes(networkId || '')) {
      return false;
    }
    return true;
  }

  @backgroundMethod()
  async switchDefaultRpcToOnekeyRpcNode() {
    const { appSelector, dispatch, serviceNetwork } = this.backgroundApi;
    const { networks } = appSelector((s) => s.runtime);
    const { autoSwitchDefaultRpcAtVersion, userSwitchedNetworkRpcFlag } =
      appSelector((s) => s.status);

    if (
      autoSwitchDefaultRpcAtVersion &&
      semver.valid(autoSwitchDefaultRpcAtVersion) &&
      semver.gte(
        autoSwitchDefaultRpcAtVersion,
        AUTO_SWITCH_DEFAULT_RPC_AT_VERSION,
      )
    ) {
      return;
    }
    for (const n of networks) {
      const defaultRpc = defaultNetworkRpcs[n.id];
      const onekeyRpc = networkList.networks
        .find((item) => item.id === n.id)
        ?.rpcURLs?.find((rpc) =>
          rpc.url?.startsWith('https://node.onekey.so'),
        )?.url;
      const isUserSwitched = userSwitchedNetworkRpcFlag?.[n.id] ?? false;
      if (
        defaultRpc &&
        defaultRpc === n.rpcURL &&
        onekeyRpc &&
        !isUserSwitched
      ) {
        await serviceNetwork.updateNetwork(n.id, { rpcURL: onekeyRpc }, false);
      }
    }
    dispatch(
      updateAutoSwitchDefaultRpcAtVersion(AUTO_SWITCH_DEFAULT_RPC_AT_VERSION),
    );
  }

  @backgroundMethod()
  fetchFiatMoneyRate() {
    this.backgroundApi.serviceCronJob.getFiatMoney();
    if (!this.fetchFiatTimer) {
      this.fetchFiatTimer = setInterval(() => {
        this.backgroundApi.serviceCronJob.getFiatMoney();
      }, 5 * 60 * 1000);
    }
  }

  @backgroundMethod()
  async migrateAccountDerivationTable() {
    debugLogger.common.info('start migrate account derivation process ===>');
    try {
      const { appSelector } = this.backgroundApi;
      const dbMigrationVersion = appSelector(
        (s) => s.settings.accountDerivationDbMigrationVersion,
      );
      const appVersion = appSelector((s) => s.settings.version);
      if (
        dbMigrationVersion &&
        semver.valid(dbMigrationVersion) &&
        semver.gte(dbMigrationVersion, ACCOUNT_DERIVATION_DB_MIGRATION_VERSION)
      ) {
        debugLogger.common.info('Skip AccountDerivation DB migration');
        return;
      }

      debugLogger.common.info('will migrate ===>');
      const { dbApi } = this.backgroundApi.engine;
      const wallets = await dbApi.getWallets();
      const hdOrHwWallets = wallets.filter(
        (w) => w.id.startsWith('hd') || w.id.startsWith('hw'),
      );

      for (const wallet of hdOrHwWallets) {
        debugLogger.common.info(`migrate wallet: ${JSON.stringify(wallet)}`);
        // update accounts
        const accounts = await dbApi.getAccounts(wallet.accounts);
        for (const account of accounts) {
          if (!account.template) {
            const template = getDBAccountTemplate(account);
            const impl = getImplByCoinType(account.coinType);
            await dbApi.addAccountDerivation({
              walletId: wallet.id,
              accountId: account.id,
              impl,
              template,
            });
            debugLogger.common.info(
              `added account derivation: accountId: ${account.id}, template: ${template}`,
            );
            await dbApi.setAccountTemplate({ accountId: account.id, template });
            debugLogger.common.info(
              `insert account: ${account.id} to AccountDerivation table, template: ${template}`,
            );
          }
        }

        debugLogger.common.info(
          `migrate accounts finish, will update nextAccountId, walletId:  ${wallet.id}`,
        );

        // update nextAccountIds field
        const newNextAccountIds = migrateNextAccountIds(wallet.nextAccountIds);

        await dbApi.updateWalletNextAccountIds({
          walletId: wallet.id,
          nextAccountIds: newNextAccountIds,
        });
        debugLogger.common.info(
          `update wallet nextAccountIds, wallet: ${
            wallet.id
          }, nextAccountIds: ${JSON.stringify(newNextAccountIds)}`,
        );
      }
      this.backgroundApi.dispatch(
        setAccountDerivationDbMigrationVersion(appVersion),
      );
    } catch (e) {
      debugLogger.common.error('migrate error: ', e);
      throw e;
    }
  }

  @backgroundMethod()
  async migrateCosmosTemplateInDB() {
    debugLogger.common.info('start migrate cosmos template process');
    try {
      const { appSelector } = this.backgroundApi;
      const dbMigrationVersion = appSelector(
        (s) => s.settings.accountDerivationDbMigrationVersion,
      );
      const appVersion = appSelector((s) => s.settings.version);
      if (
        dbMigrationVersion &&
        semver.valid(dbMigrationVersion) &&
        semver.gte(dbMigrationVersion, FIX_COSMOS_TEMPLATE_DB_MIGRATION_VERSION)
      ) {
        debugLogger.common.info('Skip Cosmos Template migration');
        return;
      }

      const { dbApi } = this.backgroundApi.engine;
      const wallets = await dbApi.getWallets();
      const hdOrHwWallets = wallets.filter(
        (w) => w.id.startsWith('hd') || w.id.startsWith('hw'),
      );
      const incorrectTemplate = `m/44'/${COINTYPE_COSMOS}'/${INDEX_PLACEHOLDER}'/0/0`;
      for (const wallet of hdOrHwWallets) {
        debugLogger.common.info(`migrate wallet: ${JSON.stringify(wallet)}`);
        // filter cosmos account which template is m/44'/118'/0'/0/$$INDEX$$
        const cosmosAccounts = wallet.accounts.filter(
          (id) => id.indexOf(`m/44'/${COINTYPE_COSMOS}'/0'/0`) > -1,
        );
        const impl = getImplByCoinType(COINTYPE_COSMOS);
        const { template } = getDefaultAccountNameInfoByImpl(impl);
        const accounts = await dbApi.getAccounts(cosmosAccounts);
        for (const account of accounts) {
          if (
            account.template &&
            // find incorrect template
            account.template === incorrectTemplate
          ) {
            await dbApi.addAccountDerivation({
              walletId: wallet.id,
              accountId: account.id,
              impl,
              template,
            });
            debugLogger.common.info(
              `added account derivation: accountId: ${account.id}, template: ${template}`,
            );
            await dbApi.setAccountTemplate({ accountId: account.id, template });
            debugLogger.common.info(
              `insert account: ${account.id} to AccountDerivation table, template: ${template}`,
            );
          }
        }
        await dbApi.removeAccountDerivation({
          walletId: wallet.id,
          impl: IMPL_COSMOS,
          template: incorrectTemplate, // incorrect template
        });

        if (wallet.nextAccountIds?.[incorrectTemplate]) {
          // migrate incorrect template next account id to correct template
          const newNextAccountIds = {
            ...wallet.nextAccountIds,
            [template]: wallet.nextAccountIds[incorrectTemplate],
          };

          await dbApi.updateWalletNextAccountIds({
            walletId: wallet.id,
            nextAccountIds: newNextAccountIds,
          });
          debugLogger.common.info(
            `update wallet nextAccountIds, wallet: ${
              wallet.id
            }, nextAccountIds: ${JSON.stringify(newNextAccountIds)}`,
          );
        }
      }

      this.backgroundApi.dispatch(
        setAccountDerivationDbMigrationVersion(appVersion),
      );
    } catch (e) {
      debugLogger.common.error('cosmos template migrate error: ', e);
      throw e;
    }
  }

  @backgroundMethod()
  async syncAccounts() {
    const { engine, appSelector } = this.backgroundApi;
    const wallets = appSelector((s) => s.runtime.wallets);
    const instanceId = appSelector((state) => state?.settings?.instanceId);
    const accounts = (
      await engine.getAccounts(wallets.map((w) => w.accounts).flat())
    ).map((n) => ({
      ...pick(n, 'address', 'coinType', 'id', 'name', 'path', 'type'),
      walletType: getWalletTypeFromAccountId(n.id),
    }));
    if (!accounts.length) {
      return;
    }
    fetchData(
      '/overview/syncAccounts',
      {
        accounts,
        instanceId,
      },
      {},
      'POST',
    );
  }

  // remove deprecated wallet
  @backgroundMethod()
  private async removeDeprecatedNetworks() {
    const needRemoveNetwork = [
      // version 4.4.0 remove deprecated sui networks
      'sui--8888881',
      'sui--8888882',
      // version 4.5.0 remove deprecated sui networks
      'sui--8888884',
    ];
    const { engine } = this.backgroundApi;
    const networks = await engine.listNetworks(false);
    const deprecatedNetworks = networks.filter((n) =>
      needRemoveNetwork.includes(n.id),
    );

    if (deprecatedNetworks.length) {
      const accounts = await engine.dbApi.getAllAccounts();
      const needDeleteAccounts = accounts.filter(
        (a) => a.coinType === COINTYPE_SUI,
      );
      for (const network of deprecatedNetworks) {
        for (const account of needDeleteAccounts) {
          await engine.removeAccount(account.id, '', network.id, true);
        }
        await engine.deleteNetwork(network.id);
      }
    }
  }
}
