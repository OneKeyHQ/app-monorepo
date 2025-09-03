import { useIntl } from 'react-intl';

import { Button, Markdown, Page, ScrollView } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useAppChangeLog } from '../../../components/UpdateReminder/hooks';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { ViewUpdateHistory } from '../components/ViewUpdateHistory';

function WhatsNew() {
  const intl = useIntl();
  const { version = '' } = platformEnv;
  const response = useAppChangeLog(version);
  const { changeLog } = response ?? {};
  const navigation = useAppNavigation();
  return (
    <Page>
      <Page.Header
        title={intl.formatMessage(
          { id: ETranslations.update_changelog_updated_title },
          {
            ver: platformEnv.version,
          },
        )}
      />
      <Page.Body mx="$5">
        {changeLog ? (
          <ScrollView
            contentInsetAdjustmentBehavior="automatic"
            contentContainerStyle={{ pb: '$5' }}
          >
            <Markdown>{changeLog}</Markdown>
            <ViewUpdateHistory />
          </ScrollView>
        ) : null}
        <Page.Footer
          onConfirmText={intl.formatMessage({
            id: ETranslations.global_done,
          })}
          onConfirm={navigation.pop}
        />
      </Page.Body>
    </Page>
  );
}

export default WhatsNew;
