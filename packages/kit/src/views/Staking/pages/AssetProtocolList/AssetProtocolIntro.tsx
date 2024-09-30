import { useIntl } from 'react-intl';

import { ScrollView, SizableText, Stack, YStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IStakeProviderInfo } from '@onekeyhq/shared/types/staking';

export const AssetProtocolContent = ({
  providerTypes,
}: {
  providerTypes?: IStakeProviderInfo['type'][];
}) => {
  const intl = useIntl();
  let showNativeStaking = true;
  let showLiquidStaking = true;
  if (providerTypes && providerTypes.length > 0) {
    showNativeStaking = providerTypes.includes('native');
    showLiquidStaking = providerTypes.includes('liquid');
  }
  return (
    <YStack flex={1}>
      <ScrollView maxHeight={560}>
        <YStack>
          <Stack>
            <YStack gap="$5">
              {showNativeStaking ? (
                <YStack gap={6}>
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
              ) : null}
              {showLiquidStaking ? (
                <YStack gap={6}>
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
