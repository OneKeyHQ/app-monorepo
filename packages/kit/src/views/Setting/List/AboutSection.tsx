import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { ListItem } from '@onekeyhq/components';

import { Section } from './Section';

export const AboutSection = () => {
  const onPress = useCallback(() => {}, []);
  const intl = useIntl();
  return (
    <Section title="ABOUT">
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
            tone: 'subdued',
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
      <ListItem
        onPress={onPress}
        icon="HelpSupportOutline"
        title={intl.formatMessage({ id: 'title__help_center' })}
      >
        <ListItem.IconButton
          disabled
          icon="ArrowTopRightOutline"
          iconProps={{
            color: '$iconActive',
          }}
        />
      </ListItem>
      <ListItem onPress={onPress} icon="EditOutline" title="Submit ticket">
        <ListItem.IconButton
          disabled
          icon="ArrowTopRightOutline"
          iconProps={{
            color: '$iconActive',
          }}
        />
      </ListItem>
      <ListItem
        onPress={onPress}
        icon="AddedPeopleOutline"
        title={intl.formatMessage({ id: 'form__user_agreement' })}
        drillIn
      />
      <ListItem
        onPress={onPress}
        icon="Shield2CheckOutline"
        title={intl.formatMessage({ id: 'terms__privacy_policy' })}
        drillIn
      />
    </Section>
  );
};
