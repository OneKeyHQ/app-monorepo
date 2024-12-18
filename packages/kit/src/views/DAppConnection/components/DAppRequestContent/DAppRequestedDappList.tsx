import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  Icon,
  Image,
  SizableText,
  Skeleton,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

export function DAppRequestedDappList({
  origins = [],
  updatedAt,
}: {
  updatedAt?: string;
  origins?: {
    name: string;
    logo: string;
  }[];
}) {
  const intl = useIntl();
  return origins.length ? (
    <YStack>
      <SizableText size="$headingMd">
        {intl.formatMessage({
          id: ETranslations.browser_dapp_listed_by,
        })}
      </SizableText>
      <XStack gap="$2" pt="$3" flexWrap="wrap">
        {origins.map((item) => (
          <XStack
            key={item.name}
            px="$2"
            py="$1"
            bg="$bgSubdued"
            borderRadius="$2"
            borderColor="$borderSubdued"
            borderWidth={StyleSheet.hairlineWidth}
          >
            <Image w="$5" h="$5" bg="$bgSubdued" borderRadius="$1">
              <Image.Source
                source={{
                  uri: item.logo,
                }}
              />
              <Image.Fallback>
                <Icon size="$5" name="GlobusOutline" color="$iconSubdued" />
              </Image.Fallback>
              <Image.Loading>
                <Skeleton width="100%" height="100%" />
              </Image.Loading>
            </Image>
          </XStack>
        ))}
      </XStack>
      {updatedAt ? (
        <SizableText mt="$2" color="$textSubdued" size="$bodyMd">
          {`${intl.formatMessage({
            id: ETranslations.browser_last_verified_at,
          })} ${updatedAt}`}
        </SizableText>
      ) : null}
    </YStack>
  ) : null;
}
