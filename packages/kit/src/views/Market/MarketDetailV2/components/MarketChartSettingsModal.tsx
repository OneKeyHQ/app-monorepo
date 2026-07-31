import { useIntl } from 'react-intl';

import { Page, useMedia } from '@onekeyhq/components';
import { TradingViewChartSettings } from '@onekeyhq/kit/src/components/TradingView/TradingViewChartControls/chartSettings';
import { ETranslations } from '@onekeyhq/shared/src/locale';

export default function MarketChartSettingsModal() {
  const intl = useIntl();
  const { md } = useMedia();

  return (
    <Page>
      <Page.Header
        title={intl.formatMessage({ id: ETranslations.market_chart_settings })}
      />
      <Page.Body minHeight={0}>
        <TradingViewChartSettings usePageFooter={!md} mobileLayout={md} />
      </Page.Body>
    </Page>
  );
}
