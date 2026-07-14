import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  type ISelectRenderTriggerProps,
  Icon,
  Select,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IBorrowMarketItem } from '@onekeyhq/shared/types/staking';

import { buildBorrowMarketKey, useBorrowContext } from '../BorrowProvider';
import { BorrowTestIDs } from '../testIDs';

function MarketTrigger({
  market,
  showChevron,
  onPress,
}: {
  market: IBorrowMarketItem | null;
  showChevron?: boolean;
  onPress?: ISelectRenderTriggerProps['onPress'];
}) {
  return (
    <XStack
      mb="$4"
      h="$14"
      ai="center"
      gap="$3"
      maxWidth="100%"
      cursor={showChevron ? 'pointer' : undefined}
      onPress={onPress}
    >
      <Token
        isNFT
        source={market?.logoURI}
        networkImageUri={market?.network.logoURI}
        size="md"
      />
      <YStack flex={1} minWidth={0}>
        <SizableText size="$bodySm" color="$textSubdued" numberOfLines={1}>
          {market?.network.name ?? ''}
        </SizableText>
        <SizableText size="$bodyLgMedium" color="$text" numberOfLines={1}>
          {market?.name ?? ''}
        </SizableText>
      </YStack>
      {showChevron ? (
        <Icon
          flexShrink={0}
          name="ChevronDownSmallOutline"
          size="$5"
          color="$iconSubdued"
        />
      ) : null}
    </XStack>
  );
}

export const Markets = () => {
  const intl = useIntl();
  const { market, markets, setMarket } = useBorrowContext();
  const selectedMarket = market ?? markets[0] ?? null;
  const selectedMarketKey = selectedMarket
    ? buildBorrowMarketKey(selectedMarket)
    : undefined;
  const marketItems = useMemo(
    () =>
      markets.map((item) => ({
        label: item.name,
        value: buildBorrowMarketKey(item),
        description: item.network.name,
        leading: (
          <Token
            isNFT
            source={item.logoURI}
            networkImageUri={item.network.logoURI}
            size="sm"
          />
        ),
      })),
    [markets],
  );

  const handleMarketChange = useCallback(
    (value: string | number | boolean | undefined) => {
      if (typeof value !== 'string') {
        return;
      }
      const nextMarket = markets.find(
        (item) => buildBorrowMarketKey(item) === value,
      );
      if (nextMarket) {
        setMarket(nextMarket);
      }
    },
    [markets, setMarket],
  );

  if (markets.length <= 1) {
    return <MarketTrigger market={selectedMarket} />;
  }

  return (
    <Select
      testID={BorrowTestIDs.marketSelect}
      title={intl.formatMessage({ id: ETranslations.global_market })}
      items={marketItems}
      value={selectedMarketKey}
      onChange={handleMarketChange}
      renderTrigger={({ onPress }) => (
        <MarketTrigger market={selectedMarket} showChevron onPress={onPress} />
      )}
    />
  );
};
