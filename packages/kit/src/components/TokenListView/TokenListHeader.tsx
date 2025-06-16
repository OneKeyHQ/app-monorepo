import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Button, Stack, XStack } from '@onekeyhq/components';
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

function TokenListHeader({ tableLayout }: IProps) {
  const intl = useIntl();
  const [{ sortType, sortDirection }] = useTokenListSortAtom();
  const { updateTokenListSort } = useTokenListActions().current;

  const renderSortButton = useCallback(
    (type: ETokenListSortType) => {
      if (sortType === type) {
        return sortDirection === 'desc'
          ? 'ChevronTriangleDownSmallOutline'
          : 'ChevronTriangleUpSmallOutline';
      }
    },
    [sortDirection, sortType],
  );

  return (
    <Stack testID="Wallet-Token-List-Header">
      {tableLayout ? (
        <XStack px="$5" py="$2" gap="$3">
          <XStack flexGrow={1} flexBasis={0} gap="$3">
            <XStack flexGrow={1} flexBasis={0} justifyContent="flex-start">
              <Button
                size="small"
                variant="tertiary"
                cursor="pointer"
                iconAfter={renderSortButton(ETokenListSortType.Name)}
                onPress={() => {
                  updateTokenListSort({
                    sortType: ETokenListSortType.Name,
                    sortDirection: sortDirection === 'asc' ? 'desc' : 'asc',
                  });
                }}
              >
                {intl.formatMessage({ id: ETranslations.global_asset })}
              </Button>
            </XStack>
            <XStack flexGrow={1} flexBasis={0} justifyContent="flex-end">
              <Button
                size="small"
                variant="tertiary"
                cursor="pointer"
                iconAfter={renderSortButton(ETokenListSortType.Price)}
                onPress={() => {
                  updateTokenListSort({
                    sortType: ETokenListSortType.Price,
                    sortDirection: sortDirection === 'asc' ? 'desc' : 'asc',
                  });
                }}
              >
                {intl.formatMessage({ id: ETranslations.global_price })}
              </Button>
            </XStack>
          </XStack>
          <Stack w="$8" />
          <XStack flexGrow={1} flexBasis={0}>
            <XStack flexGrow={1} flexBasis={0} justifyContent="flex-end">
              <Button
                size="small"
                variant="tertiary"
                cursor="pointer"
                iconAfter={renderSortButton(ETokenListSortType.Value)}
                onPress={() => {
                  updateTokenListSort({
                    sortType: ETokenListSortType.Value,
                    sortDirection: sortDirection === 'asc' ? 'desc' : 'asc',
                  });
                }}
              >
                {intl.formatMessage({ id: ETranslations.global_balance })}
              </Button>
            </XStack>
            <Stack flexGrow={1} flexBasis={0} />
            {/* <SizableText
              flexGrow={1}
              flexBasis={0}
              textAlign="right"
              color="$textSubdued"
              size="$bodyMdMedium"
            >
              {intl.formatMessage({ id: ETranslations.global_value })}
            </SizableText> */}
          </XStack>
        </XStack>
      ) : null}
    </Stack>
  );
}

export { TokenListHeader };
