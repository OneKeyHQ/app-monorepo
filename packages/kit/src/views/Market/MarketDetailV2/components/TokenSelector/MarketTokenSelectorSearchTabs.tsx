import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import { ETranslations } from '@onekeyhq/shared/src/locale';

import {
  type IMarketSearchTab,
  getDetailPopoverSearchTabs,
} from '../../../utils/marketSearchList';

import { SelectorTabBar } from './selectorTabBar';

const SEARCH_TAB_LABELS: Record<IMarketSearchTab, ETranslations> = {
  all: ETranslations.global_all,
  tokens: ETranslations.global_universal_search_tabs_tokens,
  stocks: ETranslations.perps_token_selector_stocks,
};

export type IMarketTokenSelectorSearchTab = IMarketSearchTab;

export function MarketTokenSelectorSearchTabs({
  value,
  onChange,
  hasStockResults = false,
  hasTokenResults = true,
  backgroundColor,
}: {
  value: IMarketTokenSelectorSearchTab;
  onChange: (value: IMarketTokenSelectorSearchTab) => void;
  hasStockResults?: boolean;
  hasTokenResults?: boolean;
  backgroundColor?: '$bg' | '$bgApp';
}) {
  const intl = useIntl();
  const tabs = useMemo(
    () =>
      getDetailPopoverSearchTabs(hasStockResults, hasTokenResults).map(
        (tab) => ({
          id: tab,
          label: intl.formatMessage({ id: SEARCH_TAB_LABELS[tab] }),
        }),
      ),
    [hasStockResults, hasTokenResults, intl],
  );

  return (
    <SelectorTabBar
      tabs={tabs}
      value={value}
      onChange={onChange}
      testIDPrefix="market-token-selector-search-tab-"
      backgroundColor={backgroundColor}
    />
  );
}
