import { useIntl } from 'react-intl';

import {
  Button,
  SearchBar,
  SizableText,
  Stack,
  XStack,
  useMedia,
} from '@onekeyhq/components';

import useAppNavigation from '../../hooks/useAppNavigation';
import { EModalRoutes } from '../../routes/Modal/type';
import { ETokenPages } from '../../views/Token/router/type';

type IProps = {
  tableLayout?: boolean;
};

function TokenListHeader({ tableLayout }: IProps) {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const media = useMedia();

  const handleHiddenPress = () => {
    navigation.pushModal(EModalRoutes.TokenModal, {
      screen: ETokenPages.TokenList,
      params: {
        title: 'Blocked Assets',
      },
    });
  };

  return (
    <Stack p="$5" pb="$3">
      <XStack justifyContent="space-between">
        <SearchBar
          placeholder="Search..."
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
          onPress={handleHiddenPress}
        >
          3 Blocked
        </Button>
      </XStack>
      {tableLayout && (
        <XStack space="$3" pt="$5">
          <SizableText color="$textSubdued" size="$headingXs" mr={44} w="$32">
            Assets
          </SizableText>
          <XStack space="$2">
            <SizableText
              color="$textSubdued"
              textAlign="right"
              size="$headingXs"
              w="$32"
              $gtXl={{
                w: '$56',
              }}
              $gt2xl={{
                w: '$72',
              }}
            >
              Price
            </SizableText>
            <Stack w="$24" />
          </XStack>
          <SizableText
            color="$textSubdued"
            size="$headingXs"
            textAlign="right"
            w="$36"
            $gtXl={{
              w: '$56',
            }}
            $gt2xl={{
              w: '$72',
            }}
          >
            Amount
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
