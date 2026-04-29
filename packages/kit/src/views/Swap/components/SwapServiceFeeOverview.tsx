import { useIntl } from 'react-intl';

import { Icon, Popover, SizableText } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

export function SwapServiceFeeOverview(_props: {
  percentageFee?: number;
  percentOriginFee?: number;
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
        <SizableText p="$4" size="$bodyMd" color="$textSubdued">
          {intl.formatMessage({
            id: ETranslations.provider_popover_onekey_fee_content_nofee,
          })}
        </SizableText>
      }
    />
  );
}
