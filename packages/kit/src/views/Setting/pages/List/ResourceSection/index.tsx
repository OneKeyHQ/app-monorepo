import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { useHelpLink } from '@onekeyhq/kit/src/hooks/useHelpLink';

import { UrlExternalListItem } from '../../../components/UrlExternalListItem';
import { Section } from '../Section';

import { StateLogsItem } from './StateLogsItem';

export const ResourceSection = () => {
  const userAgreementUrl = useHelpLink({ path: 'articles/360002014776' });
  const privacyPolicyUrl = useHelpLink({ path: 'articles/360002003315' });
  const requestUrl = useHelpLink({ path: 'requests/new' });
  const onPress = useCallback(() => {}, []);
  const intl = useIntl();
  return (
    <Section title="Resources">
      <ListItem
        onPress={onPress}
        icon="SpeakerPromoteOutline"
        title="What’s New"
        drillIn
      >
        <ListItem.Text>4.17</ListItem.Text>
      </ListItem>
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
