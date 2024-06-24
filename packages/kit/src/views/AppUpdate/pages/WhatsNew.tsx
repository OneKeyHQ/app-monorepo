import { useIntl } from 'react-intl';

import {
  Heading,
  Markdown,
  Page,
  ScrollView,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useAppChangeLog } from '../../../components/UpdateReminder/hooks';
import { ViewUpdateHistory } from '../components/ViewUpdateHistory';

function WhatsNew() {
  const intl = useIntl();
  const { version = '' } = platformEnv;
  const changeLog = useAppChangeLog(version);
  return (
    <Page>
      <Page.Header
        title={intl.formatMessage({ id: ETranslations.settings_whats_new })}
      />
      <Page.Body m="$5">
        <YStack space="$3">
          <>
            {intl
              .formatMessage(
                { id: ETranslations.update_whats_new_in_onekey_version },
                {
                  version,
                },
              )
              .split('\n')
              .map((text) => (
                <Heading key={text} size="$heading2xl">
                  {text}
                </Heading>
              ))}
          </>
        </YStack>
        {changeLog ? (
          <ScrollView
            mt="$7"
            contentInsetAdjustmentBehavior="automatic"
            contentContainerStyle={{ pb: '$5' }}
          >
            <Markdown>{changeLog}</Markdown>
            <ViewUpdateHistory />
          </ScrollView>
        ) : null}
      </Page.Body>
      <Page.Footer
        onCancelText={intl.formatMessage({ id: ETranslations.global_got_it })}
        onCancel={(close) => {
          close();
        }}
      />
    </Page>
  );
}

export default WhatsNew;
