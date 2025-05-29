import type { FC } from 'react';

import {
  Icon,
  ScrollView,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type { IMarketTokenSecurity } from '@onekeyhq/shared/types/marketV2';

import { formatSecurityData } from './useTokenSecurity';

type ITokenSecurityAlertDialogContentProps = {
  securityData: IMarketTokenSecurity | null;
  error: string | null;
  loading: boolean;
};

const TokenSecurityAlertDialogContent: FC<
  ITokenSecurityAlertDialogContentProps
> = ({ securityData, error, loading }) => {
  const formattedData = formatSecurityData(securityData);

  return (
    <ScrollView maxHeight="$96">
      <Stack gap="$4" p="$4">
        {loading ? (
          <XStack gap="$2" alignItems="center" justifyContent="center" py="$4">
            <Icon name="LoaderSolid" size="$4" color="$iconSubdued" />
            <SizableText color="$textSubdued">
              Loading security data...
            </SizableText>
          </XStack>
        ) : null}

        {error ? (
          <XStack
            gap="$2"
            alignItems="center"
            p="$3"
            bg="$bgCritical"
            borderRadius="$2"
          >
            <Icon name="InfoCircleOutline" size="$4" color="$iconCritical" />
            <SizableText color="$textCritical" flex={1}>
              {error}
            </SizableText>
          </XStack>
        ) : null}

        {formattedData.length > 0 ? (
          <YStack gap="$3">
            {formattedData.map((item) => {
              const iconName = item.isWarning
                ? 'InfoCircleOutline'
                : 'CheckLargeOutline';
              const iconColor = item.isWarning
                ? '$iconCaution'
                : '$iconSuccess';

              return (
                <XStack
                  key={item.key}
                  justifyContent="space-between"
                  alignItems="center"
                  p="$2"
                  bg={item.isWarning ? '$bgCautionSubdued' : '$bgStrong'}
                  borderRadius="$1"
                >
                  <SizableText
                    size="$bodyMd"
                    color={item.isWarning ? '$textCaution' : '$text'}
                    flex={1}
                  >
                    {item.label}
                  </SizableText>

                  <XStack gap="$2" alignItems="center">
                    {item.value ? (
                      <SizableText
                        size="$bodyMdMedium"
                        color={item.isWarning ? '$textCaution' : '$textSuccess'}
                        textAlign="right"
                      >
                        {item.value}
                      </SizableText>
                    ) : null}
                    <Icon name={iconName} size="$3" color={iconColor} />
                  </XStack>
                </XStack>
              );
            })}
          </YStack>
        ) : null}

        {securityData && !loading && formattedData.length === 0 ? (
          <XStack gap="$2" alignItems="center" justifyContent="center" py="$4">
            <Icon name="CheckLargeOutline" size="$4" color="$iconSuccess" />
            <SizableText color="$textSuccess">
              No security issues detected
            </SizableText>
          </XStack>
        ) : null}
      </Stack>
    </ScrollView>
  );
};

export { TokenSecurityAlertDialogContent };
