/* eslint-disable @typescript-eslint/require-await, @typescript-eslint/no-unsafe-member-access */

import BN from 'bignumber.js';
import { add, sum } from 'lodash';

import { getFiatEndpoint } from '@onekeyhq/engine/src/endpoint';
import type { Token } from '@onekeyhq/engine/src/types/token';
import type EvmVault from '@onekeyhq/engine/src/vaults/impl/evm/Vault';
import {
  setETHStakingApr,
  setKeleIncomes,
  setKeleMinerOverviews,
  setKeleNetworkDashboardGlobal,
  setKeleOpHistory,
  setKelePendingWithdraw,
  setKeleUnstakeOverview,
  setKeleWithdrawOverview,
  setLidoMaticOverview,
  setLidoOverview,
} from '@onekeyhq/kit/src/store/reducers/staking';
import {
  getKeleContractAddress,
  getLidoContractAddress,
  getLidoNFTContractAddress,
  getStMaticContractAdderess,
} from '@onekeyhq/kit/src/views/Staking/address';
import {
  MainnetLidoContractAddress,
  TestnetLidoContractAddress,
} from '@onekeyhq/kit/src/views/Staking/config';
import type {
  EthStakingApr,
  KeleDashboardGlobal,
  KeleHttpResponse,
  KeleIncomeDTO,
  KeleMinerOverview,
  KeleOpHistoryDTO,
  KeleUnstakeOverviewDTO,
  KeleWithdrawOverviewDTO,
  LidoMaticOverview,
  LidoNFTStatus,
} from '@onekeyhq/kit/src/views/Staking/typing';
import { plus, toHex } from '@onekeyhq/kit/src/views/Swap/utils';
import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { OnekeyNetwork } from '@onekeyhq/shared/src/config/networkIds';
import { ERC20PermitABI } from '@onekeyhq/shared/src/contracts/abi/erc20';
import { LIDO_NFT_ABI } from '@onekeyhq/shared/src/contracts/abi/stETH';
import {
  StMaticABI,
  poLidoNFTABI,
  stakeManagerABI,
} from '@onekeyhq/shared/src/contracts/abi/stMatic';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';

import ServiceBase from './ServiceBase';

import type { BigNumber } from '@ethersproject/bignumber';
import type { AxiosResponse } from 'axios';

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

type FastStakeResponse = {
  fund_addr: string;
  stake_fee: string;
  init_max_eth: string;
  fast_stake_balance: string;
  fast_unstake_balance: string;
  fast_stake_pending: string;
};

@backgroundClass()
export default class ServiceStaking extends ServiceBase {
  transactionReceipts: Record<
    string,
    Record<string, SerializableTransactionReceipt>
  > = {};

  private getServerEndPoint() {
    return getFiatEndpoint();
  }

  getKeleBaseUrl(networkId: string) {
    const base = this.getServerEndPoint();
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

  @backgroundMethod()
  async registerOnKele(params: { payeeAddr: string; networkId: string }) {
    const baseUrl = this.getKeleBaseUrl(params.networkId);
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
      to: getKeleContractAddress(params.networkId),
      value: toHex(params.value),
    };
  }

  @backgroundMethod()
  async prepareBuildTxForFastStakingToKele(params: {
    value: string;
    networkId: string;
  }) {
    const baseUrl = this.getKeleBaseUrl(params.networkId);
    const url = `${baseUrl}/fast/stake`;
    const res = await this.client.get(url);
    const data = res.data as { code: number; data: FastStakeResponse };
    if (Number(data.code) !== 0 || !data.data) {
      throw new Error('Failed to build kele pool fast stake transaction');
    }
    return data.data;
  }

  @backgroundMethod()
  async buildTxForFastStakingETHtoKele(params: {
    value: string;
    networkId: string;
    accountId: string;
  }) {
    const { engine } = this.backgroundApi;
    const baseUrl = this.getKeleBaseUrl(params.networkId);
    const account = await engine.getAccount(params.accountId, params.networkId);
    const url = `${baseUrl}/build/fast/stake/tx`;
    const res = await this.client.post(url, {
      address: account.address,
      amount: params.value,
    });
    const data = res.data as { to: string; data: string; value: string };
    const fundAddr = data.to;
    await engine.validator.validateAddress(params.networkId, fundAddr);
    data.value = toHex(data.value);
    return data;
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
      to: getLidoContractAddress(params.networkId),
      value: toHex(params.value),
    };
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
      dispatch(
        setKeleNetworkDashboardGlobal({
          networkId: params.networkId,
          dashboard: result,
        }),
      );
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
    const url = `${baseUrl}/op/v4/history`;
    const res = await this.client.get(url, {
      params: {
        address: account.address,
        op_type: params.opType,
      },
    });
    if (this.isValidRes(res)) {
      const historyItems = res.data?.data?.data as KeleOpHistoryDTO[];
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
      return items;
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

  private _fetchEthAprSma = memoizee(
    async () => {
      const { dispatch } = this.backgroundApi;
      const base = this.getServerEndPoint();
      const url = `${base}/staking/eth/apr/overview`;
      const res = await this.client.get(url);
      const data = res.data as EthStakingApr;
      if (data) {
        dispatch(setETHStakingApr(data));
        return data;
      }
    },
    {
      promise: true,
      primitive: true,
      max: 1,
      maxAge: 1000 * 60 * 60,
    },
  );

  @backgroundMethod()
  fetchEthAprSma() {
    return this._fetchEthAprSma();
  }

  @backgroundMethod()
  async addStEthToUserAccount({
    networkId,
    accountId,
  }: {
    networkId: string;
    accountId: string;
  }) {
    const { serviceToken } = this.backgroundApi;
    const address = getLidoContractAddress(networkId);
    await serviceToken.addAccountToken(networkId, accountId, address);
  }

  @backgroundMethod()
  async fetchLidoOverview(params: { networkId: string; accountId: string }) {
    const { networkId, accountId } = params;
    const { engine, serviceContract, dispatch, serviceToken } =
      this.backgroundApi;
    if (networkId !== OnekeyNetwork.eth && networkId !== OnekeyNetwork.goerli) {
      return;
    }

    const account = await engine.getAccount(accountId, networkId);
    const nftAddr = getLidoNFTContractAddress(networkId);
    const lidoAddr = getLidoContractAddress(networkId);

    const getWithdrawalRequestsCalldata = serviceContract.buildEvmCalldata({
      abi: LIDO_NFT_ABI,
      method: 'getWithdrawalRequests',
      params: [account.address],
    });

    const vault = (await engine.getVault({ networkId, accountId })) as EvmVault;
    const client = await vault.getJsonRPCClient();

    const calls = [{ to: nftAddr, data: getWithdrawalRequestsCalldata }];

    const calldatas = await client.batchEthCall(calls);

    if (calldatas.length !== calls.length) {
      return;
    }

    const tokenId = lidoAddr.toLowerCase();

    const [result] = await serviceToken.fetchAndSaveAccountTokenBalance({
      networkId,
      accountId,
      tokenIds: [tokenId],
      withMain: true,
    });

    const balance = result?.[tokenId]?.balance ?? '0';

    const requestsCalldata = calldatas[0];
    const requestsResult = serviceContract.parseJsonResponse({
      abi: LIDO_NFT_ABI,
      method: 'getWithdrawalRequests',
      data: requestsCalldata,
    });

    if (!requestsResult[0]) return;
    const requestsBN = requestsResult[0] as BigNumber[];
    const requestIds = requestsBN.map((o) => o.toNumber());

    const getWithdrawalStatusCalldata = serviceContract.buildEvmCalldata({
      abi: LIDO_NFT_ABI,
      method: 'getWithdrawalStatus',
      params: [requestIds],
    });

    const statusCalldata = await engine.proxyJsonRPCCall(networkId, {
      method: 'eth_call',
      params: [
        {
          from: account.address,
          to: nftAddr,
          data: getWithdrawalStatusCalldata,
        },
        'latest',
      ],
    });

    const statusResult = serviceContract.parseJsonResponse({
      abi: LIDO_NFT_ABI,
      method: 'getWithdrawalStatus',
      data: statusCalldata as string,
    });

    if (!statusResult?.[0]) {
      return;
    }
    /* eslint-disable @typescript-eslint/no-unsafe-call */
    const statusData = statusResult[0] as any[];
    const finialResult = statusData.map((o) => ({
      owner: o.owner,
      isFinalized: o.isFinalized,
      isClaimed: o.isClaimed,
      amountOfShares: o.amountOfShares.toString(),
      amountOfStETH: o.amountOfStETH.toString(),
      timestamp: o.timestamp.toNumber(),
    }));

    if (finialResult.length !== requestIds.length) {
      return;
    }
    const nfts = finialResult.map((item, i) => ({
      ...item,
      requestId: requestIds[i],
      stETH: new BN(item.amountOfStETH).shiftedBy(-18).toString(),
    })) as LidoNFTStatus[];
    /* eslint-enable @typescript-eslint/no-unsafe-call */

    const pendingNfts = nfts.filter((nft) => !nft.isFinalized);
    const finalizedNfts = nfts.filter((nft) => nft.isFinalized);

    const nftsBalance = nfts.reduce((r, nft) => plus(nft.stETH, r), '0');

    const pendingNftBalances = pendingNfts.reduce(
      (r, nft) => plus(nft.stETH, r),
      '0',
    );

    const withdrawal = finalizedNfts.reduce(
      (r, nft) => plus(nft.stETH, r),
      '0',
    );

    const total = plus(balance, nftsBalance);
    const pending = pendingNftBalances;
    const pendingNums = pendingNfts.length;
    const overview = {
      total,
      pending,
      withdrawal,
      pendingNums,
      balance,
      nfts,
      nftsBalance,
    };

    dispatch(setLidoOverview({ accountId, networkId, overview }));
  }

  private getStEthEip712Domain(networdId: string) {
    return {
      name: 'Liquid staked Ether 2.0',
      version: '2',
      chainId: networdId === OnekeyNetwork.eth ? 1 : 5,
      verifyingContract: getLidoContractAddress(networdId),
    };
  }

  @backgroundMethod()
  async buildStEthPermit(params: {
    accountId: string;
    networkId: string;
    value: string;
    deadline: number;
  }) {
    const { networkId, accountId, value, deadline } = params;
    const eip712Domain = this.getStEthEip712Domain(networkId);

    const { serviceContract, engine } = this.backgroundApi;
    const account = await engine.getAccount(accountId, networkId);

    const noncesCalldata = serviceContract.buildEvmCalldata({
      abi: ERC20PermitABI,
      method: 'nonces',
      params: [account.address],
    });

    const contractAddress = getLidoContractAddress(networkId);

    const nonceCalldata = await engine.proxyJsonRPCCall(networkId, {
      method: 'eth_call',
      params: [
        {
          from: account.address,
          to: contractAddress,
          data: noncesCalldata,
        },
        'latest',
      ],
    });

    const nonceResult = serviceContract.parseJsonResponse({
      abi: ERC20PermitABI,
      method: 'nonces',
      data: nonceCalldata as string,
    });

    if (!nonceResult[0]) {
      return;
    }
    const nonceBN = nonceResult[0] as BigNumber;
    const nonce = nonceBN.toNumber();

    const nftAddress = getLidoNFTContractAddress(networkId);

    const permitData = await serviceContract.buildERC20PermitData({
      eip712Domain,
      eip712Message: {
        owner: account.address,
        spender: nftAddress,
        value,
        nonce,
        deadline,
      },
    });

    return permitData;
  }

  @backgroundMethod()
  async buildRequestWithdrawalsWithPermit(parmas: {
    networkId: string;
    amounts: string[];
    owner: string;
    permit: {
      v: number;
      s: string;
      r: string;
      value: string;
      deadline: number;
    };
  }) {
    const { serviceContract } = this.backgroundApi;
    const { amounts, owner, permit, networkId } = parmas;
    const data = serviceContract.buildEvmCalldata({
      abi: LIDO_NFT_ABI,
      method: 'requestWithdrawalsWithPermit',
      params: [amounts, owner, permit],
    });
    const to = getLidoNFTContractAddress(networkId);
    return { to, data, value: '0x0' };
  }

  @backgroundMethod()
  async getLastCheckpointIndex(params: { networkId: string }) {
    const { networkId } = params;
    const to = getLidoNFTContractAddress(networkId);
    const { serviceContract } = this.backgroundApi;
    const lastIndexResult = await serviceContract.ethCallWithABI({
      abi: LIDO_NFT_ABI,
      method: 'getLastCheckpointIndex',
      params: [],
      networkId,
      to,
    });
    if (!lastIndexResult?.[0]) {
      throw new Error('Failed to fetch getLastCheckpointIndex');
    }
    const checkpointIndex = lastIndexResult[0] as BigNumber;
    return checkpointIndex.toNumber();
  }

  @backgroundMethod()
  async findLidoCheckpointHints(params: {
    requestIds: number[];
    firstIndex: number;
    lastIndex: number;
    networkId: string;
  }): Promise<number[]> {
    const { requestIds, firstIndex, lastIndex, networkId } = params;
    const { serviceContract } = this.backgroundApi;
    const to = getLidoNFTContractAddress(networkId);
    const hintsResult = await serviceContract.ethCallWithABI({
      abi: LIDO_NFT_ABI,
      method: 'findCheckpointHints',
      params: [requestIds, firstIndex, lastIndex],
      networkId,
      to,
    });
    if (!hintsResult?.[0]) {
      throw new Error('Failed to fetch findCheckpointHints');
    }
    const hintsBN = hintsResult[0] as BigNumber[];
    const hints = hintsBN.map((o) => o.toNumber());
    return hints;
  }

  @backgroundMethod()
  async buildLidoClaimWithdrawals(params: {
    requestIds: number[];
    networkId: string;
  }) {
    const { requestIds, networkId } = params;
    const newRequestIds = [...requestIds];
    const lastCheckpoint = await this.getLastCheckpointIndex({ networkId });
    newRequestIds.sort((a, b) => a - b);
    const hints = await this.findLidoCheckpointHints({
      requestIds: newRequestIds,
      firstIndex: 1,
      lastIndex: lastCheckpoint,
      networkId,
    });
    const { serviceContract } = this.backgroundApi;
    const data = serviceContract.buildEvmCalldata({
      abi: LIDO_NFT_ABI,
      method: 'claimWithdrawals',
      params: [requestIds, hints],
    });
    const to = getLidoNFTContractAddress(networkId);
    return { to, data, value: '0x0' };
  }

  @backgroundMethod()
  async getStEthToken(params: { networkId: string }) {
    const { networkId } = params;
    const baseToken: Token = {
      id: '',
      networkId: '',
      tokenIdOnNetwork: '',
      name: 'Liquid staked Ether 2.0',
      symbol: 'stETH',
      decimals: 18,
      logoURI:
        'https://common.onekey-asset.com/token/evm-1/0xae7ab96520de3a18e5e111b5eaab095312d7fe84.png',
    };
    if (networkId === OnekeyNetwork.eth) {
      baseToken.id = `${OnekeyNetwork.eth}--${MainnetLidoContractAddress}`;
      baseToken.networkId = OnekeyNetwork.eth;
      baseToken.tokenIdOnNetwork = MainnetLidoContractAddress;
    } else if (networkId === OnekeyNetwork.goerli) {
      baseToken.id = `${OnekeyNetwork.goerli}--${TestnetLidoContractAddress}`;
      baseToken.networkId = OnekeyNetwork.goerli;
      baseToken.tokenIdOnNetwork = TestnetLidoContractAddress;
    } else {
      throw new Error('Wrong networkId');
    }
    return baseToken;
  }

  private async localRpcFetchLidoMaticOverview(params: {
    networkId: string;
    accountId: string;
  }): Promise<LidoMaticOverview | undefined> {
    const { networkId, accountId } = params;
    const { engine, serviceContract, serviceToken } = this.backgroundApi;
    if (networkId !== OnekeyNetwork.eth && networkId !== OnekeyNetwork.goerli) {
      return;
    }
    const stMaticAddress = getStMaticContractAdderess(networkId);

    const getStakeManagerRequestsCalldata = serviceContract.buildEvmCalldata({
      abi: StMaticABI,
      method: 'stakeManager',
      params: [],
    });
    const getPoLidoNFTRequestsCalldata = serviceContract.buildEvmCalldata({
      abi: StMaticABI,
      method: 'poLidoNFT',
      params: [],
    });

    const maticBN = new BN(1).shiftedBy(9);
    const getStMaticRateCalldata = serviceContract.buildEvmCalldata({
      abi: StMaticABI,
      method: 'convertMaticToStMatic',
      params: [maticBN.toFixed()],
    });

    const vault = (await engine.getVault({ networkId, accountId })) as EvmVault;
    const client = await vault.getJsonRPCClient();

    const calls = [
      { to: stMaticAddress, data: getStakeManagerRequestsCalldata },
      { to: stMaticAddress, data: getPoLidoNFTRequestsCalldata },
      { to: stMaticAddress, data: getStMaticRateCalldata },
    ];

    const calldatas = await client.batchEthCall(calls);

    if (calldatas.length !== calls.length) {
      return;
    }

    const stakeManagerResult = serviceContract.parseJsonResponse({
      abi: StMaticABI,
      method: 'stakeManager',
      data: calldatas[0],
    });

    const poLidoNFTResult = serviceContract.parseJsonResponse({
      abi: StMaticABI,
      method: 'poLidoNFT',
      data: calldatas[1],
    });

    const stMaticRateResult = serviceContract.parseJsonResponse({
      abi: StMaticABI,
      method: 'convertMaticToStMatic',
      data: calldatas[2],
    });

    const stakeManagerAddress = stakeManagerResult[0] as string;
    const poLidoNFTAddress = poLidoNFTResult[0] as string;
    const stMaticRateData = stMaticRateResult as BigNumber[];

    let maticToStMaticRate = '';
    if (stMaticRateData) {
      const amountInStMatic = stMaticRateData[0];
      maticToStMaticRate = new BN(amountInStMatic.toNumber())
        .dividedBy(maticBN)
        .toFixed(8);
    }

    if (!stakeManagerAddress || !poLidoNFTAddress) {
      return;
    }

    const account = await engine.getAccount(accountId, networkId);

    const getOwnedTokensRequestCalldata = serviceContract.buildEvmCalldata({
      abi: poLidoNFTABI,
      method: 'getOwnedTokens',
      params: [account.address],
    });
    const getEpochRequestCalldata = serviceContract.buildEvmCalldata({
      abi: stakeManagerABI,
      method: 'epoch',
      params: [],
    });

    const calls2 = [
      { to: poLidoNFTAddress, data: getOwnedTokensRequestCalldata },
      { to: stakeManagerAddress, data: getEpochRequestCalldata },
    ];

    const calldatas2 = await client.batchEthCall(calls2);

    if (calls2.length !== calldatas2.length) {
      return;
    }

    const getOwnedTokensResult = serviceContract.parseJsonResponse({
      abi: poLidoNFTABI,
      method: 'getOwnedTokens',
      data: calldatas2[0],
    });

    const getEpochResult = serviceContract.parseJsonResponse({
      abi: stakeManagerABI,
      method: 'epoch',
      data: calldatas2[1],
    });

    const epochBN = getEpochResult[0] as BigNumber;
    const epoch = epochBN.toNumber();
    const nftTokenIdsBN = getOwnedTokensResult[0] as BigNumber[];
    const nftTokenIds = nftTokenIdsBN.map((o) => o.toNumber());

    const getToken2WithdrawRequestsPromises = nftTokenIds.map((nftId) => {
      const data = serviceContract.buildEvmCalldata({
        abi: StMaticABI,
        method: 'getToken2WithdrawRequests',
        params: [nftId],
      });
      return data;
    });

    const getMaticFromTokenIdPromises = nftTokenIds.map((nftId) => {
      const data = serviceContract.buildEvmCalldata({
        abi: StMaticABI,
        method: 'getMaticFromTokenId',
        params: [nftId],
      });
      return data;
    });

    const requestsCalldatas = await Promise.all(
      ([] as string[])
        .concat(getToken2WithdrawRequestsPromises)
        .concat(getMaticFromTokenIdPromises),
    );

    const calls3 = requestsCalldatas.map((item) => ({
      to: stMaticAddress,
      data: item,
    }));

    const calldatas3 = await client.batchEthCall(calls3);

    if (calls3.length !== calldatas3.length) {
      return;
    }

    const withdrawRequestPromises = calldatas3
      .slice(0, getToken2WithdrawRequestsPromises.length)
      .map(async (item) => {
        const result = serviceContract.parseJsonResponse({
          abi: StMaticABI,
          method: 'getToken2WithdrawRequests',
          data: item,
        });
        const withdrawRequest = result[0][0] as [
          BigNumber,
          BigNumber,
          BigNumber,
          string,
        ];
        if (!withdrawRequest) {
          return;
        }
        return {
          amount2WithdrawFromStMATIC: withdrawRequest[0].toNumber(),
          validatorNonce: withdrawRequest[1].toNumber(),
          requestTime: withdrawRequest[2].toNumber(),
          validatorAddress: withdrawRequest[3],
        };
      });

    const withdrawRequestsRaw = await Promise.all(withdrawRequestPromises);
    const withdrawRequests = withdrawRequestsRaw.filter(
      (
        x,
      ): x is {
        amount2WithdrawFromStMATIC: number;
        validatorNonce: number;
        requestTime: number;
        validatorAddress: string;
      } => typeof x !== 'undefined',
    );

    const maticFromTokenIdProise = calldatas3
      .slice(getToken2WithdrawRequestsPromises.length)
      .map(async (item) => {
        const result = serviceContract.parseJsonResponse({
          abi: StMaticABI,
          method: 'getMaticFromTokenId',
          data: item,
        });
        const maticFromTokenId = result[0] as BigNumber;
        return maticFromTokenId.toString();
      });

    const maticFromTokenIds = await Promise.all(maticFromTokenIdProise);

    if (
      withdrawRequests.length !== nftTokenIds.length ||
      maticFromTokenIds.length !== nftTokenIds.length
    ) {
      return;
    }

    const nfts = withdrawRequests.map((item, index) => {
      const nftId = nftTokenIds[index];
      const maticAmount = new BN(maticFromTokenIds[index])
        .shiftedBy(-18)
        .toString();
      const claimable = item.requestTime <= epoch;
      return {
        nftId,
        claimable,
        maticAmount,
      };
    });

    const tokenId = stMaticAddress.toLowerCase();

    const [result] = await serviceToken.getAccountTokenBalance({
      networkId,
      accountId,
      tokenIds: [tokenId],
      withMain: true,
    });

    const balance = result?.[tokenId]?.balance ?? '0';
    const overview = { balance, nfts, maticToStMaticRate, stMaticAddress };
    return overview;
  }

  private async remoteSeverFetchLidoMaticOverview(params: {
    networkId: string;
    accountId: string;
  }): Promise<LidoMaticOverview | undefined> {
    const { accountId, networkId } = params;
    const { engine, serviceToken } = this.backgroundApi;
    const baseUrl = this.getServerEndPoint();
    const account = await engine.getAccount(accountId, networkId);
    const url = `${baseUrl}/staking/stmatic/overview`;
    const res = await this.client.get(url, {
      params: {
        address: account.address,
        networkId,
      },
    });
    const data = res.data as LidoMaticOverview | undefined;
    if (data?.stMaticAddress) {
      const tokenId = data.stMaticAddress.toLowerCase();
      await serviceToken.getAccountTokenBalance({
        networkId,
        accountId,
        tokenIds: [tokenId],
        withMain: true,
      });
    }
    return data;
  }

  @backgroundMethod()
  async fetchLidoMaticOverview(params: {
    networkId: string;
    accountId: string;
  }) {
    let overview: LidoMaticOverview | undefined;
    try {
      overview = await this.remoteSeverFetchLidoMaticOverview(params);
    } catch {
      overview = await this.localRpcFetchLidoMaticOverview(params);
    }
    if (overview) {
      const { dispatch } = this.backgroundApi;
      dispatch(setLidoMaticOverview({ ...params, overview }));
    }
  }

  @backgroundMethod()
  async buildTxForStakingMaticToLido(params: {
    accountId: string;
    amount: string;
    networkId: string;
  }) {
    const { engine } = this.backgroundApi;
    const baseUrl = this.getServerEndPoint();
    const account = await engine.getAccount(params.accountId, params.networkId);
    const url = `${baseUrl}/staking/stmatic/build_stake_transaction`;
    const res = await this.client.post(url, {
      networkId: params.networkId,
      amount: params.amount,
      address: account.address,
    });
    const data = res.data as { to: string; value: string; data: string };
    return data;
  }

  @backgroundMethod()
  async buildTransactionUnstakeMatic(params: {
    networkId: string;
    accountId: string;
    amount: string;
  }) {
    const { engine } = this.backgroundApi;
    const baseUrl = this.getServerEndPoint();
    const account = await engine.getAccount(params.accountId, params.networkId);
    const url = `${baseUrl}/staking/stmatic/build_unstake_transaction`;
    const res = await this.client.post(url, {
      networkId: params.networkId,
      amount: params.amount,
      address: account.address,
    });
    const data = res.data as { to: string; value: string; data: string };
    return data;
  }

  @backgroundMethod()
  async buildLidoMaticClaimWithdrawals(params: {
    nftId: number;
    networkId: string;
    accountId: string;
  }) {
    const { engine } = this.backgroundApi;
    const baseUrl = this.getServerEndPoint();
    const account = await engine.getAccount(params.accountId, params.networkId);
    const url = `${baseUrl}/staking/stmatic/build_claim_transaction`;
    const res = await this.client.post(url, {
      networkId: params.networkId,
      nftId: params.nftId,
      address: account.address,
    });
    const data = res.data as { to: string; value: string; data: string };
    return data;
  }
}
