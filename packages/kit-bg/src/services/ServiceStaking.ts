/* eslint-disable @typescript-eslint/require-await, @typescript-eslint/no-unsafe-member-access */

import { add, sum } from 'lodash';

import { getFiatEndpoint } from '@onekeyhq/engine/src/endpoint';
import {
  setAccountStakingActivity,
  setKeleDashboardGlobal,
  setKeleIncomes,
  setKeleMinerOverviews,
  setKeleOpHistory,
  setKelePendingWithdraw,
  setKeleUnstakeOverview,
  setKeleWithdrawOverview,
} from '@onekeyhq/kit/src/store/reducers/staking';
import type {
  KeleDashboardGlobal,
  KeleHttpResponse,
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

import type { AxiosResponse } from 'axios';

const TestnetKeleContractAddress = '0xdCAe38cC28606e61B1e54D8b4b134588e4ca7Ab7';
const MainnetKeleContractAddress = '0xACBA4cFE7F30E64dA787c6Dc7Dc34f623570e758';

const TestnetLidoContractAddress = '0x1643E812aE58766192Cf7D2Cf9567dF2C37e9B7F';
const MainnetLidoContractAddress = '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84';

export interface SerializableTransactionReceipt {
  to: string;
  from: string;
  gasUsed: string;
  cumulativeGasUsed: string;
  effectiveGasPrice: string;
  contractAddress: string;
  transactionIndex: number;
  blockHash: string;
  transactionHash: string;
  blockNumber: number;
  status?: string;
}

@backgroundClass()
export default class ServiceStaking extends ServiceBase {
  transactionReceipts: Record<
    string,
    Record<string, SerializableTransactionReceipt>
  > = {};

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

  isValidRes(res: AxiosResponse) {
    return Boolean(res.data && res.data.data && res.data.code === 0);
  }

  getKeleContractAddress(networkId: string): string {
    if (networkId === OnekeyNetwork.eth) {
      return MainnetKeleContractAddress;
    }
    if (networkId === OnekeyNetwork.goerli) {
      return TestnetKeleContractAddress;
    }
    throw new Error('Not supported network');
  }

  getLidoContractAddress(networkId: string) {
    if (networkId === OnekeyNetwork.eth) {
      return MainnetLidoContractAddress;
    }
    if (networkId === OnekeyNetwork.goerli) {
      return TestnetLidoContractAddress;
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
  async buildTxForStakingETHtoLido(params: {
    value: string;
    networkId: string;
  }) {
    const { serviceContract } = this.backgroundApi;
    const data = await serviceContract.buildLidoStakeTransaction();
    return {
      data,
      to: this.getLidoContractAddress(params.networkId),
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
    if (this.isValidRes(res)) {
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
    if (this.isValidRes(res)) {
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

    if (this.isValidRes(res)) {
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
    return res.data as KeleHttpResponse;
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
    if (this.isValidRes(res)) {
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
    return res.data as KeleHttpResponse;
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
    if (this.isValidRes(res)) {
      const historyItems = res.data.data as KeleOpHistoryDTO[];
      return historyItems;
    }
  }

  @backgroundMethod()
  async fetchKeleOpHistory(params: { networkId: string; accountId: string }) {
    const { networkId, accountId } = params;
    const { dispatch } = this.backgroundApi;
    const items = await this.getKeleOpHistory({
      networkId,
      accountId,
      opType: '1,2,3,4,5,6,7,8',
    });
    if (items && Array.isArray(items)) {
      dispatch(setKeleOpHistory({ accountId, networkId, items }));
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
      opType: '6,7',
    });
    if (items && Array.isArray(items)) {
      const pendings = items.filter((o) => Number(o.op_type) === 6);
      const nums = pendings.map((o) => o.amount);
      let amount = sum(nums);
      const sentTxs = items.filter((o) => Number(o.op_type) === 7);
      try {
        for (let i = 0; i < sentTxs.length; i += 1) {
          const tx = sentTxs[i];
          const txid = tx.transaction_id;
          if (txid.startsWith('0x')) {
            const receipt = await this.getTransactionReceipt(
              networkId,
              tx.transaction_id,
            );
            if (!receipt || receipt.status === '0x0') {
              amount = add(amount, tx.amount);
            } else if (receipt?.status === '0x1') {
              break;
            }
          }
        }
      } catch {
        console.error('fetch pending withdraw error');
      }
      dispatch(setKelePendingWithdraw({ accountId, networkId, amount }));
    }
    this.fetchWithdrawOverview({ networkId, accountId });
  }

  async getTransactionReceipt(
    networkId: string,
    txid: string,
  ): Promise<SerializableTransactionReceipt | undefined> {
    if (!this.transactionReceipts[networkId]) {
      this.transactionReceipts[networkId] = {};
    }
    if (this.transactionReceipts[networkId]?.[txid]) {
      return this.transactionReceipts[networkId]?.[txid];
    }

    const { serviceNetwork } = this.backgroundApi;

    const receipt = (await serviceNetwork.rpcCall(networkId, {
      method: 'eth_getTransactionReceipt',
      params: [txid],
    })) as SerializableTransactionReceipt | undefined;
    if (receipt && receipt.status === '0x1') {
      this.transactionReceipts[networkId][txid] = receipt;
    }
    return receipt;
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
    if (this.isValidRes(res)) {
      const minerOverview = res.data.data as KeleMinerOverview;
      dispatch(setKeleMinerOverviews({ networkId, accountId, minerOverview }));
      return minerOverview;
    }
  }
}
