/* eslint-disable @typescript-eslint/require-await, @typescript-eslint/no-unsafe-member-access */
import axios, { Axios } from 'axios';

import { getFiatEndpoint } from '@onekeyhq/engine/src/endpoint';
import { OnekeyNetwork } from '@onekeyhq/engine/src/presets/networkIds';

import {
  setAccountStakingActivity,
  setKeleETH2StakingState,
  setShowETH2UnableToUnstakeWarning,
} from '../../store/reducers/staking';
import {
  KeleETHStakingState,
  StakingActivity,
} from '../../views/Staking/typing';
import { backgroundClass, backgroundMethod } from '../decorators';

import ServiceBase from './ServiceBase';

const TestnetContractAddress = '0x09D93B9d2E7fb79f5Bf26687b35844cf1993DAFa';
const MainnetContractAddress = '0xACBA4cFE7F30E64dA787c6Dc7Dc34f623570e758';

@backgroundClass()
export default class ServiceStaking extends ServiceBase {
  @backgroundMethod()
  async hideETH2UnableToUnstakeWarning() {
    this.backgroundApi.dispatch(setShowETH2UnableToUnstakeWarning(false));
  }

  getKeleBaseUrl(networkId: string) {
    if (networkId === OnekeyNetwork.eth) {
      return `${getFiatEndpoint()}/keleMainnet`;
    }
    if (networkId === OnekeyNetwork.teth) {
      return `${getFiatEndpoint()}/keleTestnet`;
    }
    throw new Error('Not supported network');
  }

  getKeleContractAddress(networkId: string): string {
    if (networkId === OnekeyNetwork.eth) {
      return MainnetContractAddress;
    }
    if (networkId === OnekeyNetwork.teth) {
      return TestnetContractAddress;
    }
    throw new Error('Not supported network');
  }

  private client: Axios = axios.create({ timeout: 60 * 1000 });

  @backgroundMethod()
  async registerOnKele(params: { payeeAddr: string; networdId: string }) {
    const baseUrl = this.getKeleBaseUrl(params.networdId);
    const url = `${baseUrl}/user/v2/anonymouslogin`;
    await this.client.post(url, {
      payee_addr: params.payeeAddr,
      token: 'eth',
      source: 'OneKey',
    });
  }

  @backgroundMethod()
  async buildTxForStakingETHtoKele(params: {
    value: string;
    networkId: string;
  }) {
    return {
      data: '0xd0e30db0', // bytes4(keccak256(bytes('deposit()')))
      to: this.getKeleContractAddress(params.networkId),
      value: params.value,
    };
  }

  @backgroundMethod()
  async fetchStakedStateOnKele(params: {
    accountId: string;
    networkId: string;
    interval?: string;
  }): Promise<KeleETHStakingState | undefined> {
    const baseUrl = this.getKeleBaseUrl(params.networkId);
    const account = await this.backgroundApi.engine.getAccount(
      params.accountId,
      params.networkId,
    );
    const url = `${baseUrl}/eth2/v2/miner/dashboard`;
    const { data } = await this.client.get(url, {
      params: {
        address: account.address,
        interval: params.interval || 'day',
      },
    });
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (data.data) {
      const stakingState = {
        total: data.data.amount?.total_amount,
        staked: data.data.amount?.staked_amount,
        staking: data.data.amount?.staking_amount,
      };
      this.backgroundApi.dispatch(
        setKeleETH2StakingState({
          networkId: params.networkId,
          accountId: account.id,
          stakingState,
        }),
      );
      return stakingState;
    }
  }

  @backgroundMethod()
  async getStakingIncomeHistoryOnKele(params: {
    accountId: string;
    networkId: string;
  }) {
    const baseUrl = this.getKeleBaseUrl(params.networkId);
    const account = await this.backgroundApi.engine.getAccount(
      params.accountId,
      params.networkId,
    );
    const url = `${baseUrl}/eth2/v2/miner/income/query`;
    const { data } = await this.client.get(url, {
      params: { address: account.address },
    });
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    console.log('data', data);
    return data.data as
      | {
          date: string;
          reward: number;
          deposit?: number;
          balance: number;
        }[]
      | undefined;
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
    this.backgroundApi.dispatch(
      setAccountStakingActivity({ networkId, accountId, data }),
    );
  }
}
