import { memo, useEffect, useState } from 'react';

import { useIntl } from 'react-intl';

import { Alert, SizableText } from '@onekeyhq/components';
import { usePerpsNetworkStatusAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';

const ALERT_SHOW_DELAY_MS = 1500;

function PerpMobileNetworkAlertComponent() {
  const intl = useIntl();
  const [networkStatus] = usePerpsNetworkStatusAtom();
  const [shouldShowAlert, setShouldShowAlert] = useState(false);

  const isDisconnected = networkStatus?.connected === false;

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;

    if (isDisconnected) {
      timer = setTimeout(() => {
        setShouldShowAlert(true);
      }, ALERT_SHOW_DELAY_MS);
    } else {
      setShouldShowAlert(false);
    }

    return () => {
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [isDisconnected]);

  if (!shouldShowAlert) {
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
