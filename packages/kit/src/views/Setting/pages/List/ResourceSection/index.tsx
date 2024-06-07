import { useIntl } from 'react-intl';

import { Badge } from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { useAppUpdateInfo } from '@onekeyhq/kit/src/components/UpdateReminder/hooks';
import { useHelpLink } from '@onekeyhq/kit/src/hooks/useHelpLink';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { UrlExternalListItem } from '../../../components/UrlExternalListItem';
import { Section } from '../Section';

import { RateAppItem } from './RateAppItem';
import { StateLogsItem } from './StateLogsItem';

function ListVersionItem() {
  const appUpdateInfo = useAppUpdateInfo();
  return appUpdateInfo.isNeedUpdate ? (
    <ListItem
      onPress={appUpdateInfo.toUpdatePreviewPage}
      icon="InfoCircleOutline"
      iconProps={{ color: '$textInfo' }}
      title="App Update Available"
      titleProps={{ color: '$textInfo' }}
      drillIn
    >
      <ListItem.Text
        primary={
          <Badge badgeType="info" badgeSize="lg">
            {appUpdateInfo.data.latestVersion}
          </Badge>
        }
        align="right"
      />
    </ListItem>
  ) : (
    <ListItem
      onPress={appUpdateInfo.onViewReleaseInfo}
      icon="InfoCircleOutline"
      title="What’s New"
      drillIn
    >
      <ListItem.Text primary={platformEnv.version} align="right" />
    </ListItem>
  );
}

export const ResourceSection = () => {
  const userAgreementUrl = useHelpLink({ path: 'articles/360002014776' });
  const privacyPolicyUrl = useHelpLink({ path: 'articles/360002003315' });
  const requestUrl = useHelpLink({ path: 'requests/new' });
  const helpCenterUrl = useHelpLink({ path: '' });
  const intl = useIntl();

  return (
    <Section title="Resources">
      <ListVersionItem />
      <UrlExternalListItem
        icon="HelpSupportOutline"
        title="Help Center"
        url={helpCenterUrl}
        drillIn
      />
      <UrlExternalListItem
        icon="EditOutline"
        title="Submit a Request"
        url={requestUrl}
        drillIn
      />
      <RateAppItem />
      <UrlExternalListItem
        icon="PeopleOutline"
        title={intl.formatMessage({ id: 'form__user_agreement' })}
        url={userAgreementUrl}
        drillIn
      />
      <UrlExternalListItem
        icon="FileTextOutline"
        title={intl.formatMessage({ id: 'terms__privacy_policy' })}
        url={privacyPolicyUrl}
        drillIn
      />
      <StateLogsItem />
    </Section>
  );
};
