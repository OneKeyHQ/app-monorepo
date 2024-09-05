import { useIntl } from 'react-intl';

import { Divider, Page, Switch } from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { ETranslations } from '@onekeyhq/shared/src/locale';

function NotificationsSettings() {
  const intl = useIntl();

  return (
    <Page>
      <Page.Header
        title={intl.formatMessage({ id: ETranslations.global_notifications })}
      />
      <Page.Body>
        <ListItem>
          <ListItem.Text
            flex={1}
            primary={intl.formatMessage({
              id: ETranslations.notifications_notifications_switch_label,
            })}
          />
          <Switch value />
        </ListItem>
        <Divider m="$5" />
        <ListItem>
          <ListItem.Text
            flex={1}
            primary={intl.formatMessage({
              id: ETranslations.notifications_notifications_account_activity_label,
            })}
            secondary={intl.formatMessage({
              id: ETranslations.notifications_notifications_account_activity_desc,
            })}
            secondaryTextProps={{
              maxWidth: '$96',
            }}
          />
          <Switch value />
        </ListItem>
        <ListItem>
          <ListItem.Text
            flex={1}
            primary={intl.formatMessage({
              id: ETranslations.notifications_notifications_price_alert_label,
            })}
            secondary={intl.formatMessage({
              id: ETranslations.notifications_notifications_price_alert_desc,
            })}
            secondaryTextProps={{
              maxWidth: '$96',
            }}
          />
          <Switch value />
        </ListItem>
      </Page.Body>
    </Page>
  );
}

export default NotificationsSettings;
