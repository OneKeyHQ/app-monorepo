import { useIntl } from 'react-intl';

import { Icon, Popover, SizableText, Stack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { ProtocolFeeComparisonList } from './ProtocolFeeComparisonList';

export function SwapServiceFeeOverview({
  onekeyFee,
}: {
  onekeyFee: number | undefined;
}) {
  const intl = useIntl();
  const serviceFee = onekeyFee ?? 0.3;
  return (
    <Popover
      title={intl.formatMessage({
        id: ETranslations.provider_ios_popover_onekey_fee,
      })}
      renderTrigger={
        <Icon
          name="InfoCircleOutline"
          size="$3.5"
          cursor="pointer"
          color="$iconSubdued"
        />
      }
      renderContent={
        <Stack gap="$4" p="$4">
          <Stack gap="$1">
            <SizableText size="$bodyMd" color="$textSubdued">
              {intl.formatMessage(
                {
                  id: ETranslations.provider_ios_popover_onekey_fee_content,
                },
                { num: `${serviceFee}%` },
              )}
            </SizableText>
            <SizableText size="$bodyMd" color="$textSubdued">
              {intl.formatMessage(
                {
                  id: ETranslations.provider_ios_popover_onekey_fee_content_2,
                },
                { num: `${serviceFee}%` },
              )}
            </SizableText>
          </Stack>
          <ProtocolFeeComparisonList serviceFee={serviceFee} />
        </Stack>
      }
    />
  );
}
