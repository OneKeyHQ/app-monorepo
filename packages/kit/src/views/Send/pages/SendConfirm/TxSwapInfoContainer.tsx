import { Divider, NumberSizeableText } from '@onekeyhq/components';
import { useUnsignedTxsAtom } from '@onekeyhq/kit/src/states/jotai/contexts/sendConfirm';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import {
  InfoItem,
  InfoItemGroup,
} from '../../../AssetDetails/pages/HistoryDetails/components/TxDetailsInfoItem';

function TxSwapInfoContainer() {
  const [unsignedTxs] = useUnsignedTxsAtom();
  const [settings] = useSettingsPersistAtom();
  const unsignedTx = unsignedTxs[0];

  const { swapInfo } = unsignedTx ?? {};

  if (!swapInfo) {
    return null;
  }

  const { sender, receiver, swapBuildResData, receivingAddress } = swapInfo;
  // TODO

  return (
    <InfoItemGroup>
      <Divider />
      <InfoItem
        label="Provider"
        renderContent={swapBuildResData?.result?.info?.providerName}
      />
      <InfoItem
        label="Protocol Fee"
        renderContent={
          <NumberSizeableText
            size="$bodyMd"
            color="$textSubdued"
            formatter="value"
            formatterOptions={{
              currency: settings.currencyInfo.symbol,
            }}
          >
            {swapBuildResData?.result?.fee?.protocolFees ?? 0}
          </NumberSizeableText>
        }
      />
      <InfoItem
        label="OneKey Fee"
        renderContent={`${swapBuildResData?.result?.fee?.percentageFee ?? 0}%`}
      />
      <InfoItem label="Swap to" renderContent={receivingAddress} />
    </InfoItemGroup>
  );
}

export { TxSwapInfoContainer };
