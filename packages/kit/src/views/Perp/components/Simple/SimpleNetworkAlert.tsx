import { memo } from 'react';

import { useIntl } from 'react-intl';

import { Icon, SizableText, XStack } from '@onekeyhq/components';
import { usePerpsNetworkStatusAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

function SimpleNetworkAlertComponent() {
  const intl = useIntl();
  const [networkStatus] = usePerpsNetworkStatusAtom();

  if (networkStatus?.connected !== false) {
    return null;
  }

  return (
    <XStack px="$3" gap="$2" alignItems="center">
      <Icon name="ChartColumnarSignal2Outline" size="$4" color="$iconSubdued" />
      <SizableText flex={1} size="$bodySm" color="$textSubdued">
        {intl.formatMessage({
          id: platformEnv.isNative
            ? ETranslations.perps_offline_moblie
            : ETranslations.perps_offline_desktop__msg,
        })}
      </SizableText>
    </XStack>
  );
}

export const SimpleNetworkAlert = memo(SimpleNetworkAlertComponent);
