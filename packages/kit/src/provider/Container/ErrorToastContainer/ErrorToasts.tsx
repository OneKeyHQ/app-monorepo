import { useCallback, useState } from 'react';

import { useIntl } from 'react-intl';

import { Button, useClipboard } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ECustomOneKeyHardwareError } from '@onekeyhq/shared/src/errors/types/errorTypes';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { showIntercom } from '@onekeyhq/shared/src/modules3rdParty/intercom';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

interface IErrorActionParams {
  errorCode?: number;
  requestId?: string;
  diagnosticText?: string;
}

// Cooldown mechanism: prevent high-frequency log uploads (1 minute)
const LOG_UPLOAD_COOLDOWN_MS = timerUtils.getTimeDurationMs({ seconds: 60 });
let lastLogUploadTime = 0;

function ContactSupportButton({ requestId }: { requestId: string }) {
  const intl = useIntl();
  const [isUploading, setIsUploading] = useState(false);

  const handlePress = useCallback(async () => {
    setIsUploading(true);

    // Open Intercom immediately
    void showIntercom({ requestId });

    // Check cooldown before uploading
    const now = Date.now();
    const timeSinceLastUpload = now - lastLogUploadTime;
    const isInCooldown = timeSinceLastUpload < LOG_UPLOAD_COOLDOWN_MS;

    if (isInCooldown) {
      const remainingSeconds = Math.ceil(
        (LOG_UPLOAD_COOLDOWN_MS - timeSinceLastUpload) / 1000,
      );
      console.log(
        `[ContactSupport] Log upload in cooldown, skipping. Retry in ${remainingSeconds}s`,
      );
      setIsUploading(false);
      return;
    }

    // Update last upload time
    lastLogUploadTime = now;

    // Silently upload logs in background (fire and forget)
    void (async () => {
      try {
        // Dynamically import to avoid circular dependencies and reduce initial bundle size
        const { collectLogDigest, uploadLogBundle } = await import(
          '@onekeyhq/kit/src/views/Setting/pages/Tab/exportLogs'
        );

        // Generate timestamp-based filename
        const timestamp = new Date().toISOString().replace(/[-:.]/g, '');
        const fileBaseName = `OneKeyLogs-${timestamp}`;

        // Collect logs and upload silently
        const digest = await collectLogDigest(fileBaseName);
        const token = await backgroundApiProxy.serviceLogger.requestUploadToken(
          {
            sizeBytes: digest.sizeBytes,
            sha256: digest.sha256,
          },
        );
        await uploadLogBundle({
          uploadToken: token.uploadToken,
          digest,
        });

        console.log(
          '[ContactSupport] Logs uploaded successfully in background',
        );
      } catch (error) {
        // Silent failure - don't show error to user
        console.warn('[ContactSupport] Failed to upload logs:', error);
      } finally {
        setIsUploading(false);
      }
    })();
  }, [requestId]);

  return (
    <Button
      icon="HelpSupportOutline"
      size="small"
      loading={isUploading}
      disabled={isUploading}
      onPress={() => {
        void handlePress();
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
  if (diagnosticText && requestId) {
    return [
      <ContactSupportButton key="contact" requestId={requestId} />,
      <CopyDiagnosticButton key="copy" diagnosticText={diagnosticText} />,
    ];
  }

  return undefined;
}
