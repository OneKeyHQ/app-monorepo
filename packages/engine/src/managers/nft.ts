import { defaultAbiCoder } from '@ethersproject/abi';
import axios from 'axios';

import {
  Collection,
  NFTAsset,
  NFTChainMap,
  NFTServiceResp,
  NFTSymbolMap,
  NFTTransaction,
} from '@onekeyhq/engine/src/types/nft';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';

import simpleDb from '../dbs/simple/simpleDb';
import { getFiatEndpoint } from '../endpoint';
import { OnekeyNetwork } from '../presets/networkIds';
import {
  Erc1155MethodSelectors,
  Erc721MethodSelectors,
} from '../vaults/impl/evm/decoder/abi';
import { IDecodedTxActionType, IDecodedTxDirection } from '../vaults/types';

export function getNFTListKey(accountId: string, networkId: string) {
  return `${accountId.toLowerCase()}-${networkId}`.toLowerCase();
}

export const isCollectibleSupportedChainId = (networkId?: string) => {
  if (!networkId) return false;
  if (NFTChainMap[networkId]) return true;
  return false;
};

export function getImageWithAsset(asset: NFTAsset) {
  const { nftscanUri, imageUri, contentType, contentUri } = asset;
  if (nftscanUri) {
    return nftscanUri;
  }
  if (imageUri) {
    if (
      (contentType?.startsWith('image') ||
        contentType?.startsWith('unknown')) &&
      !imageUri.endsWith('.mp4') &&
      !imageUri.endsWith('.mp3')
    ) {
      return imageUri;
    }
  }
  if (contentUri && imageUri && imageUri !== contentUri) {
    return imageUri;
  }
}

const SVGContracts = ['0x57f1887a8bf19b14fc0df6fd9b2acc9af147ea85'];

export function isSVGContract(contractAddress?: string) {
  return SVGContracts.includes(contractAddress ?? '');
}

export function getHttpImageWithAsset(asset: NFTAsset) {
  const { imageUri, nftscanUri } = asset;
  if (nftscanUri) {
    return nftscanUri;
  }
  if (imageUri) {
    if (
      imageUri.toLowerCase().startsWith('qm') ||
      imageUri.toLowerCase().startsWith('ba')
    ) {
      return `https://cloudflare-ipfs.com/ipfs/${imageUri}`;
    }
    if (imageUri.startsWith('ar://')) {
      return `https://arweave.net/${imageUri.replace('ar://', '')}`;
    }
    return imageUri;
  }
}

export function getContentWithAsset(asset: NFTAsset) {
  const { contentUri } = asset;
  if (contentUri) {
    if (
      contentUri.toLowerCase().startsWith('qm') ||
      contentUri.toLowerCase().startsWith('ba')
    ) {
      return `https://cloudflare-ipfs.com/ipfs/${contentUri}`;
    }
    if (contentUri.startsWith('ipfs://')) {
      return contentUri.replace('ipfs://', 'https://cloudflare-ipfs.com/ipfs/');
    }
    if (contentUri.startsWith('ar://')) {
      return `https://arweave.net/${contentUri.replace('ar://', '')}`;
    }
    if (contentUri.startsWith('<svg')) {
      const base64Svg = Buffer.from(contentUri, 'utf-8').toString('base64');
      return `data:image/svg+xml;base64,${base64Svg}`;
    }
    return contentUri;
  }
}

export const syncImage = async (params: {
  contractAddress?: string;
  tokenId: string;
  imageURI?: string;
}) => {
  const { imageURI } = params;
  if (!imageURI) return false;
  const endpoint = getFiatEndpoint();
  const apiUrl = `${endpoint}/NFT/sync`;
  const data = await axios
    .post(apiUrl, params, { timeout: 3 * 60 * 1000 })
    .then(() => true)
    .catch(() => false);
  return data;
};

export const getNFTSymbolPrice = async (networkId: string) => {
  const tokenId = NFTSymbolMap[networkId];
  if (typeof tokenId === 'undefined') {
    return null;
  }

  const prices = await backgroundApiProxy.serviceToken.getPrices({
    networkId,
    tokenIds: [tokenId],
  });
  return prices?.[tokenId];
};

function mergeLocalAsset({
  transaction,
  collectionMap,
}: {
  transaction: NFTTransaction;
  collectionMap: Record<string, Collection>;
}) {
  const { asset: txAsset, collectionId } = transaction;
  let localAsset;
  let collectionName;
  let logoUrl;
  if (collectionId) {
    const collection = collectionMap[collectionId];
    if (collection) {
      localAsset = collection.assets.find((item) => {
        const { tokenAddress, tokenId } = item;
        if (tokenAddress) {
          return item.tokenAddress === transaction.tokenAddress;
        }
        return item.tokenId === tokenId;
      });
      collectionName = collection.contractName ?? '';
      logoUrl = collection.logoUrl ?? '';
    }
  }
  const asset = txAsset ?? localAsset;
  if (asset) {
    return {
      ...transaction,
      asset: { ...asset, collection: { collectionName, logoUrl } },
    };
  }
  return transaction;
}

export const getNFTTransactionHistory = async (
  accountId?: string,
  networkId?: string,
): Promise<NFTTransaction[]> => {
  if (networkId && accountId && isCollectibleSupportedChainId(networkId)) {
    const endpoint = getFiatEndpoint();
    const apiUrl = `${endpoint}/NFT/transactions/account?address=${accountId}&chain=${networkId}`;
    const data = await axios
      .get<NFTServiceResp<NFTTransaction[]>>(apiUrl)
      .then((resp) => resp.data)
      .catch(() => ({ data: [] }));
    const transactions = data.data;
    const contractAddressList = transactions
      .map((tx) => tx.collectionId)
      .filter(Boolean);
    const { serviceNFT } = backgroundApiProxy;
    const collectionMap = await serviceNFT.batchLocalCollection({
      networkId,
      accountId,
      contractAddressList,
    });

    const txList = transactions.map(
      (transaction): NFTTransaction =>
        mergeLocalAsset({ transaction, collectionMap }),
    );
    return txList;
  }
  return [];
};

export function buildEncodeDataWithABI(param: {
  type: string;
  from: string;
  to: string;
  id: string;
  amount: string;
}) {
  const { type, from, to, id, amount } = param;
  if (type === 'erc721') {
    return `${Erc721MethodSelectors.safeTransferFrom}${defaultAbiCoder
      .encode(['address', 'address', 'uint256'], [from, to, id])
      .slice(2)}`;
  }
  return `${Erc1155MethodSelectors.safeTransferFrom}${defaultAbiCoder
    .encode(
      ['address', 'address', 'uint256', 'uint256', 'bytes'],
      [from, to, id, amount, '0x00'],
    )
    .slice(2)}`;
}

export function createOutputActionFromNFTTransaction({
  transaction,
  address,
}: {
  transaction: NFTTransaction;
  address: string;
}) {
  const { send, receive, amount, tradePrice, asset, exchangeName, eventType } =
    transaction;
  if (!asset) {
    return null;
  }
  let type: IDecodedTxActionType = IDecodedTxActionType.UNKNOWN;
  if (eventType === 'Transfer') {
    type = IDecodedTxActionType.NFT_TRANSFER;
  } else if (eventType === 'Sale') {
    type = IDecodedTxActionType.NFT_SALE;
  } else if (eventType === 'Mint') {
    type = IDecodedTxActionType.NFT_MINT;
  }

  const action = {
    type,
    hidden: !(send === address || receive === address),
    direction: IDecodedTxDirection.IN,
    nftTransfer: {
      send,
      receive,
      amount: (amount ?? 0).toString(),
      asset,
      value: tradePrice,
      exchangeName,
      extraInfo: null,
    },
  };
  return action;
}

export async function getLocalNFTs({
  networkId,
  accountId,
}: {
  networkId: string;
  accountId: string;
}): Promise<Collection[]> {
  const key = getNFTListKey(accountId, networkId);
  const items = await simpleDb.nft.getNFTs(key);
  if (items) {
    return items;
  }
  return [];
}

export async function getAssetFromLocal({
  accountId,
  networkId,
  contractAddress,
  tokenId,
}: {
  accountId?: string;
  networkId: string;
  contractAddress?: string;
  tokenId: string;
}) {
  if (!accountId) {
    return;
  }
  const collections = await getLocalNFTs({ networkId, accountId });
  const collection = collections.find(
    (item) => item.contractAddress === contractAddress,
  );
  return collection?.assets.find((item) => item.tokenId === tokenId);
}

export async function fetchAsset({
  chain,
  contractAddress,
  tokenId,
  showAttribute,
}: {
  chain: string;
  contractAddress?: string;
  tokenId: string;
  showAttribute?: boolean;
}) {
  let apiUrl;
  const endpoint = getFiatEndpoint();
  if (OnekeyNetwork.sol === chain) {
    apiUrl = `${endpoint}/NFT/asset?chain=${chain}&tokenId=${tokenId}`;
  } else {
    apiUrl = `${endpoint}/NFT/asset?chain=${chain}&contractAddress=${
      contractAddress as string
    }&tokenId=${tokenId}`;
    if (showAttribute) {
      apiUrl += '&showAttribute=true';
    }
  }
  const { data, success } = await axios
    .get<NFTServiceResp<NFTAsset | undefined>>(apiUrl)
    .then((resp) => resp.data)
    .catch(() => ({ success: false, data: undefined }));
  if (!success) {
    return undefined;
  }
  return data;
}

export async function getAsset(params: {
  accountId?: string;
  networkId: string;
  contractAddress?: string;
  tokenId: string;
  local: boolean;
}) {
  const { local, networkId, contractAddress, tokenId } = params;
  const localAsset = await getAssetFromLocal(params);
  if (localAsset && local) {
    return localAsset;
  }
  const resp = await fetchAsset({
    chain: networkId,
    contractAddress,
    tokenId,
  });
  if (resp) {
    return resp;
  }
}
