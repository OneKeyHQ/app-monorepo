import { useIntl } from 'react-intl';

import {
  Divider,
  Icon,
  ScrollView,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IMarketTokenSecurityData } from '@onekeyhq/shared/types/marketV2';

import { formatSecurityData } from '../utils';

import { TokenSecurityAlertDialogContentItem } from './TokenSecurityAlertDialogContentItem';
import { TokenSecurityAlertDialogContentOverview } from './TokenSecurityAlertDialogContentOverview';
import { TokenSecurityDisclaimer } from './TokenSecurityDisclaimer';

type ITokenSecurityAlertDialogContentProps = {
  securityData: IMarketTokenSecurityData | null;
  riskCount: number;
  cautionCount: number;
};

function TokenSecurityAlertDialogContent({
  securityData,
  riskCount,
  cautionCount,
}: ITokenSecurityAlertDialogContentProps) {
  const intl = useIntl();
  const formattedData = formatSecurityData(securityData);

  return (
    <ScrollView maxHeight="$96">
      <Stack gap="$4">
        {/* Overview section with warning count */}
        <TokenSecurityAlertDialogContentOverview
          riskCount={riskCount}
          cautionCount={cautionCount}
        />

        {formattedData.length > 0 ? (
          <YStack gap="$4">
            {formattedData.map((item) => {
              return (
                <TokenSecurityAlertDialogContentItem
                  key={item.key}
                  item={item}
                />
              );
            })}
          </YStack>
        ) : null}

        {securityData && formattedData.length === 0 ? (
          <XStack gap="$2" alignItems="center" justifyContent="center" py="$4">
            <Icon name="CheckRadioSolid" size="$5" color="$iconSuccess" />

            <SizableText color="$textSuccess">
              {intl.formatMessage({
                id: ETranslations.market_security_no_issues,
              })}
            </SizableText>
          </XStack>
        ) : null}

        <Divider />

        {/* Disclaimer */}
        <TokenSecurityDisclaimer />
      </Stack>
    </ScrollView>
  );
}

export { TokenSecurityAlertDialogContent };
