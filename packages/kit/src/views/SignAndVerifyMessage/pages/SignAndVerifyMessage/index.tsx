import { useCallback, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Page,
  SegmentControl,
  SizableText,
  YStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { ESignAndVerifyAction } from '@onekeyhq/shared/types/signAndVerify';

function SignAndVerifyMessage() {
  const intl = useIntl();
  const [action, setAction] = useState(ESignAndVerifyAction.Sign);

  const renderContent = useCallback(() => {
    if (action === ESignAndVerifyAction.Sign) {
      return <SizableText>Sign message</SizableText>;
    }
    return <SizableText>Verify message</SizableText>;
  }, [action]);

  return (
    <Page scrollEnabled onClose={() => {}} safeAreaEnabled>
      <Page.Header
        title={intl.formatMessage({
          id: ETranslations.message_signing_main_title,
        })}
      />
      <Page.Body>
        <YStack p="$5" gap="$5">
          <SegmentControl
            value={action}
            fullWidth
            onChange={(v) => {
              setAction(v as ESignAndVerifyAction);
            }}
            options={[
              {
                label: intl.formatMessage({
                  id: ETranslations.message_signing_sign_action,
                }),
                value: ESignAndVerifyAction.Sign,
              },
              {
                label: intl.formatMessage({
                  id: ETranslations.message_signing_verify_action,
                }),
                value: ESignAndVerifyAction.Verify,
              },
            ]}
          />
          {renderContent()}
        </YStack>
      </Page.Body>
    </Page>
  );
}

export default SignAndVerifyMessage;
