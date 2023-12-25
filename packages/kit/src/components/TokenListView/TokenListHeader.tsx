import { useIntl } from 'react-intl';

import {
  Button,
  SearchBar,
  SizableText,
  Stack,
  XStack,
  useMedia,
} from '@onekeyhq/components';

type IProps = {
  tableLayout?: boolean;
};

function TokenListHeader({ tableLayout }: IProps) {
  const intl = useIntl();
  const media = useMedia();

  return (
    <Stack>
      <XStack justifyContent="space-between">
        <SearchBar
          placeholder="Search token"
          containerProps={{
            flex: 1,
            mr: '$2.5',
            maxWidth: '$80',
          }}
        />
        <Button
          {...(media.gtMd && {
            icon: 'EyeOffOutline',
          })}
        >
          3 Hidden
        </Button>
      </XStack>
      {tableLayout && (
        <XStack space="$3" pt="$5">
          <SizableText
            color="$textSubdued"
            size="$headingXs"
            mr={44}
            w="$56"
            $gt2xl={{
              w: '$72',
            }}
          >
            Name
          </SizableText>
          <SizableText
            color="$textSubdued"
            size="$headingXs"
            w="$48"
            $gt2xl={{
              w: '$72',
            }}
          >
            Balance
          </SizableText>
          {media.gtXl && (
            <SizableText
              color="$textSubdued"
              size="$headingXs"
              textAlign="right"
              w="$40"
              $gt2xl={{
                w: '$72',
              }}
            >
              Price
            </SizableText>
          )}
          <SizableText
            color="$textSubdued"
            size="$headingXs"
            $gtXl={{
              color: '$textDisabled',
            }}
          >
            24h Change
          </SizableText>
          <SizableText
            flex={1}
            textAlign="right"
            color="$textSubdued"
            size="$headingXs"
          >
            Value
          </SizableText>
        </XStack>
      )}
    </Stack>
  );
}

export { TokenListHeader };
