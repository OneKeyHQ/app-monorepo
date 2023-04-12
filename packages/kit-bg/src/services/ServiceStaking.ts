/* eslint-disable @typescript-eslint/require-await, @typescript-eslint/no-unsafe-member-access */

import { sum } from 'lodash';

import { getFiatEndpoint } from '@onekeyhq/engine/src/endpoint';
import {
  setAccountStakingActivity,
  setKeleDashboardGlobal,
  setKeleIncomes,
  setKeleMinerOverviews,
  setKelePendingWithdraw,
  setKeleUnstakeOverview,
  setKeleWithdrawOverview,
} from '@onekeyhq/kit/src/store/reducers/staking';
import type {
  KeleDashboardGlobal,
  KeleIncomeDTO,
  KeleMinerOverview,
  KeleOpHistoryDTO,
  KeleUnstakeOverviewDTO,
  KeleWithdrawOverviewDTO,
  StakingActivity,
} from '@onekeyhq/kit/src/views/Staking/typing';
import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { OnekeyNetwork } from '@onekeyhq/shared/src/config/networkIds';

import ServiceBase from './ServiceBase';

const TestnetContractAddress = '0xdCAe38cC28606e61B1e54D8b4b134588e4ca7Ab7';
const MainnetContractAddress = '0xACBA4cFE7F30E64dA787c6Dc7Dc34f623570e758';

@backgroundClass()
export default class ServiceStaking extends ServiceBase {
  getKeleBaseUrl(networkId: string) {
    const base = getFiatEndpoint();
    if (networkId === OnekeyNetwork.eth) {
      return `${base}/keleMainnet`;
    }
    if (networkId === OnekeyNetwork.goerli) {
      return `${base}/keleTestnet`;
    }
    throw new Error('Not supported network');
  }

  getKeleContractAddress(networkId: string): string {
    if (networkId === OnekeyNetwork.eth) {
      return MainnetContractAddress;
    }
    if (networkId === OnekeyNetwork.goerli) {
      return TestnetContractAddress;
    }
    throw new Error('Not supported network');
  }

  @backgroundMethod()
  async registerOnKele(params: { payeeAddr: string; networdId: string }) {
    const baseUrl = this.getKeleBaseUrl(params.networdId);
    const url = `${baseUrl}/user/v2/anonymouslogin`;
    await this.client.post(url, {
      payee_addr: params.payeeAddr,
      token: 'eth',
      source: 'onekey',
    });
  }

  @backgroundMethod()
  async buildTxForStakingETHtoKele(params: {
    value: string;
    networkId: string;
  }) {
    return {
      data: '0xd9712d546f6e656b65790000000000000000000000000000000000000000000000000000', // bytes4(keccak256(bytes('deposit("onekey")')))
      to: this.getKeleContractAddress(params.networkId),
      value: params.value,
    };
  }

  @backgroundMethod()
  async setAccountStakingActivity({
    networkId,
    accountId,
    data,
  }: {
    networkId: string;
    accountId: string;
    data: StakingActivity | undefined;
  }) {
    const { dispatch } = this.backgroundApi;
    dispatch(setAccountStakingActivity({ networkId, accountId, data }));
  }

  @backgroundMethod()
  async fetchKeleIncomeHistory(params: {
    accountId: string;
    networkId: string;
  }) {
    const { accountId, networkId } = params;
    const { engine, dispatch } = this.backgroundApi;
    const baseUrl = this.getKeleBaseUrl(params.networkId);
    const account = await engine.getAccount(accountId, networkId);
    const url = `${baseUrl}/eth2/v2/miner/income/query`;
    const res = await this.client.get(url, {
      params: { address: account.address },
    });
    if (res.data) {
      const incomes = res.data.data as KeleIncomeDTO[];
      dispatch(setKeleIncomes({ accountId, networkId, incomes }));
    }
  }

  @backgroundMethod()
  async getDashboardGlobal(params: { networkId: string }) {
    const { dispatch } = this.backgroundApi;
    const baseUrl = this.getKeleBaseUrl(params.networkId);
    const url = `${baseUrl}/eth2/v2/global`;
    const res = await this.client.get(url);
    if (res?.data) {
      const result = res.data.data as KeleDashboardGlobal;
      dispatch(setKeleDashboardGlobal(result));
    }
  }

  @backgroundMethod()
  async fetchKeleUnstakeOverview(params: {
    networkId: string;
    accountId: string;
  }) {
    const { networkId, accountId } = params;
    const baseUrl = this.getKeleBaseUrl(networkId);
    const { engine, dispatch } = this.backgroundApi;
    const account = await engine.getAccount(accountId, networkId);
    const url = `${baseUrl}/unstake/overview`;
    const res = await this.client.get(url, {
      params: { address: account.address },
    });

    if (res.data) {
      const unstakeOverview = res.data.data as KeleUnstakeOverviewDTO;
      dispatch(
        setKeleUnstakeOverview({ networkId, accountId, unstakeOverview }),
      );
    }
  }

  @backgroundMethod()
  async unstake(params: {
    networkId: string;
    address: string;
    unstake_amt: string;
    type: string;
    signHash: string;
    pirvSignRaw: string;
  }) {
    const { networkId, ...rest } = params;
    const baseUrl = this.getKeleBaseUrl(params.networkId);
    const url = `${baseUrl}/unstake`;
    const res = await this.client.post(url, rest);
    // eslint-disable-next-line
    return res?.data;
  }

  @backgroundMethod()
  async fetchWithdrawOverview(params: {
    networkId: string;
    accountId: string;
  }) {
    const { networkId, accountId } = params;
    const baseUrl = this.getKeleBaseUrl(params.networkId);
    const { engine, dispatch } = this.backgroundApi;
    const account = await engine.getAccount(accountId, networkId);
    const url = `${baseUrl}/withdraw/overview`;
    const res = await this.client.get(url, {
      params: { address: account.address },
    });
    if (res.data) {
      const withdrawOverview = res.data.data as KeleWithdrawOverviewDTO;
      dispatch(
        setKeleWithdrawOverview({ networkId, accountId, withdrawOverview }),
      );
    }
  }

  @backgroundMethod()
  async withdraw(params: {
    networkId: string;
    accountId: string;
    amount: string;
  }) {
    const baseUrl = this.getKeleBaseUrl(params.networkId);
    const { engine } = this.backgroundApi;
    const account = await engine.getAccount(params.accountId, params.networkId);
    const url = `${baseUrl}/withdraw`;
    const res = await this.client.post(url, {
      amount: params.amount,
      address: account.address,
    });
    // eslint-disable-next-line
    return res.data;
  }

  async getKeleOpHistory(params: {
    networkId: string;
    accountId: string;
    opType: string;
  }) {
    const { networkId, accountId } = params;
    const { engine } = this.backgroundApi;
    const baseUrl = this.getKeleBaseUrl(params.networkId);
    const account = await engine.getAccount(accountId, networkId);
    const url = `${baseUrl}/op/history`;
    const res = await this.client.get(url, {
      params: {
        address: account.address,
        opType: params.opType,
      },
    });
    if (res.data) {
      const historyItems = res.data.data as KeleOpHistoryDTO[];
      return historyItems;
    }
  }

  @backgroundMethod()
  async fetchPendingWithdrawAmount(params: {
    networkId: string;
    accountId: string;
  }) {
    const { networkId, accountId } = params;
    const { dispatch } = this.backgroundApi;
    const items = await this.getKeleOpHistory({
      networkId,
      accountId,
      opType: '6',
    });
    if (items && Array.isArray(items)) {
      const nums = items.map((o) => o.amount);
      const amount = sum(nums);
      dispatch(setKelePendingWithdraw({ accountId, networkId, amount }));
    }
  }

  @backgroundMethod()
  async fetchMinerOverview(params: { networkId: string; accountId: string }) {
    const { networkId, accountId } = params;
    const { dispatch, engine } = this.backgroundApi;
    const baseUrl = this.getKeleBaseUrl(params.networkId);
    const account = await engine.getAccount(accountId, networkId);
    const url = `${baseUrl}/eth2/v2/miner/dashboard`;
    const res = await this.client.get(url, {
      params: {
        address: account.address,
        interval: 'day',
      },
    });
    if (res.data) {
      const minerOverview = res.data.data as KeleMinerOverview;
      dispatch(setKeleMinerOverviews({ networkId, accountId, minerOverview }));
      return minerOverview;
    }
  }
}
