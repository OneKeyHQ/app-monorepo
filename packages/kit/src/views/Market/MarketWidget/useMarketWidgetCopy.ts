import { useIntl } from 'react-intl';

import { ETranslations } from '@onekeyhq/shared/src/locale';

export function useMarketWidgetCopy() {
  const intl = useIntl();
  return {
    marketWidgets: intl.formatMessage({
      id: ETranslations.market_widgets__title,
    }),
    singleCoin: intl.formatMessage({
      id: ETranslations.market_widget_single__title,
    }),
    marketList: intl.formatMessage({
      id: ETranslations.market_widget_list__title,
    }),
    hotCoins: intl.formatMessage({
      id: ETranslations.market_widget_hot_coins__title,
    }),
    watchlist: intl.formatMessage({
      id: ETranslations.market_widget_watchlist__title,
    }),
    source: intl.formatMessage({
      id: ETranslations.market_widget_source__title,
    }),
    coin: intl.formatMessage({ id: ETranslations.market_widget_coin__title }),
    searchCoins: intl.formatMessage({
      id: ETranslations.market_widget_search__title,
    }),
    configurations: intl.formatMessage({
      id: ETranslations.market_widget_configurations__title,
    }),
    newConfiguration: intl.formatMessage({
      id: ETranslations.market_widget_new_configuration__title,
    }),
    editConfiguration: intl.formatMessage({
      id: ETranslations.market_widget_edit_configuration__title,
    }),
    noConfigurations: intl.formatMessage({
      id: ETranslations.market_widget_no_configurations__msg,
    }),
    listDescription: intl.formatMessage({
      id: ETranslations.market_widget_list_source__desc,
    }),
    bindingHint: intl.formatMessage({
      id: ETranslations.market_widget_bind__desc,
    }),
    privacyUnavailable: intl.formatMessage({
      id: ETranslations.market_widget_travel_mode__msg,
    }),
    assetUnavailable: intl.formatMessage({
      id: ETranslations.market_widget_coin_removed__msg,
    }),
    unavailableConfiguration: intl.formatMessage({
      id: ETranslations.market_widget_configuration_missing__msg,
    }),
  };
}
