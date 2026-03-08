import { memo, useEffect, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import { Alert, SizableText, XStack } from '@onekeyhq/components';
import { usePerpsNetworkStatusAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { NetworkStatusBadge } from '../../../components/NetworkStatusBadge';

// Delay to allow WebSocket auto-reconnection before showing alert
const ALERT_SHOW_DELAY_MS = 5000;

function PerpMobileNetworkAlertComponent() {
  const intl = useIntl();
  const [networkStatus] = usePerpsNetworkStatusAtom();
  const [shouldShowAlert, setShouldShowAlert] = useState(false);

  const isDisconnected = networkStatus?.connected === false;
  const isConnected = networkStatus?.connected === true;
  const pingMs = networkStatus?.pingMs;

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

  const connectedLabel = useMemo(() => {
    if (isConnected && pingMs !== null && pingMs !== undefined) {
      return `${intl.formatMessage({ id: ETranslations.perp_online })} ${pingMs}ms`;
    }
    return undefined;
  }, [isConnected, pingMs, intl]);

  // Show compact badge when connected (with or without ping data to avoid layout shift)
  if (isConnected) {
    return (
      <XStack px="$4" py="$1.5" alignItems="center">
        <NetworkStatusBadge connected label={connectedLabel} badgeSize="sm" />
      </XStack>
    );
  }

  // Show disconnected alert after delay (existing behavior unchanged)
  if (!shouldShowAlert) {
    return null;
  }

  return (
    <Alert
      type="default"
      fullBleed
      icon="SignalOutline"
      descriptionComponent={
        <SizableText size="$bodySm" color="$textSubdued">
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
