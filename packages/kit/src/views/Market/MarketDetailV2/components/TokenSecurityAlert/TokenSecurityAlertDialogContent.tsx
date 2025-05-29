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

import TokenSecurityAlertDialogContentOverview from './TokenSecurityAlertDialogContentOverview';
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
  const warningCount = formattedData.filter((item) => item.isWarning).length;

  return (
    <ScrollView maxHeight="$96">
      <Stack gap="$4">
        {/* Overview section with warning count */}
        <TokenSecurityAlertDialogContentOverview
          warningCount={warningCount}
          totalChecks={formattedData.length}
          loading={loading}
          error={error}
        />

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
                ? 'XCircleOutline'
                : 'CheckRadioSolid';
              const iconColor = item.isWarning
                ? '$iconCritical'
                : '$iconSuccess';

              return (
                <XStack
                  key={item.key}
                  justifyContent="space-between"
                  alignItems="center"
                  p="$2"
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

                    <Icon name={iconName} size="$4" color={iconColor} />
                  </XStack>
                </XStack>
              );
            })}
          </YStack>
        ) : null}

        {securityData && !loading && formattedData.length === 0 ? (
          <XStack gap="$2" alignItems="center" justifyContent="center" py="$4">
            <Icon name="CheckRadioSolid" size="$4" color="$iconSuccess" />

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
