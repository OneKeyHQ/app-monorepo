import { useUnsignedTxsAtom } from '@onekeyhq/kit/src/states/jotai/contexts/sendConfirm';

import {
  InfoItem,
  InfoItemGroup,
} from '../../../AssetDetails/pages/HistoryDetails/components/TxDetailsInfoItem';

function TxSwapInfoContainer() {
  const [unsignedTxs] = useUnsignedTxsAtom();
  const unsignedTx = unsignedTxs[0];

  const { swapInfo } = unsignedTx ?? {};

  if (!swapInfo) {
    return null;
  }

  const { sender, receiver, swapBuildResData, receivingAddress } = swapInfo;

  return (
    <InfoItemGroup>
      <InfoItem
        label="Provider"
        renderContent={swapBuildResData?.result?.info?.providerName}
      />
      <InfoItem label="Protocol Fee" renderContent={} />
      <InfoItem label="OneKey Fee" renderContent={} />
      <InfoItem label="Swap to" renderContent={receivingAddress} />
    </InfoItemGroup>
  );
}

export { TxSwapInfoContainer };
