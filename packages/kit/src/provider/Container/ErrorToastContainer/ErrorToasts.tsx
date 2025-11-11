import { useIntl } from 'react-intl';

import { Button, useClipboard } from '@onekeyhq/components';
import { ECustomOneKeyHardwareError } from '@onekeyhq/shared/src/errors/types/errorTypes';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { showIntercom } from '@onekeyhq/shared/src/modules3rdParty/intercom';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';

interface IErrorActionParams {
  errorCode?: number;
  requestId?: string;
  diagnosticText?: string;
}

function ContactSupportButton({ requestId }: { requestId: string }) {
  const intl = useIntl();

  return (
    <Button
      size="small"
      onPress={() => {
        void showIntercom({ requestId });
      }}
    >
      {intl.formatMessage({ id: ETranslations.global_contact_us })}
    </Button>
  );
}

function CopyDiagnosticButton({ diagnosticText }: { diagnosticText: string }) {
  const intl = useIntl();
  const { copyText } = useClipboard();

  return (
    <Button
      size="small"
      onPress={() => {
        void copyText(diagnosticText);
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

export function getErrorAction({
  errorCode,
  requestId,
  diagnosticText,
}: IErrorActionParams) {
  // Special case: firmware upgrade button
  if (errorCode === ECustomOneKeyHardwareError.NeedFirmwareUpgradeFromWeb) {
    return <NeedFirmwareUpgradeFromWebButton />;
  }

  // Default: show contact support + copy diagnostic info buttons
  if (diagnosticText) {
    return [
      requestId ? (
        <ContactSupportButton key="contact" requestId={requestId} />
      ) : null,
      <CopyDiagnosticButton key="copy" diagnosticText={diagnosticText} />,
    ].filter(Boolean);
  }

  return undefined;
}
