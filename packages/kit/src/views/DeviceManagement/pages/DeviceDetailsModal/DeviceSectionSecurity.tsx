import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { useDeviceDetailsActions } from '@onekeyhq/kit/src/states/jotai/contexts/deviceDetails';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { ListItemGroup } from '../ListItemGroup';

function DeviceSectionSecurity() {
  const intl = useIntl();
  const actions = useDeviceDetailsActions();

  const onPressChangePin = useCallback(async () => {
    const device = await actions.getWalletWithDevice();
    if (!device?.wallet) return;
    if (!device.device?.connectId) return;
    await backgroundApiProxy.serviceHardware.changePin({
      walletId: device.wallet.id,
      connectId: device.device?.connectId,
      remove: false,
    });
  }, [actions]);

  return (
    <ListItemGroup
      withSeparator
      itemProps={{ minHeight: '$12' }}
      title={intl.formatMessage({
        id: ETranslations.global_security,
      })}
    >
      <ListItem
        title={intl.formatMessage({
          id: ETranslations.global_change_pin,
        })}
        titleProps={{ size: '$bodyMdMedium', color: '$text' }}
        drillIn
        onPress={onPressChangePin}
      />
    </ListItemGroup>
  );
}

export default DeviceSectionSecurity;
