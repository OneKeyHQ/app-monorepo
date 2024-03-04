import { debounce } from 'lodash';
import { useIntl } from 'react-intl';

import { SizableText, Stack, XStack } from '@onekeyhq/components';
import type { IAccountToken } from '@onekeyhq/shared/types/token';

import {
  useSearchKeyAtom,
  useTokenListActions,
} from '../../states/jotai/contexts/tokenList';
import { ListToolToolBar } from '../ListToolBar';

type IProps = {
  tokens: IAccountToken[];
  filteredTokens: IAccountToken[];
  tableLayout?: boolean;
};

function TokenListHeader({ tableLayout, tokens, filteredTokens }: IProps) {
  const intl = useIntl();
  const { updateSearchKey } = useTokenListActions().current;
  const [searchKey] = useSearchKeyAtom();

  return (
    <Stack testID="Wallet-Token-List-Header">
      <ListToolToolBar
        searchProps={
          tokens.length > 10
            ? {
                onChangeText: debounce((text) => updateSearchKey(text), 800),
                searchResultCount:
                  searchKey && searchKey.length > 2 ? filteredTokens.length : 0,
              }
            : undefined
        }
      />

      {tableLayout && (
        <XStack px="$5" py="$2" space="$3">
          <XStack
            flexGrow={1}
            flexBasis={0}
            space={89}
            spaceDirection="horizontal"
          >
            <SizableText
              flexGrow={1}
              flexBasis={0}
              color="$textSubdued"
              size="$headingSm"
            >
              Tokens
            </SizableText>
            <SizableText
              flexGrow={1}
              flexBasis={0}
              color="$textSubdued"
              size="$headingSm"
            >
              {intl.formatMessage({ id: 'form__balance' })}
            </SizableText>
          </XStack>
          <Stack w="$8" />
          <XStack flexGrow={1} flexBasis={0}>
            <SizableText
              flexGrow={1}
              flexBasis={0}
              color="$textSubdued"
              size="$headingSm"
            >
              {intl.formatMessage({ id: 'content__price' })}
            </SizableText>
            <SizableText
              flexGrow={1}
              flexBasis={0}
              textAlign="right"
              color="$textSubdued"
              size="$headingSm"
            >
              {intl.formatMessage({ id: 'form__value' })}
            </SizableText>
          </XStack>
        </XStack>
      )}
    </Stack>
  );
}

export { TokenListHeader };
