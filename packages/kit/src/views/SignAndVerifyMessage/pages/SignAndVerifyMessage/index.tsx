import { useIntl } from 'react-intl';

import { Page, SizableText, Stack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

function SignAndVerifyMessage() {
  const intl = useIntl();
  return (
    <Page scrollEnabled onClose={() => {}} safeAreaEnabled>
      <Page.Header
        title={intl.formatMessage({
          id: ETranslations.message_signing_main_title,
        })}
      />
      <Page.Body>
        <Stack>
          <SizableText>Sign and verify message</SizableText>
        </Stack>
      </Page.Body>
    </Page>
  );
}

export default SignAndVerifyMessage;
