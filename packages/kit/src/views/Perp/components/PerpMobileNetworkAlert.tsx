import { memo } from 'react';

import { useIntl } from 'react-intl';

import { Alert, SizableText } from '@onekeyhq/components';
import { usePerpsNetworkStatusAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';

function PerpMobileNetworkAlertComponent() {
  const intl = useIntl();
  const [networkStatus] = usePerpsNetworkStatusAtom();

  if (networkStatus?.connected !== false) {
    return null;
  }

  return (
    <Alert
      type="critical"
      fullBleed
      icon="ChartColumnarSignalOutline"
      descriptionComponent={
        <SizableText size="$bodySm" color="$textCritical">
          {intl.formatMessage({
            id: ETranslations.perps_offline_moblie,
          })}
        </SizableText>
      }
      closable={false}
      px="$4"
    />
  );
}

export const PerpMobileNetworkAlert = memo(PerpMobileNetworkAlertComponent);
