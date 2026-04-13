import { useIntl } from 'react-intl';

import { Icon, Popover, SizableText, Stack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { swapServiceFeeDefault } from '@onekeyhq/shared/types/swap/SwapProvider.constants';

export function SwapServiceFeeOverview({
  percentageFee,
}: {
  percentageFee?: number;
}) {
  const intl = useIntl();
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
        <Stack gap="$1" p="$4">
          <SizableText size="$bodyMd" color="$textSubdued">
            {intl.formatMessage(
              {
                id: ETranslations.provider_popover_onekey_fee_content,
              },
              {
                number: `${percentageFee ?? swapServiceFeeDefault}%`,
              },
            )}
          </SizableText>
          <SizableText size="$bodyMd" color="$textSubdued">
            {intl.formatMessage({
              id: ETranslations.provider_ios_popover_onekey_fee_content_2,
            })}
          </SizableText>
        </Stack>
      }
    />
  );
}
