import { privateSendProvider } from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import type { ISwapTxHistory } from '@onekeyhq/shared/types/swap/types';
import { EProtocolOfExchange } from '@onekeyhq/shared/types/swap/types';

export function isPrivateSendSwapHistoryItem(item?: ISwapTxHistory) {
  return (
    item?.protocol === EProtocolOfExchange.PRIVATE_SEND ||
    item?.swapInfo?.provider?.provider === privateSendProvider
  );
}

export function isSwapHistoryProtocolExcluded({
  item,
  excludeProtocols,
}: {
  item: ISwapTxHistory;
  excludeProtocols?: EProtocolOfExchange[];
}) {
  if (!excludeProtocols?.length) {
    return false;
  }
  if (
    excludeProtocols.includes(EProtocolOfExchange.PRIVATE_SEND) &&
    isPrivateSendSwapHistoryItem(item)
  ) {
    return true;
  }
  return Boolean(item.protocol && excludeProtocols.includes(item.protocol));
}
