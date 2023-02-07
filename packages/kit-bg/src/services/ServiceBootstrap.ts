import { networkList } from '@onekeyfe/network-list';
import semver from 'semver';

import {
  convertCategoryToTemplate,
  getDBAccountTemplate,
  getImplByCoinType,
} from '@onekeyhq/engine/src/managers/impl';
import { setDbMigrationVersion } from '@onekeyhq/kit/src/store/reducers/settings';
import { updateAutoSwitchDefaultRpcAtVersion } from '@onekeyhq/kit/src/store/reducers/status';
import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import {
  ACCOUNT_DERIVATION_DB_MIGRATION_VERSION,
  AUTO_SWITCH_DEFAULT_RPC_AT_VERSION,
  enabledAccountDynamicNetworkIds,
} from '@onekeyhq/shared/src/engine/engineConsts';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import ServiceBase from './ServiceBase';

import type { IServiceBaseProps } from './ServiceBase';

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

  constructor(props: IServiceBaseProps) {
    super(props);

    const { serviceOverview, serviceToken } = this.backgroundApi;

    serviceToken.registerEvents();
    serviceOverview.registerEvents();
    this.migrateAccountDerivationTable();
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
    try {
      const { appSelector } = this.backgroundApi;
      const dbMigrationVersion = appSelector(
        (s) => s.settings.dbMigrationVersion,
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

      const { dbApi } = this.backgroundApi.engine;
      const wallets = await dbApi.getWallets();
      const hdOrHwWallets = wallets.filter(
        (w) => w.id.startsWith('hd') || w.id.startsWith('hw'),
      );

      for (const wallet of hdOrHwWallets) {
        // update accounts
        const accounts = await dbApi.getAccounts(wallet.accounts);
        for (const account of accounts) {
          if (!account.template) {
            const template = getDBAccountTemplate(account);
            const impl = getImplByCoinType(account.coinType);
            await dbApi.addAccountDerivation(
              wallet.id,
              account.id,
              impl,
              template,
            );
            await dbApi.setAccountTemplate(account.id, template);
            debugLogger.common.info(
              `insert account: ${account.id} to AccountDerivation table, template: ${template}`,
            );
          }
        }

        // update nextAccountIds field
        const { nextAccountIds } = wallet;
        const newNextAccountIds = { ...nextAccountIds };
        for (const [category, value] of Object.entries(nextAccountIds)) {
          const template = convertCategoryToTemplate(category);
          if (template) {
            newNextAccountIds[template] = value;
          }
        }

        await dbApi.updateWalletNextAccountIds(wallet.id, newNextAccountIds);
        debugLogger.common.info(
          `update wallet nextAccountIds, wallet: ${
            wallet.id
          }, nextAccountIds: ${JSON.stringify(newNextAccountIds)}`,
        );
      }
      this.backgroundApi.dispatch(setDbMigrationVersion(appVersion));
    } catch (e) {
      debugLogger.common.error('migrate error: ', e);
      throw e;
    }
  }
}
