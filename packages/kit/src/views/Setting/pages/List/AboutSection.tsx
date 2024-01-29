import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { useHelpLink } from '@onekeyhq/kit/src/hooks/useHelpLink';

import { UrlExternalListItem } from '../../components/UrlExternalListItem';

import { Section } from './Section';

// for open dev mode
let clickCount = 0;
let startTime: Date | undefined;

export const AboutSection = () => {
  const userAgreementUrl = useHelpLink({ path: 'articles/360002014776' });
  const privacyPolicyUrl = useHelpLink({ path: 'articles/360002003315' });
  const onPress = useCallback(() => {}, []);
  const intl = useIntl();
  const handleOpenDevMode = useCallback(() => {
    const nowTime = new Date();
    if (
      startTime === undefined ||
      Math.round(nowTime.getTime() - startTime.getTime()) > 5000
    ) {
      startTime = nowTime;
      clickCount = 0;
    } else {
      clickCount += 1;
    }
    if (clickCount >= 9) {
      void backgroundApiProxy.serviceSetting.setDevMode({ enable: true });
    }
  }, []);
  return (
    <Section title={intl.formatMessage({ id: 'form__about_uppercase' })}>
      <ListItem
        onPress={handleOpenDevMode}
        icon="InfoCircleOutline"
        title={intl.formatMessage({ id: 'form__version' })}
        drillIn
      >
        <ListItem.Text
          primary="4.15"
          align="right"
          primaryTextProps={
            {
              // tone: 'subdued',
            }
          }
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
