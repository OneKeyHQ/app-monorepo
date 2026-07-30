import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  type ISelectRenderTriggerProps,
  Icon,
  Select,
  SizableText,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IBorrowMarketItem } from '@onekeyhq/shared/types/staking';

import { getBorrowMarketLabel } from '../borrowMarketDisplayName';
import { buildBorrowMarketKey, useBorrowContext } from '../BorrowProvider';
import { BorrowTestIDs } from '../testIDs';

/**
 * The one market there is to look at: the page's subject line rather than a
 * control. Same type as the switcher, without its fill and chevron — with
 * nothing to switch to, both would promise a menu that never opens. Production
 * currently ships exactly one market, so this is the common case.
 */
function MarketIdentity({
  market,
  label,
}: {
  market: IBorrowMarketItem | null;
  label: string;
}) {
  return (
    <XStack
      ai="center"
      gap="$3"
      px="$4"
      py="$3"
      maxWidth="100%"
      alignSelf="flex-start"
      minWidth={0}
      $gtMd={{ px: '$5' }}
    >
      <Token
        isNFT
        tokenImageUri={market?.logoURI}
        networkImageUri={market?.network.logoURI}
        size="md"
      />
      <SizableText size="$headingLg" numberOfLines={1} flexShrink={1}>
        {label}
      </SizableText>
    </XStack>
  );
}

/**
 * The switcher, as one bar on every breakpoint. The market scopes every number
 * on the page, so it reads as the page's subject line rather than as a filter
 * tag. Fills whatever the caller gives it: phones hand it the whole line, wider
 * windows only its label's worth — stretched edge to edge on a desktop window a
 * bar stops reading as a control.
 */
function MarketBarTrigger({
  market,
  label,
  onPress,
}: {
  market: IBorrowMarketItem | null;
  label: string;
  onPress?: ISelectRenderTriggerProps['onPress'];
}) {
  return (
    <XStack
      ai="center"
      gap="$3"
      bg="$bgSubdued"
      borderRadius="$3"
      borderCurve="continuous"
      px="$4"
      py="$3"
      $gtMd={{ px: '$5' }}
      onPress={onPress}
      cursor="pointer"
      hoverStyle={{ bg: '$bgHover' }}
      pressStyle={{ bg: '$bgActive' }}
    >
      <Token
        isNFT
        tokenImageUri={market?.logoURI}
        networkImageUri={market?.network.logoURI}
        size="md"
      />
      <SizableText size="$headingLg" numberOfLines={1} minWidth={0} flex={1}>
        {label}
      </SizableText>
      <Icon
        flexShrink={0}
        name="ChevronDownSmallOutline"
        size="$5"
        color="$iconSubdued"
      />
    </XStack>
  );
}

export const Markets = () => {
  const intl = useIntl();
  const { gtMd } = useMedia();
  const { market, markets, setMarket } = useBorrowContext();
  const selectedMarket = market ?? markets[0] ?? null;
  const selectedMarketKey = selectedMarket
    ? buildBorrowMarketKey(selectedMarket)
    : undefined;

  const marketItems = useMemo(
    () =>
      markets.map((item) => ({
        label: getBorrowMarketLabel(item),
        value: buildBorrowMarketKey(item),
        leading: (
          <Token
            isNFT
            tokenImageUri={item.logoURI}
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

  const label = selectedMarket ? getBorrowMarketLabel(selectedMarket) : '';

  if (markets.length <= 1) {
    return <MarketIdentity market={selectedMarket} label={label} />;
  }

  // Select wraps the trigger in stacks of its own that carry the press handler,
  // so the width has to be settled here: left to stretch, they would hand a
  // desktop window a full-width invisible hit target beside the bar.
  return (
    <YStack alignSelf={gtMd ? 'flex-start' : 'stretch'} maxWidth="100%">
      <Select
        testID={BorrowTestIDs.marketSelect}
        title={intl.formatMessage({ id: ETranslations.global_market })}
        items={marketItems}
        value={selectedMarketKey}
        onChange={handleMarketChange}
        renderTrigger={({ onPress }) => (
          <MarketBarTrigger
            market={selectedMarket}
            label={label}
            onPress={onPress}
          />
        )}
      />
    </YStack>
  );
};
