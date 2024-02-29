import { debounce } from 'lodash';
import { useIntl } from 'react-intl';

import type { IInputProps } from '@onekeyhq/components';
import {
  SearchBar,
  SizableText,
  Stack,
  XStack,
  useMedia,
} from '@onekeyhq/components';
import type { IAccountToken } from '@onekeyhq/shared/types/token';

import { useTokenListActions } from '../../states/jotai/contexts/tokenList';

type IProps = {
  tokens: IAccountToken[];
  tableLayout?: boolean;
};

export function WalletListHeaderToolBar({
  onChangeText,
}: {
  onChangeText: IInputProps['onChangeText'];
}) {
  const media = useMedia();

  return (
    <XStack px="$5" py="$2">
      <SearchBar
        placeholder="Search..."
        containerProps={{
          flex: 1,
          maxWidth: '$60',
        }}
        onChangeText={onChangeText}
        {...(media.gtMd && {
          size: 'small',
        })}
      />
    </XStack>
  );
}

function TokenListHeader({ tableLayout, tokens }: IProps) {
  const intl = useIntl();
  const { updateSearchKey } = useTokenListActions().current;

  return (
    <Stack>
      {tokens.length > 10 && (
        <WalletListHeaderToolBar
          onChangeText={debounce(
            (searchKey) => updateSearchKey(searchKey),
            800,
          )}
        />
      )}

      {tableLayout && (
        <XStack px="$5" py="$2" space="$3">
          <XStack flex={1}>
            <SizableText flex={1} color="$textSubdued" size="$headingSm">
              {intl.formatMessage({ id: 'form__token' })}
            </SizableText>
            <SizableText flex={1} color="$textSubdued" size="$headingSm">
              {intl.formatMessage({ id: 'form__balance' })}
            </SizableText>
          </XStack>
          <XStack flex={1}>
            <SizableText flex={1} color="$textSubdued" size="$headingSm">
              {intl.formatMessage({ id: 'content__price' })}
            </SizableText>
            <SizableText
              flex={1}
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
