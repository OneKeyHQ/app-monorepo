import { useIntl } from 'react-intl';

import { SearchBar, SizableText, Stack, XStack } from '@onekeyhq/components';
import type { IAccountToken } from '@onekeyhq/shared/types/token';

type IProps = {
  tokens: IAccountToken[];
  tableLayout?: boolean;
};

function TokenListHeader({ tableLayout, tokens }: IProps) {
  const intl = useIntl();
  return (
    <Stack px="$5" pb="$3">
      <XStack justifyContent="space-between">
        {tokens.length > 10 && (
          <SearchBar
            placeholder="Search..."
            containerProps={{
              flex: 1,
              mr: '$2.5',
              mt: '$5',
              maxWidth: '$80',
            }}
          />
        )}
      </XStack>
      {tableLayout && (
        <XStack space="$3" pt="$5">
          <SizableText
            color="$textSubdued"
            size="$headingSm"
            w="$64"
            mr="$3"
            $gtXl={{
              w: '$80',
            }}
          >
            {intl.formatMessage({ id: 'form__token' })}
          </SizableText>
          <SizableText
            color="$textSubdued"
            size="$headingSm"
            textAlign="left"
            w="$52"
            $gtXl={{
              w: '$72',
            }}
          >
            {intl.formatMessage({ id: 'form__balance' })}
          </SizableText>
          <XStack space="$2">
            <SizableText
              color="$textSubdued"
              textAlign="left"
              size="$headingSm"
              w="$52"
              $gtXl={{
                w: '$72',
              }}
            >
              {intl.formatMessage({ id: 'content__price' })}
            </SizableText>
          </XStack>

          <SizableText
            flex={1}
            textAlign="right"
            color="$textSubdued"
            size="$headingSm"
          >
            {intl.formatMessage({ id: 'form__value' })}
          </SizableText>
        </XStack>
      )}
    </Stack>
  );
}

export { TokenListHeader };
