import { useState } from 'react';

import { useIntl } from 'react-intl';

import { Button, Toast, useClipboard } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ETranslations } from '@onekeyhq/shared/src/locale';

interface ICreateCodeButtonProps {
  onCodeCreated?: () => void;
}

export function CreateCodeButton({ onCodeCreated }: ICreateCodeButtonProps) {
  const intl = useIntl();
  const [loading, setLoading] = useState(false);
  const { copyText } = useClipboard();

  const handleCreateCode = async () => {
    setLoading(true);
    try {
      const data =
        await backgroundApiProxy.serviceReferralCode.getInviteCodes();

      // Show success toast with copy button
      Toast.success({
        title: intl.formatMessage({
          id: ETranslations.referral_code_created,
        }),
        message: intl.formatMessage({
          id: ETranslations.referral_code_created_desc,
        }),
        actions: (
          <Button
            variant="primary"
            size="small"
            onPress={() => {
              void copyText(data.code);
            }}
          >
            {intl.formatMessage({ id: ETranslations.global_copy })}
          </Button>
        ),
      });

      // Trigger callback to refresh list if provided
      onCodeCreated?.();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      Toast.error({
        title: errorMessage,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant="secondary"
      size="medium"
      icon="PlusSmallOutline"
      onPress={() => void handleCreateCode()}
      disabled={loading}
      loading={loading}
    >
      {intl.formatMessage({ id: ETranslations.referral_create_code })} (18)
    </Button>
  );
}
