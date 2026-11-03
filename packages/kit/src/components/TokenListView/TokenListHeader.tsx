import { useCallback } from 'react';

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
import { ETokenListSortType } from '@onekeyhq/shared/types/token';

import {
  useTokenListActions,
  useTokenListSortAtom,
} from '../../states/jotai/contexts/tokenList';

import { getTokenListHeaderLayout } from './tokenListRowLayout';

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
  onPress,
}: {
  label: string;
  iconName?: IKeyOfIcons;
  onPress?: IXStackProps['onPress'];
}) {
  return (
    <XStack
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
      {iconName ? (
        <Stack position="absolute" right="$-3.5" top={5}>
          <Icon name={iconName} color="$iconSubdued" size="$4.5" />
        </Stack>
      ) : null}
    </XStack>
  );
}

function TokenListHeader({ tableLayout, withSwapAction }: IProps) {
  const intl = useIntl();
  const { gtMd } = useMedia();
  const [{ sortType, sortDirection }] = useTokenListSortAtom();
  const { updateTokenListSort } = useTokenListActions().current;

  const renderSortButton = useCallback(
    (type: ETokenListSortType) => {
      if (sortType === type) {
        return sortDirection === 'desc'
          ? 'ChevronDownSmallOutline'
          : 'ChevronTopSmallOutline';
      }
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

  return (
    <ListItem
      testID="Wallet-Token-List-Header"
      minHeight={32}
      gap={cellGap}
      {...containerProps}
    >
      <Stack width={leadingWidth} />
      <XStack flex={1} gap={cellGap}>
        <Stack flexGrow={1} flexBasis={0} alignItems="flex-start">
          <Stack ml={assetLabelInset}>
            <SortButton
              label={intl.formatMessage({ id: ETranslations.global_asset })}
              iconName={renderSortButton(ETokenListSortType.Name)}
              onPress={() => {
                updateTokenListSort({
                  sortType: ETokenListSortType.Name,
                  sortDirection: sortDirection === 'asc' ? 'desc' : 'asc',
                });
              }}
            />
          </Stack>
        </Stack>
        <Stack flexGrow={1} flexBasis={0} alignItems="flex-end">
          <SortButton
            label={intl.formatMessage({ id: ETranslations.global_balance })}
            iconName={renderSortButton(ETokenListSortType.Value)}
            onPress={() => {
              updateTokenListSort({
                sortType: ETokenListSortType.Value,
                sortDirection: sortDirection === 'asc' ? 'desc' : 'asc',
              });
            }}
          />
        </Stack>
        <Stack flexGrow={1} flexBasis={0} alignItems="flex-end">
          <SortButton
            label={intl.formatMessage({ id: ETranslations.global_price })}
            iconName={renderSortButton(ETokenListSortType.Price)}
            onPress={() => {
              updateTokenListSort({
                sortType: ETokenListSortType.Price,
                sortDirection: sortDirection === 'asc' ? 'desc' : 'asc',
              });
            }}
          />
        </Stack>
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
