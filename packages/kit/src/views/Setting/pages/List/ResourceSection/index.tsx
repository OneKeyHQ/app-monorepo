import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { useHelpLink } from '@onekeyhq/kit/src/hooks/useHelpLink';

import { UrlExternalListItem } from '../../../components/UrlExternalListItem';
import { Section } from '../Section';

export const ResourceSection = () => {
  const userAgreementUrl = useHelpLink({ path: 'articles/360002014776' });
  const privacyPolicyUrl = useHelpLink({ path: 'articles/360002003315' });
  const requestUrl = useHelpLink({ path: 'requests/new' });
  const onPress = useCallback(() => {}, []);
  const intl = useIntl();
  return (
    <Section title="Resources">
      <UrlExternalListItem
        icon="EditOutline"
        title="Submit a Request"
        url={requestUrl}
      />
      <ListItem
        onPress={onPress}
        icon="ThumbUpOutline"
        title={intl.formatMessage({ id: 'form__rate_our_app' })}
      />
      <UrlExternalListItem
        icon="AddedPeopleOutline"
        title={intl.formatMessage({ id: 'form__user_agreement' })}
        url={userAgreementUrl}
      />
      <UrlExternalListItem
        icon="Shield2CheckOutline"
        title={intl.formatMessage({ id: 'terms__privacy_policy' })}
        url={privacyPolicyUrl}
      />
      <ListItem
        icon="Document2Outline"
        onPress={onPress}
        title={intl.formatMessage({ id: 'content__state_logs' })}
      />
    </Section>
  );
};
