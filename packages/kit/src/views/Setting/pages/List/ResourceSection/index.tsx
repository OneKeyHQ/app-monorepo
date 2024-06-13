import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Badge } from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { useAppUpdateInfo } from '@onekeyhq/kit/src/components/UpdateReminder/hooks';
import { useHelpLink } from '@onekeyhq/kit/src/hooks/useHelpLink';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { UrlExternalListItem } from '../../../components/UrlExternalListItem';
import { Section } from '../Section';

import { RateAppItem } from './RateAppItem';
import { StateLogsItem } from './StateLogsItem';

function ListVersionItem() {
  const intl = useIntl();
  const appUpdateInfo = useAppUpdateInfo();
  const handleToUpdatePreviewPage = useCallback(() => {
    appUpdateInfo.toUpdatePreviewPage();
  }, [appUpdateInfo]);
  return appUpdateInfo.isNeedUpdate ? (
    <ListItem
      onPress={handleToUpdatePreviewPage}
      icon="InfoCircleOutline"
      iconProps={{ color: '$textInfo' }}
      title={intl.formatMessage({
        id: ETranslations.settings_app_update_available,
      })}
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
      title={intl.formatMessage({ id: ETranslations.settings_whats_new })}
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
    <Section
      title={intl.formatMessage({ id: ETranslations.settings_resources })}
    >
      <ListVersionItem />
      <UrlExternalListItem
        icon="HelpSupportOutline"
        title={intl.formatMessage({ id: ETranslations.settings_help_center })}
        url={helpCenterUrl}
        drillIn
      />
      <UrlExternalListItem
        icon="EditOutline"
        title={intl.formatMessage({
          id: ETranslations.settings_submit_request,
        })}
        url={requestUrl}
        drillIn
      />
      <RateAppItem />
      <UrlExternalListItem
        icon="PeopleOutline"
        title={intl.formatMessage({
          id: ETranslations.settings_user_agreement,
        })}
        url={userAgreementUrl}
        drillIn
      />
      <UrlExternalListItem
        icon="FileTextOutline"
        title={intl.formatMessage({
          id: ETranslations.settings_privacy_policy,
        })}
        url={privacyPolicyUrl}
        drillIn
      />
      <StateLogsItem />
    </Section>
  );
};
