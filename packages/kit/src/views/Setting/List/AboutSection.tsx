import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { ListItem } from '@onekeyhq/components';

import { useHelpLink } from '../../../hooks/useHelpLink';
import { UrlExternalListItem } from '../Components/UrlExternalListItem';

import { Section } from './Section';

export const AboutSection = () => {
  const userAgreementUrl = useHelpLink({ path: 'articles/360002014776' });
  const privacyPolicyUrl = useHelpLink({ path: 'articles/360002003315' });
  const onPress = useCallback(() => {}, []);
  const intl = useIntl();
  return (
    <Section title={intl.formatMessage({ id: 'form__about_uppercase' })}>
      <ListItem
        onPress={onPress}
        icon="InfoCircleOutline"
        title={intl.formatMessage({ id: 'form__version' })}
        drillIn
      >
        <ListItem.Text
          primary="4.15"
          align="right"
          primaryTextProps={{
            // tone: 'subdued',
          }}
        />
      </ListItem>
      <ListItem
        onPress={onPress}
        icon="ThumbUpOutline"
        title={intl.formatMessage({ id: 'form__rate_our_app' })}
      >
        <ListItem.IconButton
          disabled
          icon="ArrowTopRightOutline"
          iconProps={{
            color: '$iconActive',
          }}
        />
      </ListItem>
      <UrlExternalListItem
        icon="HelpSupportOutline"
        title={intl.formatMessage({ id: 'title__help_center' })}
        url="https://help.onekey.so/hc"
      />
      <UrlExternalListItem
        icon="EditOutline"
        title="Submit ticket"
        url="https://help.onekey.so/hc/en-us/requests/new"
      />
      <UrlExternalListItem
        icon="AddedPeopleOutline"
        title={intl.formatMessage({ id: 'form__user_agreement' })}
        url={userAgreementUrl}
        drillIn
      />
      <UrlExternalListItem
        icon="Shield2CheckOutline"
        title={intl.formatMessage({ id: 'terms__privacy_policy' })}
        url={privacyPolicyUrl}
        drillIn
      />
    </Section>
  );
};
