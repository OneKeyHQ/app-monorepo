import { useIntl } from 'react-intl';

import { Button, useClipboard } from '@onekeyhq/components';
import { ECustomOneKeyHardwareError } from '@onekeyhq/shared/src/errors/types/errorTypes';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { isRequestIdMessage } from '@onekeyhq/shared/src/request/utils';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';

function CopyButton({ message }: { message: string }) {
  const intl = useIntl();
  const { copyText } = useClipboard();

  return (
    <Button
      size="small"
      onPress={() => {
        if (message) {
          copyText(message);
        }
      }}
    >
      {intl.formatMessage({ id: ETranslations.global_copy })}
    </Button>
  );
}

function NeedFirmwareUpgradeFromWebButton() {
  const intl = useIntl();

  return (
    <Button
      size="small"
      onPress={() => {
        openUrlExternal('https://firmware.onekey.so/');
      }}
    >
      {intl.formatMessage({ id: ETranslations.update_update_now })}
    </Button>
  );
}

export function getErrorAction(code: number | undefined, message: string) {
  if (!message && isRequestIdMessage(message)) {
    return <CopyButton message={message} />;
  }

  if (code === ECustomOneKeyHardwareError.NeedFirmwareUpgradeFromWeb) {
    return <NeedFirmwareUpgradeFromWebButton />;
  }

  return undefined;
}
