import { useIntl } from 'react-intl';

import { useFirmwareUpdateActions } from '@onekeyhq/kit/src/views/FirmwareUpdate/hooks/useFirmwareUpdateActions';
import type { IDBDevice } from '@onekeyhq/kit-bg/src/dbs/local/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { WalletOptionItem } from './WalletOptionItem';

export function HardwareLabelSetButton({
  device,
}: {
  device: IDBDevice | undefined;
}) {
  const intl = useIntl();
  const actions = useFirmwareUpdateActions();

  return (
    <WalletOptionItem
      icon="TagOutline"
      label={intl.formatMessage({
        id: 'setLabel',
      })}
      onPress={() => {
        actions.openChangeLogModal({
          connectId: device?.connectId,
        });
      }}
    />
  );
}
