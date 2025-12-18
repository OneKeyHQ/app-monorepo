import { memo } from 'react';

import { useIntl } from 'react-intl';

import { Alert, SizableText, useMedia } from '@onekeyhq/components';
import { usePerpsNetworkStatusAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';

function PerpMobileNetworkAlertComponent() {
  const intl = useIntl();
  const { gtSm } = useMedia();
  const [networkStatus] = usePerpsNetworkStatusAtom();

  // Only show on small screens (!gtSm)
  // Desktop uses Footer network status badge
  if (gtSm) {
    return null;
  }

  // Don't show if connected or undefined (initial state)
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
