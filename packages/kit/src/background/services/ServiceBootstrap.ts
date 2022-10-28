import { networkList } from '@onekeyfe/network-list';

import {
  AUTO_SWITCH_DEFAULT_RPC_AT_VERSION,
  enabledAccountDynamicNetworkIds,
} from '@onekeyhq/engine/src/constants';

import { updateAutoSwitchDefaultRpcAtVersion } from '../../store/reducers/status';
import { backgroundClass, backgroundMethod } from '../decorators';

import ServiceBase, { IServiceBaseProps } from './ServiceBase';

const defaultNetworkRpcs: Record<string, string> = {
  'aptos--1': 'https://fullnode.mainnet.aptoslabs.com',
  'bch--0': 'https://fiat.onekeycn.com/book/bch',
  'btc--0': 'https://rpc.onekey.so/btc/',
  'evm--1': 'https://geth.mytokenpocket.vip',
  'evm--10': 'https://mainnet.optimism.io',
  'evm--100': 'https://rpc.gnosischain.com',
  'evm--10001': 'https://mainnet.ethereumpow.org',
  'evm--128': 'https://http-mainnet.hecochain.com',
  'evm--1313161554': 'https://mainnet.aurora.dev',
  'evm--137': 'https://matic.mytokenpocket.vip',
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
  'tron--0x2b6653dc': 'https://trx.mytokenpocket.vip',
};

@backgroundClass()
export default class ServiceBootstrap extends ServiceBase {
  constructor(props: IServiceBaseProps) {
    super(props);
    this.switchDefaultRpcToOnekeyRpcNode();
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
    const { serviceApp, appSelector, dispatch, serviceNetwork } =
      this.backgroundApi;
    await serviceApp.initApp();
    const { networks } = appSelector((s) => s.runtime);
    const { autoSwitchDefaultRpcAtVersion, userSwitchedNetworkRpcFlag } =
      appSelector((s) => s.status);

    if (
      autoSwitchDefaultRpcAtVersion &&
      autoSwitchDefaultRpcAtVersion <= AUTO_SWITCH_DEFAULT_RPC_AT_VERSION
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
}
