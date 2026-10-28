import { useIntl } from 'react-intl';

import {
  Page,
  ScrollView,
  YStack,
  useScrollContentTabBarOffset,
} from '@onekeyhq/components';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { useRouteIsFocused } from '@onekeyhq/kit/src/hooks/useRouteIsFocused';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import {
  EarnDesktopHoldCard,
  EarnDesktopHoldCardSkeleton,
} from '../../components/desktopHome/EarnDesktopHoldCard';
import { useContentStable } from '../../components/desktopHome/useContentStable';
import {
  useEarnDesktopHoldData,
  useEarnDesktopOpenHoldRow,
} from '../../components/desktopHome/useEarnDesktopHoldData';
import { useEarnPageAvailableAssets } from '../../components/desktopHome/useEarnPageAvailableAssets';
import { EarnListEmptyState } from '../../components/EarnListEmptyState';
import { EarnProviderMirror } from '../../EarnProviderMirror';
import { useEarnPortfolio } from '../../hooks/useEarnPortfolio';

/**
 * Every row of Earns on your holding, which the phone home shows the first
 * of: what the wallet holds that Earn takes, a row per token per network,
 * the most valuable first. A row opens the deposit window, as on the home
 */
function EarnHoldingsContent() {
  const intl = useIntl();
  const tabBarHeight = useScrollContentTabBarOffset();
  const isActive = useRouteIsFocused();
  const portfolio = useEarnPortfolio({ isActive });
  const investments = useContentStable(portfolio.investments);
  const { trendingAssets, fixedRateAssets, isAssetsLoading } =
    useEarnPageAvailableAssets();
  const { hold } = useEarnDesktopHoldData({
    isActive,
    investments,
    trendingAssets,
    fixedRateAssets,
    isAssetsLoading,
  });
  const handleOpenRow = useEarnDesktopOpenHoldRow();

  let list = <EarnDesktopHoldCardSkeleton variant="page" />;
  if (hold.isLoaded) {
    list = hold.rows.length ? (
      <EarnDesktopHoldCard
        variant="page"
        rows={hold.rows}
        networkNames={hold.networkNames}
        onOpenRow={handleOpenRow}
      />
    ) : (
      <EarnListEmptyState isFiltered={false} />
    );
  }

  // A page of its own, as My portfolio: the back button and the title in
  // the page header on every width
  return (
    <Page>
      <Page.Header
        title={intl.formatMessage({
          id: ETranslations.earns_on_your_holding__title,
        })}
      />
      <Page.Body>
        <ScrollView
          flex={1}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: tabBarHeight }}
        >
          <YStack px="$pagePadding" pt="$2" pb="$10">
            {list}
          </YStack>
        </ScrollView>
      </Page.Body>
    </Page>
  );
}

export default function EarnHoldings() {
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.home,
        sceneUrl: '',
      }}
      enabledNum={[0]}
    >
      <EarnProviderMirror storeName={EJotaiContextStoreNames.earn}>
        <EarnHoldingsContent />
      </EarnProviderMirror>
    </AccountSelectorProviderMirror>
  );
}
