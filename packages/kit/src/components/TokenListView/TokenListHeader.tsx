import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import type { IKeyOfIcons, IXStackProps } from '@onekeyhq/components';
import { Icon, SizableText, Stack, XStack } from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IAccountToken } from '@onekeyhq/shared/types/token';
import { ETokenListSortType } from '@onekeyhq/shared/types/token';

import {
  useTokenListActions,
  useTokenListSortAtom,
} from '../../states/jotai/contexts/tokenList';

type IProps = {
  filteredTokens: IAccountToken[];
  tableLayout?: boolean;
  onManageToken?: () => void;
  manageTokenEnabled?: boolean;
};

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
      <SizableText size="$bodyMdMedium" color="$textSubdued">
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

function TokenListHeader({ tableLayout }: IProps) {
  const intl = useIntl();
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

  return (
    <ListItem testID="Wallet-Token-List-Header">
      <Stack flexGrow={1} flexBasis={0} alignItems="flex-start">
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
      <Stack flexGrow={1} flexBasis={0} maxWidth="$36" alignItems="flex-end">
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
      <Stack flexGrow={1} flexBasis={0} />
    </ListItem>
  );
}

export { TokenListHeader };
