import { ok } from 'assert';

import { defaultAbiCoder } from '@ethersproject/abi';
import ERC20Artifact from '@openzeppelin/contracts/build/contracts/ERC20.json';
import ERC721MetadataArtifact from '@openzeppelin/contracts/build/contracts/ERC721.json';
import B from 'bignumber.js';
import { Contract } from 'ethers';
import {
  Interface,
  getAddress,
  hexDataSlice,
  hexZeroPad,
} from 'ethers/lib/utils';

import { shortenAddress } from '@onekeyhq/components/src/utils';
import {
  fetchSecurityInfo,
  fetchValidGoPlusChainId,
} from '@onekeyhq/engine/src/managers/goplus';
import { parseNetworkId } from '@onekeyhq/engine/src/managers/network';
import type {
  ERC20TokenAllowance,
  ERC20TokenApproval,
  ERC721Allowance,
  ERC721TokenAllowance,
  ERC721TokenApproval,
  Events,
} from '@onekeyhq/engine/src/managers/revoke';
import {
  BackendProvider,
  DUMMY_ADDRESS,
  DUMMY_ADDRESS_2,
  compareBN,
  convertString,
  formatAllowance,
  generatePatchedAllowanceEvents,
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
import { fetchData } from '@onekeyhq/engine/src/managers/token';
import type {
  GoPlusApproval,
  GoPlusNFTApproval,
} from '@onekeyhq/engine/src/types/goplus';
import { GoPlusSupportApis } from '@onekeyhq/engine/src/types/goplus';
import type { Network } from '@onekeyhq/engine/src/types/network';
import type { Token } from '@onekeyhq/engine/src/types/token';
import { Erc721MethodSelectors } from '@onekeyhq/engine/src/vaults/impl/evm/decoder/abi';
import type { IEncodedTxEvm } from '@onekeyhq/engine/src/vaults/impl/evm/Vault';
import type {
  IERC721Approve,
  ISetApprovalForAll,
} from '@onekeyhq/engine/src/vaults/types';
import { appSelector } from '@onekeyhq/kit/src/store';
import { AssetType } from '@onekeyhq/kit/src/views/Revoke/types';
import lib0xSequenceMulticall from '@onekeyhq/shared/src/asyncModules/lib0xSequenceMulticall';
import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import ServiceBase from './ServiceBase';

import type { Log } from '@ethersproject/abstract-provider';

export const ERC20 = ERC20Artifact.abi;
export const ERC721Metadata = ERC721MetadataArtifact.abi;

const erc721Interface = new Interface(ERC721Metadata);

@backgroundClass()
export default class ServiceRevoke extends ServiceBase {
  @backgroundMethod()
  async getProvider(networkId: string) {
    const { engine } = this.backgroundApi;
    const vault = await engine.getChainOnlyVault(networkId);
    return vault.getEthersProvider();
  }

  @backgroundMethod()
  async getReadProvider(networkId: string) {
    const multicall = await lib0xSequenceMulticall.getModule();
    const provider = await this.getProvider(networkId);
    if (!provider) {
      return;
    }
    return new multicall.MulticallProvider(provider, { verbose: false });
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

    const approvals = (
      await Promise.all(
        tokenContracts.map(async (contract) => {
          const tokenApprovals = approvalEvents.filter(
            (approval) => approval.address === contract.address,
          );
          try {
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
          } catch (error) {
            // pass
          }
        }),
      )
    ).filter((n) => !!n) as ERC20TokenApproval[];

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
    ).sort((a: ERC721TokenApproval, b: ERC721TokenApproval) =>
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

    const prices = await this.getTokenPriceMap(networkId, addresses);
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

  @backgroundMethod()
  async getTokenPriceMap(
    networkId: string,
    addresses: string[],
  ): Promise<Record<string, number>> {
    const { servicePrice } = this.backgroundApi;
    const vsCurrency = appSelector((s) => s.settings.selectedFiatMoneySymbol);
    const pricesMap = await servicePrice.getCgkTokenPrice({
      platform: networkId,
      contractAddresses: addresses,
    });

    const prices: Record<string, number> = Object.fromEntries(
      Object.entries(pricesMap).map(([k, value]) => {
        const contract = k.split('-').pop();
        const v = value?.[vsCurrency];
        return [contract, v];
      }),
    );

    return prices;
  }

  @backgroundMethod()
  async fetchGoPlusERC20TokenApproval(networkId: string, address: string) {
    const { engine } = this.backgroundApi;
    const readProvider = await this.getReadProvider(networkId);
    if (!readProvider) {
      return {
        allowances: [],
        prices: {},
      };
    }

    const res = await fetchSecurityInfo<GoPlusApproval[]>({
      networkId,
      address,
      apiName: GoPlusSupportApis.token_approval_security,
    });

    ok(!!res, 'fetch gp approval error');
    const allowance = await Promise.all(
      res.map(async (n) => {
        const contract = new Contract(n.token_address, ERC20, readProvider);
        const token = await engine.findToken({
          networkId,
          tokenIdOnNetwork: n.token_address,
        });
        const totalSupplyRes: any = await contract.functions.totalSupply();
        // eslint-disable-next-line
        const totalSupply = totalSupplyRes?.[0]?.toString?.();

        return {
          token,
          balance: new B(n.balance)
            .multipliedBy(10 ** (token?.decimals ?? 0))
            .toString(),
          totalSupply,
          allowance: n.approved_list.map((a) => ({
            spender: a.approved_contract,
            allowance:
              a.approved_amount === 'Unlimited'
                ? new B(totalSupply).plus(1).toString()
                : new B(a.approved_amount)
                    .multipliedBy(10 ** (token?.decimals ?? 0))
                    .toString(),
          })),
        };
      }),
    );

    const addresses = allowance
      .map((r) => r.token?.address?.toLowerCase())
      .filter((a) => !!a) as string[];

    const prices = await this.getTokenPriceMap(networkId, addresses);

    return {
      allowance,
      prices,
    };
  }

  async fetchGoPlusNFTApproval(networkId: string, address: string) {
    const readProvider = await this.getReadProvider(networkId);
    if (!readProvider) {
      return {
        allowances: [],
        prices: {},
      };
    }
    const erc721 = await fetchSecurityInfo<GoPlusNFTApproval[]>({
      networkId,
      address,
      apiName: GoPlusSupportApis.nft721_approval_security,
    });

    ok(!!erc721, 'fetch gp erc721 nft approval error');
    const erc1155 = await fetchSecurityInfo<GoPlusNFTApproval[]>({
      networkId,
      address,
      apiName: GoPlusSupportApis.nft1155_approval_security,
    });

    ok(!!erc1155, 'fetch gp erc 1155 nft approval error');
    const allowance = await Promise.all(
      [...erc721, ...erc1155].map(async (n) => {
        const contract = new Contract(
          n.nft_address,
          ERC721Metadata,
          readProvider,
        );

        const balance = await withFallback(
          convertString(unpackResult(contract.functions.balanceOf(address))),
          'ERC1155',
        );
        return {
          token: {
            symbol: n.nft_symbol,
            address: contract.address,
            tokenIdOnNetwork: contract.address,
            networkId,
          },
          balance,
          allowance: n.approved_list.map((a) => ({
            spender: a.approved_contract,
            tokenId: a.approved_token_id,
          })),
        };
      }),
    );

    return {
      allowance,
    };
  }

  @backgroundMethod()
  async fetchTokenAllowance(
    networkId: string,
    address: string,
    type: AssetType,
    useGoPlusApi = true,
  ): Promise<{
    allowance: (ERC20TokenAllowance | ERC721TokenAllowance)[];
    prices?: Record<string, number | undefined>;
    address?: string;
    isFromRpc: boolean;
  }> {
    const result = {
      allowance: [],
      prices: {},
      isFromRpc: false,
    };
    if (!address) {
      return result;
    }
    if (useGoPlusApi) {
      try {
        const chainId = await fetchValidGoPlusChainId(
          type === AssetType.tokens
            ? GoPlusSupportApis.token_approval_security
            : GoPlusSupportApis.nft721_approval_security,
          networkId,
        );
        if (chainId) {
          if (type === AssetType.tokens) {
            return Object.assign(result, {
              ...(await this.fetchGoPlusERC20TokenApproval(networkId, address)),
            });
          }
          return Object.assign(result, {
            ...(await this.fetchGoPlusNFTApproval(networkId, address)),
          });
        }
      } catch (e) {
        // pass
      }
    }
    Object.assign(result, { isFromRpc: true });
    if (type === AssetType.tokens) {
      Object.assign(result, {
        ...(await this.fetchERC20TokenAllowences(networkId, address)),
      });
    } else {
      const res = await this.fetchERC721TokenAllowances(networkId, address);
      Object.assign(result, {
        allowance: res,
      });
    }

    return result;
  }

  @backgroundMethod()
  async lookupEnsName(address: string) {
    return fetchData('/network/lookup_ens_name', { address }, '');
  }
}
