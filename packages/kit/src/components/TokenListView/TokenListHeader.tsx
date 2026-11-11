import { useCallback, useState } from 'react';

import { useIntl } from 'react-intl';

import type { IKeyOfIcons, IXStackProps } from '@onekeyhq/components';
import {
  Icon,
  SizableText,
  Stack,
  XStack,
  useMedia,
} from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETokenListSortType } from '@onekeyhq/shared/types/token';

import {
  TOKEN_LIST_DEFAULT_SORT,
  useTokenListActions,
  useTokenListSortAtom,
} from '../../states/jotai/contexts/tokenList';

import { getTokenListHeaderLayout } from './tokenListRowLayout';
import { getTokenTableColumnWeights } from './tokenListRowLayoutShared';

type IProps = {
  tableLayout?: boolean;
  withSwapAction?: boolean;
  onManageToken?: () => void;
  manageTokenEnabled?: boolean;
};

// Table rows are NativeList `dataRow`s (see NativeTokenSelectorList), so the
// header mirrors each engine's row geometry rather than an equal-width grid:
// a leading slot for the token icon, the inter-cell gap, and the footprint of
// the trailing swap button. The per-platform numbers live in
// `tokenListRowLayout` (web) and `tokenListRowLayout.native`.
// Trailing swap button on both engines: 10px padding plus a 1px border.
const SWAP_BUTTON_HORIZONTAL_INSET = 11;

function SortButton({
  label,
  iconName,
  hintIconName,
  onPress,
}: {
  label: string;
  // The order this column is sorted in, while the user has sorted by it.
  iconName?: IKeyOfIcons;
  // The order this column is or would start in, shown only on hover.
  hintIconName?: IKeyOfIcons;
  onPress?: IXStackProps['onPress'];
}) {
  // Tracked here rather than with a Tamagui group: a group makes the button a
  // size container on web, which collapses its width under the label.
  const [hovered, setHovered] = useState(false);
  const shownIconName = iconName ?? hintIconName;
  let iconOpacity = 0;
  if (iconName) iconOpacity = 1;
  else if (hovered) iconOpacity = 0.6;
  return (
    <XStack
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      role="button"
      alignItems="center"
      py="$1"
      px="$1.5"
      my="$-1"
      mx="$-1.5"
      borderRadius={6}
      hoverStyle={{
        bg: '$bgHover',
      }}
      pressStyle={{
        bg: '$bgActive',
      }}
      focusable
      focusVisibleStyle={{
        outlineColor: '$focusRing',
        outlineStyle: 'solid',
        outlineOffset: 0,
        outlineWidth: 2,
      }}
      userSelect="none"
      onPress={onPress}
    >
      <SizableText
        size="$headingXs"
        color="$textSubdued"
        textTransform="uppercase"
      >
        {label}
      </SizableText>
      {shownIconName ? (
        // Centered on the button's midline, which the uppercase label shares;
        // a fixed top offset left it about 2px low on web.
        <Stack
          position="absolute"
          right="$-3.5"
          top={0}
          bottom={0}
          justifyContent="center"
          opacity={iconOpacity}
        >
          <Icon name={shownIconName} color="$iconSubdued" size="$4.5" />
        </Stack>
      ) : null}
    </XStack>
  );
}

function getSortIconName(direction: 'asc' | 'desc'): IKeyOfIcons {
  return direction === 'desc'
    ? 'ChevronDownSmallOutline'
    : 'ChevronTopSmallOutline';
}

function TokenListHeader({ tableLayout, withSwapAction }: IProps) {
  const intl = useIntl();
  const { gtMd } = useMedia();
  const [{ sortType, sortDirection }] = useTokenListSortAtom();
  const { updateTokenListSort } = useTokenListActions().current;

  // An arrow only ever shows a column's order. The column the user sorted by
  // keeps it; the opening order (value, highest first) shows it on hover only,
  // as do the other columns, which a press starts high to low.
  const sortIcons = useCallback(
    (
      type: ETokenListSortType,
    ): { iconName?: IKeyOfIcons; hintIconName?: IKeyOfIcons } => {
      if (sortType !== type) {
        return { hintIconName: getSortIconName('desc') };
      }
      const isDefaultSort =
        sortType === TOKEN_LIST_DEFAULT_SORT.sortType &&
        sortDirection === TOKEN_LIST_DEFAULT_SORT.sortDirection;
      return isDefaultSort
        ? { hintIconName: getSortIconName(sortDirection) }
        : { iconName: getSortIconName(sortDirection) };
    },
    [sortDirection, sortType],
  );

  if (!tableLayout) {
    return null;
  }

  const { leadingWidth, cellGap, containerProps } =
    getTokenListHeaderLayout(gtMd);
  // Pull the asset label back over the leading slot so it starts at the row
  // edge while the column itself keeps the row's cell width.
  const assetLabelInset = -(leadingWidth + cellGap);
  const columnWeights = getTokenTableColumnWeights(withSwapAction);
  // Web rows read asset | price | balance with no Swap spacer (see
  // NativeTokenSelectorList); native tablets keep asset | balance | price.
  const holdingsLast = !platformEnv.isNative;
  const balanceHeader = (
    <Stack
      key="balance"
      flexGrow={columnWeights.balance}
      flexBasis={0}
      alignItems="flex-end"
    >
      <SortButton
        label={intl.formatMessage({ id: ETranslations.global_balance })}
        {...sortIcons(ETokenListSortType.Value)}
        onPress={() => {
          updateTokenListSort({
            sortType: ETokenListSortType.Value,
            sortDirection: sortDirection === 'asc' ? 'desc' : 'asc',
          });
        }}
      />
    </Stack>
  );
  const priceHeader = (
    <Stack
      key="price"
      flexGrow={columnWeights.price}
      flexBasis={0}
      alignItems="flex-end"
    >
      <SortButton
        label={intl.formatMessage({ id: ETranslations.global_price })}
        {...sortIcons(ETokenListSortType.Price)}
        onPress={() => {
          updateTokenListSort({
            sortType: ETokenListSortType.Price,
            sortDirection: sortDirection === 'asc' ? 'desc' : 'asc',
          });
        }}
      />
    </Stack>
  );

  return (
    <ListItem
      testID="Wallet-Token-List-Header"
      minHeight={32}
      gap={cellGap}
      {...containerProps}
    >
      <Stack width={leadingWidth} />
      <XStack flex={1} gap={cellGap}>
        <Stack
          flexGrow={columnWeights.asset}
          flexBasis={0}
          alignItems="flex-start"
        >
          <Stack ml={assetLabelInset}>
            <SortButton
              label={intl.formatMessage({ id: ETranslations.global_asset })}
              {...sortIcons(ETokenListSortType.Name)}
              onPress={() => {
                updateTokenListSort({
                  sortType: ETokenListSortType.Name,
                  sortDirection: sortDirection === 'asc' ? 'desc' : 'asc',
                });
              }}
            />
          </Stack>
        </Stack>
        {holdingsLast
          ? [priceHeader, balanceHeader]
          : [balanceHeader, priceHeader]}
        {columnWeights.swapSpacer && !holdingsLast ? (
          <Stack flexGrow={columnWeights.swapSpacer} flexBasis={0} />
        ) : null}
      </XStack>
      {withSwapAction ? (
        <SizableText
          size="$bodyMdMedium"
          px={SWAP_BUTTON_HORIZONTAL_INSET}
          opacity={0}
          pointerEvents="none"
          aria-hidden
        >
          {intl.formatMessage({ id: ETranslations.global_swap })}
        </SizableText>
      ) : null}
    </ListItem>
  );
}

export { TokenListHeader };
