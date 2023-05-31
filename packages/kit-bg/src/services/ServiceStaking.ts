/* eslint-disable @typescript-eslint/require-await, @typescript-eslint/no-unsafe-member-access */

import BN from 'bignumber.js';
import { add, sum } from 'lodash';
import memoizee from 'memoizee';

import { getFiatEndpoint } from '@onekeyhq/engine/src/endpoint';
import type { Token } from '@onekeyhq/engine/src/types/token';
import type EvmVault from '@onekeyhq/engine/src/vaults/impl/evm/Vault';
import {
  setAccountStakingActivity,
  setETHStakingApr,
  setKeleDashboardGlobal,
  setKeleIncomes,
  setKeleMinerOverviews,
  setKeleOpHistory,
  setKelePendingWithdraw,
  setKeleUnstakeOverview,
  setKeleWithdrawOverview,
  setLidoOverview,
} from '@onekeyhq/kit/src/store/reducers/staking';
import {
  MainnetKeleContractAddress,
  MainnetLidoContractAddress,
  MainnetLidoWithdrawalERC721,
  TestnetKeleContractAddress,
  TestnetLidoContractAddress,
  TestnetLidoWithdrawalERC721,
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
  LidoNFTStatus,
  StakingActivity,
} from '@onekeyhq/kit/src/views/Staking/typing';
import { plus } from '@onekeyhq/kit/src/views/Swap/utils';
import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { OnekeyNetwork } from '@onekeyhq/shared/src/config/networkIds';

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

  getLidoNFTContractAddress(networkId: string) {
    if (networkId === OnekeyNetwork.eth) {
      return MainnetLidoWithdrawalERC721;
    }
    if (networkId === OnekeyNetwork.goerli) {
      return TestnetLidoWithdrawalERC721;
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

  private _fetchEthAprSma = memoizee(
    async () => {
      const { dispatch } = this.backgroundApi;
      const base = getFiatEndpoint();
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
    const address = this.getLidoContractAddress(networkId);
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
    const LIDO_NFT_ABI = [
      {
        inputs: [
          {
            internalType: 'address',
            name: '_owner',
            type: 'address',
          },
        ],
        name: 'getWithdrawalRequests',
        outputs: [
          {
            internalType: 'uint256[]',
            name: 'requestsIds',
            type: 'uint256[]',
          },
        ],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [
          {
            internalType: 'uint256[]',
            name: '_requestIds',
            type: 'uint256[]',
          },
        ],
        name: 'getWithdrawalStatus',
        outputs: [
          {
            components: [
              {
                internalType: 'uint256',
                name: 'amountOfStETH',
                type: 'uint256',
              },
              {
                internalType: 'uint256',
                name: 'amountOfShares',
                type: 'uint256',
              },
              {
                internalType: 'address',
                name: 'owner',
                type: 'address',
              },
              {
                internalType: 'uint256',
                name: 'timestamp',
                type: 'uint256',
              },
              {
                internalType: 'bool',
                name: 'isFinalized',
                type: 'bool',
              },
              {
                internalType: 'bool',
                name: 'isClaimed',
                type: 'bool',
              },
            ],
            internalType:
              'struct WithdrawalQueueBase.WithdrawalRequestStatus[]',
            name: 'statuses',
            type: 'tuple[]',
          },
        ],
        stateMutability: 'view',
        type: 'function',
      },
    ];

    const account = await engine.getAccount(accountId, networkId);
    const nftAddr = this.getLidoNFTContractAddress(networkId);
    const lidoAddr = this.getLidoContractAddress(networkId);

    const getWithdrawalRequestsCalldata =
      await serviceContract.buildEvmCalldata({
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

    const [result] = await serviceToken.getAccountTokenBalance({
      networkId,
      accountId,
      tokenIds: [tokenId],
      withMain: true,
    });

    const balance = result?.[tokenId]?.balance ?? '0';

    const requestsCalldata = calldatas[0];
    const requestsResult = await serviceContract.parseJsonResponse({
      abi: LIDO_NFT_ABI,
      method: 'getWithdrawalRequests',
      data: requestsCalldata,
    });

    if (!requestsResult[0]) return;
    const requestsBN = requestsResult[0] as BigNumber[];
    const requestIds = requestsBN.map((o) => o.toNumber());

    const getWithdrawalStatusCalldata = await serviceContract.buildEvmCalldata({
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

    const statusResult = await serviceContract.parseJsonResponse({
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
      verifyingContract: this.getLidoContractAddress(networdId),
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

    const ERC20_NONCE_ABI = [
      {
        'constant': true,
        'inputs': [
          {
            'name': 'owner',
            'type': 'address',
          },
        ],
        'name': 'nonces',
        'outputs': [
          {
            'name': '',
            'type': 'uint256',
          },
        ],
        'payable': false,
        'stateMutability': 'view',
        'type': 'function',
      },
    ];

    const { serviceContract, engine } = this.backgroundApi;
    const account = await engine.getAccount(accountId, networkId);

    const noncesCalldata = await serviceContract.buildEvmCalldata({
      abi: ERC20_NONCE_ABI,
      method: 'nonces',
      params: [account.address],
    });

    const contractAddress = this.getLidoContractAddress(networkId);

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

    const nonceResult = await serviceContract.parseJsonResponse({
      abi: ERC20_NONCE_ABI,
      method: 'nonces',
      data: nonceCalldata as string,
    });

    if (!nonceResult[0]) {
      return;
    }
    const nonceBN = nonceResult[0] as BigNumber;
    const nonce = nonceBN.toNumber();

    const nftAddress = this.getLidoNFTContractAddress(networkId);

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
    const ABI = [
      {
        'inputs': [
          {
            'internalType': 'uint256[]',
            'name': '_amounts',
            'type': 'uint256[]',
          },
          {
            'internalType': 'address',
            'name': '_owner',
            'type': 'address',
          },
          {
            'components': [
              {
                'internalType': 'uint256',
                'name': 'value',
                'type': 'uint256',
              },
              {
                'internalType': 'uint256',
                'name': 'deadline',
                'type': 'uint256',
              },
              {
                'internalType': 'uint8',
                'name': 'v',
                'type': 'uint8',
              },
              {
                'internalType': 'bytes32',
                'name': 'r',
                'type': 'bytes32',
              },
              {
                'internalType': 'bytes32',
                'name': 's',
                'type': 'bytes32',
              },
            ],
            'internalType': 'struct WithdrawalQueue.PermitInput',
            'name': '_permit',
            'type': 'tuple',
          },
        ],
        'name': 'requestWithdrawalsWithPermit',
        'outputs': [
          {
            'internalType': 'uint256[]',
            'name': 'requestIds',
            'type': 'uint256[]',
          },
        ],
        'stateMutability': 'nonpayable',
        'type': 'function',
      },
    ];
    const { serviceContract } = this.backgroundApi;
    const { amounts, owner, permit, networkId } = parmas;
    const data = await serviceContract.buildEvmCalldata({
      abi: ABI,
      method: 'requestWithdrawalsWithPermit',
      params: [amounts, owner, permit],
    });
    const to = this.getLidoNFTContractAddress(networkId);
    return { to, data, value: '0x0' };
  }

  @backgroundMethod()
  async getLastCheckpointIndex(params: { networkId: string }) {
    const ABI = [
      {
        'inputs': [],
        'name': 'getLastCheckpointIndex',
        'outputs': [
          {
            'internalType': 'uint256',
            'name': '',
            'type': 'uint256',
          },
        ],
        'stateMutability': 'view',
        'type': 'function',
      },
    ];
    const { networkId } = params;
    const to = this.getLidoNFTContractAddress(networkId);
    const { serviceContract } = this.backgroundApi;
    const lastIndexResult = await serviceContract.ethCallWithABI({
      abi: ABI,
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
    const ABI = [
      {
        'inputs': [
          {
            'internalType': 'uint256[]',
            'name': '_requestIds',
            'type': 'uint256[]',
          },
          {
            'internalType': 'uint256',
            'name': '_firstIndex',
            'type': 'uint256',
          },
          {
            'internalType': 'uint256',
            'name': '_lastIndex',
            'type': 'uint256',
          },
        ],
        'name': 'findCheckpointHints',
        'outputs': [
          {
            'internalType': 'uint256[]',
            'name': 'hintIds',
            'type': 'uint256[]',
          },
        ],
        'stateMutability': 'view',
        'type': 'function',
      },
    ];
    const { serviceContract } = this.backgroundApi;
    const to = this.getLidoNFTContractAddress(networkId);
    const hintsResult = await serviceContract.ethCallWithABI({
      abi: ABI,
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
    const ABI = [
      {
        'inputs': [
          {
            'internalType': 'uint256[]',
            'name': '_requestIds',
            'type': 'uint256[]',
          },
          {
            'internalType': 'uint256[]',
            'name': '_hints',
            'type': 'uint256[]',
          },
        ],
        'name': 'claimWithdrawals',
        'outputs': [],
        'stateMutability': 'nonpayable',
        'type': 'function',
      },
    ];
    const { serviceContract } = this.backgroundApi;
    const data = await serviceContract.buildEvmCalldata({
      abi: ABI,
      method: 'claimWithdrawals',
      params: [requestIds, hints],
    });
    const to = this.getLidoNFTContractAddress(networkId);
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
}
