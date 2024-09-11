import { useIntl } from 'react-intl';

import {
  Icon,
  ScrollView,
  SizableText,
  Stack,
  YStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

export const AssetProtocolContent = ({
  liquidStaking,
}: {
  liquidStaking?: boolean;
}) => {
  const intl = useIntl();
  return (
    <YStack flex={1}>
      <ScrollView maxHeight={560}>
        <YStack pb="$5">
          <Stack>
            <Stack
              w="$14"
              h="$14"
              jc="center"
              ai="center"
              bg="$bgStrong"
              borderRadius="$full"
            >
              <Icon name="InfoCircleOutline" w="$8" h="$8" />
            </Stack>
            <YStack mt="$5">
              <SizableText size="$headingXl">
                {intl.formatMessage({ id: ETranslations.earn_staking_methods })}
              </SizableText>
            </YStack>
            <YStack mt="$5" gap="$5">
              <YStack>
                <SizableText size="$bodyLgMedium">
                  {intl.formatMessage({
                    id: ETranslations.earn_what_is_native_staking,
                  })}
                </SizableText>
                <SizableText size="$bodyMd" color="$textSubdued">
                  {intl.formatMessage({
                    id: ETranslations.earn_what_is_native_staking_desc,
                  })}
                </SizableText>
              </YStack>
              {liquidStaking ? (
                <YStack>
                  <SizableText size="$bodyLgMedium">
                    {intl.formatMessage({
                      id: ETranslations.earn_what_is_liquid_staking,
                    })}
                  </SizableText>
                  <SizableText size="$bodyMd" color="$textSubdued">
                    {intl.formatMessage({
                      id: ETranslations.earn_what_is_liquid_staking_desc,
                    })}
                  </SizableText>
                </YStack>
              ) : null}
            </YStack>
          </Stack>
        </YStack>
      </ScrollView>
    </YStack>
  );
};
