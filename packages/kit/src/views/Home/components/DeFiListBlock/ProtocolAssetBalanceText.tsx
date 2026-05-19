import { SizableText, XStack } from '@onekeyhq/components';
import { ProtocolValueCell } from '@onekeyhq/kit/src/components/DeFi/ProtocolValueCell';
import { isProtocolAssetValueUnavailable } from '@onekeyhq/kit/src/components/DeFi/protocolValueUtils';
import NumberSizeableTextWrapper from '@onekeyhq/kit/src/components/NumberSizeableTextWrapper';
import type { IDeFiAsset } from '@onekeyhq/shared/types/defi';

const TABULAR_NUMS: ['tabular-nums'] = ['tabular-nums'];

type IProtocolAssetBalanceTextProps = {
  asset: IDeFiAsset;
  currencySymbol: string;
  priceUnavailableLabel: string;
  showFiatValue?: boolean;
};

function ProtocolAssetBalanceText({
  asset,
  currencySymbol,
  priceUnavailableLabel,
  showFiatValue = true,
}: IProtocolAssetBalanceTextProps) {
  return (
    <XStack alignItems="baseline" flexWrap="wrap" minWidth={0}>
      <NumberSizeableTextWrapper
        hideValue
        size="$bodyMd"
        formatter="balance"
        formatterOptions={{ tokenSymbol: asset.symbol }}
        numberOfLines={1}
        fontVariant={TABULAR_NUMS}
      >
        {asset.amount}
      </NumberSizeableTextWrapper>
      {showFiatValue ? (
        <>
          <SizableText size="$bodyMd" color="$textSubdued">
            {' ('}
          </SizableText>
          <ProtocolValueCell
            value={asset.value}
            currencySymbol={currencySymbol}
            priceUnavailableLabel={priceUnavailableLabel}
            isUnavailable={isProtocolAssetValueUnavailable(asset)}
            size="$bodyMd"
            color="$textSubdued"
            fontVariant={TABULAR_NUMS}
            numberOfLines={1}
            justifyContent="flex-start"
          />
          <SizableText size="$bodyMd" color="$textSubdued">
            )
          </SizableText>
        </>
      ) : null}
    </XStack>
  );
}

export { ProtocolAssetBalanceText };
