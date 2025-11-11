import { useState } from 'react';

import { useIntl } from 'react-intl';

import { Button, Toast, useClipboard } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { generateInviteUrlFromTemplate } from '@onekeyhq/kit/src/views/ReferFriends/utils';
import { ETranslations } from '@onekeyhq/shared/src/locale';

interface ICreateCodeButtonProps {
  total?: number;
  onCodeCreated?: () => void;
  inviteUrlTemplate: string;
}

export function CreateCodeButton({
  total,
  onCodeCreated,
  inviteUrlTemplate,
}: ICreateCodeButtonProps) {
  const intl = useIntl();
  const [loading, setLoading] = useState(false);
  const { copyText } = useClipboard();

  const handleCreateCode = async () => {
    setLoading(true);
    try {
      const data =
        await backgroundApiProxy.serviceReferralCode.createInviteCode();

      // Generate invite URL for the new code
      const inviteUrl = generateInviteUrlFromTemplate(
        inviteUrlTemplate,
        data.code,
      );

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
              void copyText(inviteUrl);
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
      size="small"
      variant="tertiary"
      icon="PlusSmallOutline"
      onPress={() => void handleCreateCode()}
      disabled={loading}
      loading={loading}
    >
      {intl.formatMessage({ id: ETranslations.referral_create_code })} (
      {total ?? 0})
    </Button>
  );
}
