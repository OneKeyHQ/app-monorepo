import { memo } from 'react';

import { useIntl } from 'react-intl';

import { Alert, YStack } from '@onekeyhq/components';
import { usePerpsNetworkStatusAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';

function PerpNetworkAlertComponent() {
  const intl = useIntl();
  const [networkStatus] = usePerpsNetworkStatusAtom();

  if (networkStatus?.connected !== false) {
    return null;
  }

  return (
    <YStack height={0} overflow="visible" zIndex={10}>
      <Alert
        type="default"
        fullBleed
        title={intl.formatMessage({
          id: ETranslations.perps_offline_moblie,
        })}
        closable={false}
        px="$4"
      />
    </YStack>
  );
}

export const PerpNetworkAlert = memo(PerpNetworkAlertComponent);
