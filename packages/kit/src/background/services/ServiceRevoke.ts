import { providers as multicall } from '@0xsequence/multicall';
import { defaultAbiCoder } from '@ethersproject/abi';
import { Log } from '@ethersproject/abstract-provider';
import ERC20Artifact from '@openzeppelin/contracts/build/contracts/ERC20.json';
import ERC721MetadataArtifact from '@openzeppelin/contracts/build/contracts/ERC721.json';
import { Contract, providers } from 'ethers';
import {
  Interface,
  getAddress,
  hexDataSlice,
  hexZeroPad,
} from 'ethers/lib/utils';

import { shortenAddress } from '@onekeyhq/components/src/utils';
import { parseNetworkId } from '@onekeyhq/engine/src/managers/network';
import {
  BackendProvider,
  DUMMY_ADDRESS,
  DUMMY_ADDRESS_2,
  ERC20TokenApproval,
  ERC721Allowance,
  ERC721TokenApproval,
  Events,
  compareBN,
  convertString,
  formatAllowance,
  generatePatchedAllowanceEvents,
  getChainRpcUrl,
  getLimitedAllowancesFromApprovals,
  getLogs,
  getNameFromEthereumList,
  getOpenSeaProxyAddress,
  getUnlimitedAllowancesFromApprovals,
  isBackendSupportedChain,
  isSpamToken,
  toFloat,
  unpackResult,
  withFallback,
} from '@onekeyhq/engine/src/managers/revoke';
import { Network } from '@onekeyhq/engine/src/types/network';
import { Token } from '@onekeyhq/engine/src/types/token';
import { Erc721MethodSelectors } from '@onekeyhq/engine/src/vaults/impl/evm/decoder/abi';
import { IEncodedTxEvm } from '@onekeyhq/engine/src/vaults/impl/evm/Vault';
import {
  IERC721Approve,
  ISetApprovalForAll,
} from '@onekeyhq/engine/src/vaults/types';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import { appSelector } from '../../store';
import { backgroundClass, backgroundMethod } from '../decorators';

import ServiceBase from './ServiceBase';

export const ERC20 = ERC20Artifact.abi;
export const ERC721Metadata = ERC721MetadataArtifact.abi;

const erc721Interface = new Interface(ERC721Metadata);

@backgroundClass()
export default class ServiceRevoke extends ServiceBase {
  @backgroundMethod()
  async getProvider(networkId: string) {
    const { engine } = this.backgroundApi;
    const { chainId } = parseNetworkId(networkId);
    if (chainId) {
      const rpcUrl = getChainRpcUrl(
        +chainId,
        `${'88583771d63544aa'}${'ba1006382275c6f8'}`,
      );
      if (rpcUrl) {
        return new providers.JsonRpcProvider(rpcUrl, +chainId);
      }
    }
    const vault = await engine.getChainOnlyVault(networkId);
    return vault.getEthersProvider();
  }

  @backgroundMethod()
  async getReadProvider(networkId: string) {
    const provider = await this.getProvider(networkId);
    if (!provider) {
      return;
    }
    return new multicall.MulticallProvider(provider, { verbose: true });
  }

  @backgroundMethod()
  async getLogsProvider(networkId: string) {
    const { chainId } = parseNetworkId(networkId ?? '');
    if (!chainId) {
      return;
    }
    const provider = await this.getProvider(networkId);
    if (!provider) {
      return;
    }
    const backendProvider = new BackendProvider(+chainId);
    return isBackendSupportedChain(+chainId) ? backendProvider : provider;
  }

  @backgroundMethod()
  async getTransferEvents(networkId: string, address: string) {
    const networks: Network[] = appSelector((s) => s.runtime.networks);
    const network = networks.find((n) => n.id === networkId);
    if (!network) {
      throw new Error(`no active network found`);
    }
    const logsProvider = await this.getLogsProvider(networkId);
    if (!logsProvider) {
      throw new Error('no logs provider found');
    }
    const { latestBlock } =
      await this.backgroundApi.serviceNetwork.getRPCEndpointStatus(
        network?.rpcURL ?? '',
        networkId,
      );
    if (!latestBlock) {
      throw new Error('fetch latestBlock error');
    }

    const transferFilter = {
      topics: [
        erc721Interface.getEventTopic('Transfer'),
        undefined,
        hexZeroPad(address, 32),
      ],
    };

    // Get all approvals made from the input address
    const approvalFilter = {
      topics: [
        erc721Interface.getEventTopic('Approval'),
        hexZeroPad(address, 32),
      ],
    };

    // Get all "approvals for all indexes" made from the input address
    const approvalForAllFilter = {
      topics: [
        erc721Interface.getEventTopic('ApprovalForAll'),
        hexZeroPad(address, 32),
      ],
    };

    const transferEvents = await getLogs(
      logsProvider,
      transferFilter as any,
      0,
      latestBlock,
    );
    debugLogger.backgroundApi.info('Transfer events', transferEvents);

    const approvalEvents = await getLogs(
      logsProvider,
      approvalFilter,
      0,
      latestBlock,
    );
    debugLogger.backgroundApi.info('Approval events', approvalEvents);

    const approvalForAllEvents = await getLogs(
      logsProvider,
      approvalForAllFilter,
      0,
      latestBlock,
    );
    debugLogger.backgroundApi.info(
      `ApprovalForAll events`,
      approvalForAllEvents,
    );

    return {
      transferEvents,
      approvalEvents,
      approvalForAllEvents,
    };
  }

  @backgroundMethod()
  async getAddress(inputAddressOrName: string, networkId?: string) {
    // If the input is an address, validate it and return it
    try {
      return getAddress(inputAddressOrName.toLowerCase());
    } catch {
      // pass
    }
    const { success, names } =
      await this.backgroundApi.serviceNameResolver.resolveName(
        inputAddressOrName,
        {
          disableBTC: true,
          networkId,
        },
      );
    if (!success) {
      return;
    }
    const defaultValue = names?.[0]?.options?.[0]?.value ?? '';
    return defaultValue.split('-')[1];
  }

  @backgroundMethod()
  async getERC20TokenApprovals(
    networkId: string,
    address: string,
    { approvalEvents, transferEvents }: Events,
  ) {
    const { engine } = this.backgroundApi;
    const allEvents = [...approvalEvents, ...transferEvents].filter(
      (ev) => ev.topics.length === 3,
    );
    const readProvider = await this.getReadProvider(networkId);
    if (!readProvider) {
      return [];
    }
    // Filter unique token contract addresses and convert all events to Contract instances
    const tokenContracts = allEvents
      .filter(
        (event, i) =>
          i === allEvents.findIndex((other) => event.address === other.address),
      )
      .map(
        (event) => new Contract(getAddress(event.address), ERC20, readProvider),
      );

    const approvals = await Promise.all(
      tokenContracts.map(async (contract) => {
        const tokenApprovals = approvalEvents.filter(
          (approval) => approval.address === contract.address,
        );
        const token = await engine.findToken({
          networkId,
          tokenIdOnNetwork: contract.address,
        });
        const totalSupplyRes = await contract.functions.totalSupply();
        const balanceRes = await contract.functions.balanceOf(address);
        return {
          token: token as Token,
          // eslint-disable-next-line
          balance: String(balanceRes[0]),
          contract,
          approvals: tokenApprovals,
          // eslint-disable-next-line
          totalSupply: totalSupplyRes[0].toString(),
        };
      }),
    );

    const hasBalanceOrApprovals = (item: ERC20TokenApproval) =>
      item.approvals.length > 0 ||
      toFloat(Number(item.balance), item.token.decimals) !== '0.000';

    // Filter undefined tokens, filter tokens without balance or approvals
    //  and sort tokens alphabetically on token symbol
    return approvals
      .filter((r) => !!r.token)
      .filter((r) => !isSpamToken(r.token))
      .filter(hasBalanceOrApprovals)
      .sort((a: ERC20TokenApproval, b: ERC20TokenApproval) =>
        a.token.symbol.localeCompare(b.token.symbol),
      );
  }

  @backgroundMethod()
  async getERC721TokenApprovals(
    networkId: string,
    address: string,
    { approvalEvents, transferEvents, approvalForAllEvents }: Events,
  ) {
    const readProvider = await this.getReadProvider(networkId);
    if (!readProvider) {
      return [];
    }
    const openSeaProxy = await getOpenSeaProxyAddress(address, readProvider);
    const patchedApprovalForAllEvents = [
      ...approvalForAllEvents,
      ...generatePatchedAllowanceEvents(address, openSeaProxy, [
        ...approvalEvents,
        ...approvalForAllEvents,
        ...transferEvents,
      ]),
    ];
    const filteredApprovalEvents = approvalEvents.filter(
      (ev) => ev.topics.length === 4,
    );
    const filteredTransferEvents = transferEvents.filter(
      (ev) => ev.topics.length === 4,
    );
    const allEvents = [
      ...filteredApprovalEvents,
      ...patchedApprovalForAllEvents,
      ...filteredTransferEvents,
    ];

    // Filter unique token contract addresses and convert all events to Contract instances
    const tokenContracts = allEvents
      .filter(
        (event, i) =>
          i === allEvents.findIndex((other) => event.address === other.address),
      )
      .map(
        (event) =>
          new Contract(getAddress(event.address), ERC721Metadata, readProvider),
      );

    const approvals = await Promise.all(
      tokenContracts.map(async (contract) => {
        const approvalsForAll = patchedApprovalForAllEvents.filter(
          (approval) => approval.address === contract.address,
        );
        const tokenApprovals = approvalEvents.filter(
          (approval) => approval.address === contract.address,
        );
        try {
          const [isApprovedForAll] = await contract.functions.isApprovedForAll(
            DUMMY_ADDRESS,
            DUMMY_ADDRESS_2,
          );
          if (isApprovedForAll !== false) {
            // 'Response to isApprovedForAll was not false, indicating that this is not an ERC721 contract',
            return;
          }
          const [balance, symbol] = await Promise.all([
            withFallback(
              convertString(
                unpackResult(contract.functions.balanceOf(address)),
              ),
              'ERC1155',
            ),
            // Use the tokenlist name if present, fall back to '???' since not every NFT has a name
            withFallback(
              unpackResult(contract.functions.name()),
              shortenAddress(contract.address),
            ),
          ]);
          return {
            token: {
              // eslint-disable-next-line
              symbol,
              address: contract.address,
              tokenIdOnNetwork: contract.address,
              networkId,
            },
            // eslint-disable-next-line
            balance,
            contract,
            approvals: tokenApprovals,
            approvalsForAll,
          };
        } catch {
          // pass
        }
      }),
    );
    // Filter undefined tokens and sort tokens alphabetically on token symbol
    return (
      approvals.filter(
        (item) => item !== undefined,
      ) as unknown as ERC721TokenApproval[]
    )
      .filter(({ token }) => !isSpamToken(token))
      .sort((a: ERC721TokenApproval, b: ERC721TokenApproval) =>
        a.token.symbol.localeCompare(b.token.symbol),
      );
  }

  @backgroundMethod()
  async getAllowanceFromApproval(
    multicallContract: Contract,
    ownerAddress: string,
    approval: Log,
  ) {
    const spender = getAddress(hexDataSlice(approval.topics[2], 12));
    const res: Promise<string>[] = await multicallContract.functions.allowance(
      ownerAddress,
      spender,
    );
    const allowance = String(await res[0]);
    return { spender, allowance };
  }

  @backgroundMethod()
  async getERC20AllowancesFromApprovals(
    address: string,
    { token, contract, approvals, totalSupply }: ERC20TokenApproval,
  ) {
    const deduplicatedApprovals = approvals.filter(
      (approval, i) =>
        i ===
        approvals.findIndex((other) => approval.topics[2] === other.topics[2]),
    );
    const loadedAllowances = await Promise.all(
      deduplicatedApprovals.map((approval) =>
        this.getAllowanceFromApproval(contract, address, approval),
      ),
    );
    return loadedAllowances
      .filter(
        ({ allowance }) =>
          formatAllowance(allowance, token.decimals, totalSupply) !== '0.000',
      )
      .sort((a, b) => -1 * compareBN(a.allowance, b.allowance));
  }

  @backgroundMethod()
  async getERC721AllowancesFromApprovals(
    address: string,
    { contract, approvals, approvalsForAll }: ERC721TokenApproval,
  ) {
    const unlimitedAllowances = await getUnlimitedAllowancesFromApprovals(
      contract,
      address,
      approvalsForAll,
    );
    const limitedAllowances = await getLimitedAllowancesFromApprovals(
      contract,
      approvals,
    );
    return [...limitedAllowances, ...unlimitedAllowances].filter(
      (allowance) => allowance !== undefined,
    ) as ERC721Allowance[];
  }

  @backgroundMethod()
  async fetchERC20TokenAllowences(networkId: string, address: string) {
    const { engine } = this.backgroundApi;
    const events = await this.getTransferEvents(networkId, address);
    const res = await this.getERC20TokenApprovals(networkId, address, events);
    const allowanceList = await Promise.all(
      res.map(async (r) => {
        const allowance = await this.getERC20AllowancesFromApprovals(
          address,
          r,
        );
        return {
          token: r.token,
          balance: r.balance,
          allowance,
          totalSupply: r.totalSupply,
        };
      }),
    );
    const result = allowanceList.filter((item) => {
      const balanceString = toFloat(Number(item.balance), item.token.decimals);
      return balanceString !== '0.000' || item.allowance.length !== 0;
    });
    const addresses = result
      .map((r) => r.token.address?.toLowerCase())
      .filter((a) => !!a) as string[];
    const priceAndCharts = await engine.getPricesAndCharts(
      networkId,
      addresses,
      false,
    );
    const prices: Record<string, string> = {};
    for (const [id, price] of Object.entries(priceAndCharts[0])) {
      prices[id] = price.toString();
    }
    return {
      allowance: result,
      prices,
    };
  }

  @backgroundMethod()
  async fetchERC721TokenAllowances(networkId: string, address: string) {
    const events = await this.getTransferEvents(networkId, address);
    const res = await this.getERC721TokenApprovals(networkId, address, events);
    const allowanceList = await Promise.all(
      res.map(async (item) => {
        const loadedAllowances = await this.getERC721AllowancesFromApprovals(
          address,
          item,
        );
        return {
          token: item.token,
          balance: item.balance,
          allowance: loadedAllowances,
        };
      }),
    );
    const result = allowanceList.filter(({ balance, allowance }) => {
      if (balance === '0' && allowance.length === 0) return false;
      if (balance === 'ERC1155' && allowance.length === 0) return false;
      return true;
    });
    return result;
  }

  @backgroundMethod()
  async getSpenderName(networkId: string, spender: string) {
    const { chainId } = parseNetworkId(networkId);
    if (chainId) {
      const name = await getNameFromEthereumList(spender, chainId);
      if (name) {
        return name;
      }
    }
    return shortenAddress(spender);
  }

  @backgroundMethod()
  buildEncodedTxsFromSetApprovalForAll(
    approveInfo: ISetApprovalForAll,
  ): Promise<IEncodedTxEvm> {
    const methodID = Erc721MethodSelectors.setApprovalForAll;
    const data = `${methodID}${defaultAbiCoder
      .encode(['address', 'bool'], [approveInfo.spender, approveInfo.approved])
      .slice(2)}`;
    return Promise.resolve({
      from: approveInfo.from,
      to: approveInfo.to,
      value: '0x0',
      data,
    });
  }

  @backgroundMethod()
  buildEncodedTxsFromApprove(
    approveInfo: IERC721Approve,
  ): Promise<IEncodedTxEvm> {
    const methodID = Erc721MethodSelectors.Approval;
    const data = `${methodID}${defaultAbiCoder
      .encode(
        ['address', 'uint256'],
        [approveInfo.approve, approveInfo.tokenId],
      )
      .slice(2)}`;
    return Promise.resolve({
      from: approveInfo.from,
      to: approveInfo.to,
      value: '0x0',
      data,
    });
  }
}
