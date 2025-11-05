import { useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  SizableText,
  Toast,
  YStack,
  useClipboard,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ETranslations } from '@onekeyhq/shared/src/locale';

export function TestInviteCodesButton() {
  const intl = useIntl();
  const [loading, setLoading] = useState(false);
  const [loadingList, setLoadingList] = useState(false);
  const [result, setResult] = useState<string>('');
  const { copyText } = useClipboard();

  const handleCreateCode = async () => {
    setLoading(true);
    setResult('');
    try {
      const data =
        await backgroundApiProxy.serviceReferralCode.getInviteCodes();
      setResult(JSON.stringify(data, null, 2));
      console.log('Invite Codes Response:', data);

      // Show success toast
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
              copyText(data.code);
            }}
          >
            Copy link
          </Button>
        ),
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      setResult(`Error: ${errorMessage}`);
      console.error('Error fetching invite codes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGetCodeList = async () => {
    setLoadingList(true);
    setResult('');
    try {
      const data =
        await backgroundApiProxy.serviceReferralCode.getInviteCodeList();
      setResult(JSON.stringify(data, null, 2));
      console.log('Invite Code List Response:', data);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      setResult(`Error: ${errorMessage}`);
      console.error('Error fetching invite code list:', error);
    } finally {
      setLoadingList(false);
    }
  };

  return (
    <YStack gap="$4" p="$5">
      <Button
        variant="primary"
        onPress={() => void handleCreateCode()}
        disabled={loading || loadingList}
      >
        {loading ? 'Loading...' : 'Create Invite Code (POST)'}
      </Button>
      <Button
        variant="secondary"
        onPress={() => void handleGetCodeList()}
        disabled={loading || loadingList}
      >
        {loadingList ? 'Loading...' : 'Get Invite Code List (GET)'}
      </Button>
      {result ? (
        <YStack
          p="$3"
          backgroundColor="$bgSubdued"
          borderRadius="$2"
          maxHeight={300}
        >
          <SizableText size="$bodyMd">{result}</SizableText>
        </YStack>
      ) : null}
    </YStack>
  );
}
