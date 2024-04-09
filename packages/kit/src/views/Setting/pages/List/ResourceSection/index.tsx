import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Badge } from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { useAppUpdateInfo } from '@onekeyhq/kit/src/components/UpdateReminder/hooks';
import { useHelpLink } from '@onekeyhq/kit/src/hooks/useHelpLink';

import { UrlExternalListItem } from '../../../components/UrlExternalListItem';
import { Section } from '../Section';

import { StateLogsItem } from './StateLogsItem';

function ListVersionItem() {
  const appUpdateInfo = useAppUpdateInfo();
  return appUpdateInfo.data ? (
    <ListItem
      onPress={appUpdateInfo.onUpdateAction}
      icon="SpeakerPromoteOutline"
      iconProps={{ color: '$textInfo' }}
      title="App Update Available"
      titleProps={{ color: '$textInfo' }}
      drillIn
    >
      <ListItem.Text
        primary={
          <Badge badgeType="info" badgeSize="lg">
            {appUpdateInfo.version}
          </Badge>
        }
        align="right"
      />
    </ListItem>
  ) : (
    <ListItem
      onPress={appUpdateInfo.onViewReleaseInfo}
      icon="SpeakerPromoteOutline"
      title="What’s New"
      drillIn
    >
      <ListItem.Text primary={appUpdateInfo.version} align="right" />
    </ListItem>
  );
}

export const ResourceSection = () => {
  const userAgreementUrl = useHelpLink({ path: 'articles/360002014776' });
  const privacyPolicyUrl = useHelpLink({ path: 'articles/360002003315' });
  const requestUrl = useHelpLink({ path: 'requests/new' });
  const onPress = useCallback(() => {}, []);
  const intl = useIntl();

  return (
    <Section title="Resources">
      <ListVersionItem />
      <ListItem
        onPress={onPress}
        icon="HelpSupportOutline"
        title="Help Center"
      />
      <UrlExternalListItem
        icon="EditOutline"
        title="Submit a Request"
        url={requestUrl}
      />
      <ListItem
        onPress={onPress}
        icon="StarOutline"
        title={intl.formatMessage({ id: 'form__rate_our_app' })}
      />
      <UrlExternalListItem
        icon="PeopleOutline"
        title={intl.formatMessage({ id: 'form__user_agreement' })}
        url={userAgreementUrl}
      />
      <UrlExternalListItem
        icon="FileTextOutline"
        title={intl.formatMessage({ id: 'terms__privacy_policy' })}
        url={privacyPolicyUrl}
      />
      <StateLogsItem />
    </Section>
  );
};
