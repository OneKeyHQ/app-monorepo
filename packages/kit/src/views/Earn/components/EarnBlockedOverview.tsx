import { useIntl } from 'react-intl';

import type { IKeyOfIcons } from '@onekeyhq/components';
import { Button, Empty, Page } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { TabPageHeader } from '../../../components/TabPageHeader';

export function EarnBlockedOverview(props: {
  showHeader?: boolean;
  showContent?: boolean;
  icon: IKeyOfIcons;
  title: string;
  description: string;
  refresh: () => Promise<void>;
  refreshing: boolean;
}) {
  const intl = useIntl();
  const {
    title,
    description,
    icon,
    refresh,
    refreshing,
    showHeader,
    showContent,
  } = props;

  return (
    <Page fullPage>
      {showHeader ? (
        <TabPageHeader
          sceneName={EAccountSelectorSceneName.home}
          tabRoute={ETabRoutes.Earn}
        />
      ) : null}
      <Page.Body>
        <Empty
          display={showContent ? undefined : 'none'}
          icon={icon}
          title={title}
          description={description}
          button={
            <Button
              mt="$6"
              size="medium"
              variant="primary"
              onPress={refresh}
              loading={refreshing}
            >
              {intl.formatMessage({
                id: ETranslations.global_refresh,
              })}
            </Button>
          }
        />
      </Page.Body>
    </Page>
  );
}
