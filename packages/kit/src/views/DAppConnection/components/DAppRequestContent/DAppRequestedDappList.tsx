import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  Icon,
  Image,
  SizableText,
  Skeleton,
  Tooltip,
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
    <YStack gap="$2">
      <YStack>
        <SizableText size="$headingSm" flex={1}>
          {intl.formatMessage({
            id: ETranslations.browser_dapp_listed_by,
          })}
        </SizableText>
        {updatedAt ? (
          <SizableText color="$textSubdued" size="$bodyMd">
            {`${intl.formatMessage({
              id: ETranslations.browser_last_verified_at,
            })}: ${updatedAt}`}
          </SizableText>
        ) : null}
      </YStack>
      <XStack gap="$2" flexWrap="wrap">
        {origins.map((item) => (
          <Tooltip
            key={item.name}
            renderContent={item.name}
            renderTrigger={
              <XStack
                px="$2"
                py="$1"
                bg="$bgSubdued"
                borderRadius="$2"
                borderColor="$borderSubdued"
                borderWidth={StyleSheet.hairlineWidth}
                borderCurve="continuous"
                hoverStyle={{
                  bg: '$bgHover',
                }}
              >
                <Image w="$5" h="$5">
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
            }
          />
        ))}
      </XStack>
    </YStack>
  ) : null;
}
