import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Page } from '@onekeyhq/components';
import {
  FIRMWARE_CONTACT_US_URL,
  HELP_CENTER_URL,
} from '@onekeyhq/shared/src/config/appConfig';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';

function HardwareTroubleshootingModal() {
  const intl = useIntl();
  const content = useMemo(() => 'Hello World', []);

  return (
    <Page>
      <Page.Header
        title={intl.formatMessage({
          id: ETranslations.global_hardware_troubleshooting,
        })}
      />
      <Page.Body>{content}</Page.Body>
      <Page.Footer
        onConfirmText={intl.formatMessage({
          id: ETranslations.global_hardware_troubleshooting_contact,
        })}
        onCancelText={intl.formatMessage({
          id: ETranslations.settings_help_center,
        })}
        onConfirm={() => openUrlExternal(FIRMWARE_CONTACT_US_URL)}
        onCancel={(_pop) => openUrlExternal(HELP_CENTER_URL)}
      />
    </Page>
  );
}

export default HardwareTroubleshootingModal;
