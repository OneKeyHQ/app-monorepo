import { useIntl } from 'react-intl';

import { Tabs } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

export function RewardTypeTabs() {
  const intl = useIntl();

  return (
    <Tabs.Container renderTabBar={(props) => <Tabs.TabBar {...props} />}>
      <Tabs.Tab
        name={intl.formatMessage({
          id: ETranslations.referral_referred_type_2,
        })}
      >
        <Tabs.ScrollView />
      </Tabs.Tab>
    </Tabs.Container>
  );
}
