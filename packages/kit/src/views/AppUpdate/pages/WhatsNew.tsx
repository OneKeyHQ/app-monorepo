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
  const { gtMd } = useMedia();
  const changeLog = useAppChangeLog(version);
  return (
    <Page>
      <Page.Header title="What's New" />
      <Page.Body m="$5">
        <YStack space="$3">
          {gtMd ? (
            <Heading size="$heading2xl">{`What’s New in OneKey ${version} 👋🏻`}</Heading>
          ) : (
            <>
              <Heading size="$heading2xl">What’s New</Heading>
              <Heading size="$heading2xl">{`in OneKey ${version} 👋🏻`}</Heading>
            </>
          )}
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
