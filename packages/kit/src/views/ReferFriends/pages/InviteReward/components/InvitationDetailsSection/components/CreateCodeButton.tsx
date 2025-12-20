import { useCallback, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  Toast,
  useClipboard,
  useScrollView,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { generateInviteUrlFromTemplate } from '@onekeyhq/kit/src/views/ReferFriends/utils';
import { ETranslations } from '@onekeyhq/shared/src/locale';

interface ICreateCodeButtonProps {
  remainingCodes?: number;
  onCodeCreated?: () => void;
  inviteUrlTemplate: string;
}

export function CreateCodeButton({
  remainingCodes = 0,
  onCodeCreated,
  inviteUrlTemplate,
}: ICreateCodeButtonProps) {
  const intl = useIntl();
  const [loading, setLoading] = useState(false);
  const { copyText } = useClipboard();
  const { scrollViewRef } = useScrollView();

  const scrollToLatestCode = useCallback(() => {
    setTimeout(() => {
      const scrollView = scrollViewRef?.current;

      if (typeof scrollView?.scrollTo === 'function') {
        scrollView.scrollTo({ y: Number.MAX_SAFE_INTEGER, animated: true });
      }
    }, 500);
  }, [scrollViewRef]);

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
      scrollToLatestCode();
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
      disabled={loading || remainingCodes <= 0}
      loading={loading}
    >
      {intl.formatMessage({ id: ETranslations.referral_create_code })} (
      {remainingCodes ?? 0})
    </Button>
  );
}
