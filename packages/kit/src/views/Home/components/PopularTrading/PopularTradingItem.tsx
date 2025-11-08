import { useCallback } from 'react';

import {
  NumberSizeableText,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { useAccountData } from '@onekeyhq/kit/src/hooks/useAccountData';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { getTokenPriceChangeStyle } from '@onekeyhq/shared/src/utils/tokenUtils';
import type { IPopularTradingToken } from '@onekeyhq/shared/types/swap/types';

function PopularTradingItem({
  tableLayout,
  token,
  onPress,
}: {
  token: IPopularTradingToken;
  onPress: (token: IPopularTradingToken) => void;
  tableLayout?: boolean;
}) {
  const { network } = useAccountData({
    networkId: token.networkId,
  });

  const [settings] = useSettingsPersistAtom();
  const renderFirstColumn = useCallback(() => {
    return (
      <XStack alignItems="center" gap="$3">
        <Token
          size={tableLayout ? 'md' : 'lg'}
          tokenImageUri={token.tokenDetail.info.logoURI}
          networkId={token.networkId}
          networkImageUri={network?.logoURI}
          showNetworkIcon
        />
        <YStack>
          <SizableText size="$bodyLgMedium">
            {tableLayout
              ? token.tokenDetail.info.name
              : token.tokenDetail.info.symbol}
          </SizableText>
          {tableLayout ? (
            <SizableText size="$bodyMd" color="$textSubdued">
              {network?.name}
            </SizableText>
          ) : (
            <NumberSizeableText
              size="$bodyMd"
              color="$textSubdued"
              formatter="marketCap"
              formatterOptions={{
                currency: settings.currencyInfo.symbol,
              }}
            >
              {token.tokenDetail.marketCap ?? 100_000}
            </NumberSizeableText>
          )}
        </YStack>
      </XStack>
    );
  }, [
    token,
    settings.currencyInfo.symbol,
    tableLayout,
    network?.logoURI,
    network?.name,
  ]);

  const renderSecondColumn = useCallback(() => {
    if (tableLayout) {
      return (
        <NumberSizeableText
          size="$bodyLgMedium"
          formatter="price"
          formatterOptions={{
            currency: settings.currencyInfo.symbol,
          }}
        >
          {token.tokenDetail.price}
        </NumberSizeableText>
      );
    }

    const priceChange = Number(token.tokenDetail.price24h) ?? 0;

    const { changeColor, showPlusMinusSigns } = getTokenPriceChangeStyle({
      priceChange,
    });

    return (
      <YStack>
        <NumberSizeableText
          size="$bodyLgMedium"
          formatter="price"
          formatterOptions={{
            currency: settings.currencyInfo.symbol,
          }}
        >
          {token.tokenDetail.price}
        </NumberSizeableText>
        <NumberSizeableText
          size="$bodyMd"
          formatter="priceChange"
          formatterOptions={{ showPlusMinusSigns }}
          color={changeColor}
        >
          {priceChange}
        </NumberSizeableText>
      </YStack>
    );
  }, [token, settings.currencyInfo.symbol, tableLayout]);

  const renderThirdColumn = useCallback(() => {
    if (tableLayout) {
      const priceChange = Number(token.tokenDetail.price24h) ?? 0;

      const { changeColor, showPlusMinusSigns } = getTokenPriceChangeStyle({
        priceChange,
      });
      return (
        <NumberSizeableText
          size="$bodyLgMedium"
          formatter="priceChange"
          formatterOptions={{ showPlusMinusSigns }}
          color={changeColor}
        >
          {priceChange}
        </NumberSizeableText>
      );
    }

    return null;
  }, [token, tableLayout]);

  const renderFourthColumn = useCallback(() => {
    if (tableLayout) {
      return (
        <NumberSizeableText
          size="$bodyLgMedium"
          formatter="marketCap"
          formatterOptions={{
            currency: settings.currencyInfo.symbol,
          }}
        >
          {token.tokenDetail.marketCap ?? 100_000}
        </NumberSizeableText>
      );
    }

    return null;
  }, [token, settings.currencyInfo.symbol, tableLayout]);

  return (
    <ListItem onPress={() => onPress(token)}>
      {renderFirstColumn()}
      {renderSecondColumn()}
      {renderThirdColumn()}
      {renderFourthColumn()}
    </ListItem>
  );
}

export { PopularTradingItem };
