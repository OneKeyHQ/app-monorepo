import { useIntl } from 'react-intl';

import { useFirmwareUpdateActions } from '@onekeyhq/kit/src/views/FirmwareUpdate/hooks/useFirmwareUpdateActions';
import type { IDBDevice } from '@onekeyhq/kit-bg/src/dbs/local/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { WalletOptionItem } from './WalletOptionItem';

export function CheckFirmwareUpdateButton({
  device,
}: {
  device: IDBDevice | undefined;
}) {
  const intl = useIntl();
  const actions = useFirmwareUpdateActions();

  return (
    <WalletOptionItem
      testID="AccountSelector-WalletOption-CheckFirmwareUpdate"
      icon="RefreshCcwOutline"
      label={intl.formatMessage({
        id: ETranslations.global_check_for_updates,
      })}
      onPress={() => {
        actions.openChangeLogModal({
          connectId: device?.connectId,
        });
      }}
    />
  );
}
