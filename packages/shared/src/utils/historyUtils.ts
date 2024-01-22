import { isNil } from 'lodash';

import { EOnChainHistoryTxStatus } from '../../types/history';
import { EDecodedTxStatus } from '../../types/tx';

import type {
  IAccountHistoryTx,
  IHistoryListSectionGroup,
  IOnChainHistoryTxAsset,
  IOnChainHistoryTxNFT,
  IOnChainHistoryTxToken,
} from '../../types/history';

export function getOnChainHistoryTxStatus(
  onChainTxStatus: EOnChainHistoryTxStatus,
) {
  if (onChainTxStatus === EOnChainHistoryTxStatus.Failed)
    return EDecodedTxStatus.Failed;

  if (onChainTxStatus === EOnChainHistoryTxStatus.Success)
    return EDecodedTxStatus.Confirmed;

  return EDecodedTxStatus.Pending;
}

export function getOnChainHistoryTxAssetInfo({
  tokenAddress,
  tokens,
}: {
  tokenAddress: string;
  tokens: Record<string, IOnChainHistoryTxAsset>;
}) {
  let asset = null;
  let image = '';
  let name = '';
  let symbol = '';
  let address = '';
  let isNFT = false;
  if (tokenAddress === '') {
    asset = tokens.native;
  } else {
    asset = tokens[tokenAddress];
  }

  if (asset && !isNil((asset as IOnChainHistoryTxNFT).itemId)) {
    const nft = asset as IOnChainHistoryTxNFT;
    name = nft.metadata.name;
    symbol = nft.metadata.name;
    image = nft.metadata.image;
    address = nft.collectionAddress;
    isNFT = true;
  } else if (asset && !isNil((asset as IOnChainHistoryTxToken).info?.address)) {
    const token = (asset as IOnChainHistoryTxToken).info;
    name = token.name;
    symbol = token.symbol;
    image = token.logoURI;
    address = token.address;
    isNFT = false;
  }
  return {
    name,
    address,
    symbol,
    image,
    isNFT,
  };
}

export function convertToHistorySectionGroups(params: {
  formatDate: (date: number) => string;
  items: IAccountHistoryTx[];
}): IHistoryListSectionGroup[] {
  const { items, formatDate } = params;
  let pendingGroup: IHistoryListSectionGroup | undefined = {
    titleKey: 'transaction__pending',
    data: [],
  };
  const dateGroups: IHistoryListSectionGroup[] = [];
  let currentDateGroup: IHistoryListSectionGroup | undefined;
  items.forEach((item) => {
    if (item.decodedTx.status === EDecodedTxStatus.Pending) {
      pendingGroup?.data.push(item);
    } else {
      const dateKey = formatDate(
        item.decodedTx.updatedAt || item.decodedTx.createdAt || 0,
      );
      if (!currentDateGroup || currentDateGroup.title !== dateKey) {
        if (currentDateGroup) {
          dateGroups.push(currentDateGroup);
        }
        currentDateGroup = {
          title: dateKey,
          data: [],
        };
      }
      currentDateGroup.data.push(item);
    }
  });
  if (currentDateGroup) {
    dateGroups.push(currentDateGroup);
  }
  if (!pendingGroup.data.length) {
    pendingGroup = undefined;
  }
  if (pendingGroup) {
    return [pendingGroup, ...dateGroups].filter(Boolean);
  }
  return [...dateGroups].filter(Boolean);
}
