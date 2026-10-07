import { memo } from 'react';

import { useIntl } from 'react-intl';
import { Platform, StyleSheet } from 'react-native';

import { Alert, YStack } from '@onekeyhq/components';
import { usePerpsNetworkStatusAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

function PerpNetworkAlertComponent() {
  const intl = useIntl();
  const [networkStatus] = usePerpsNetworkStatusAtom();

  if (networkStatus?.connected !== false) {
    return null;
  }

  return (
    <YStack overflow="visible" zIndex={10}>
      <Alert
        type="default"
        fullBleed
        icon="ChartColumnarSignal2Outline"
        title={intl.formatMessage({
          id: Platform.select({
            web: ETranslations.perps_offline_desktop__msg,
            default: ETranslations.perps_offline_moblie,
          }),
        })}
        closable={false}
        px="$4"
        {...Platform.select({
          web: {
            borderTopWidth: 0,
            borderBottomWidth: platformEnv.isWeb ? StyleSheet.hairlineWidth : 0,
          },
        })}
      />
    </YStack>
  );
}

export const PerpNetworkAlert = memo(PerpNetworkAlertComponent);
