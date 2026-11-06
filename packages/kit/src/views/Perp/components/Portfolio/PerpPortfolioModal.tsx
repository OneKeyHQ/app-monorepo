import { useRoute } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import { Page, ScrollView } from '@onekeyhq/components';
import type { useInTabDialog } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  EModalPerpRoutes,
  IModalPerpParamList,
} from '@onekeyhq/shared/src/routes/perp';

import { usePerpGoToTrade } from '../../hooks/usePerpGoToTrade';
import { PerpsAccountSelectorProviderMirror } from '../../PerpsAccountSelectorProviderMirror';
import { PerpsProviderMirror } from '../../PerpsProviderMirror';

import { PerpPortfolioContent } from './PerpPortfolioContent';

import type { IPortfolioChartType } from './portfolioStats';
import type { RouteProp } from '@react-navigation/core';
import type { IntlShape } from 'react-intl';

export function getPortfolioTitle(intl: IntlShape) {
  return intl.formatMessage({
    id: ETranslations.perp_portfolio_pnl_title,
  });
}

export function showPerpPortfolioDialog(
  dialogInTab: ReturnType<typeof useInTabDialog>,
  intl: IntlShape,
  {
    initialChartType,
  }: {
    initialChartType?: IPortfolioChartType;
  } = {},
) {
  const dialogRef = dialogInTab.show({
    title: getPortfolioTitle(intl),
    showFooter: false,
    floatingPanelProps: { width: 960 },
    renderContent: (
      // In-tab dialogs render through the IN_PAGE_TAB_CONTAINER portal at the
      // TabNavigator root, so they do NOT inherit the page/header providers.
      // Web-dapp /perps opens this from the header pill (no perps page tree), so
      // mirror the native page nesting for dialog flows started from this content.
      <PerpsAccountSelectorProviderMirror>
        <PerpsProviderMirror>
          <PerpPortfolioContent
            isMobile={false}
            initialChartType={initialChartType}
            onStartTrading={() => {
              void dialogRef.close();
            }}
          />
        </PerpsProviderMirror>
      </PerpsAccountSelectorProviderMirror>
    ),
  });
  return dialogRef;
}

function PerpPortfolioPageContent() {
  const intl = useIntl();
  const { goToTrade } = usePerpGoToTrade();
  const route =
    useRoute<
      RouteProp<IModalPerpParamList, EModalPerpRoutes.MobilePortfolioPage>
    >();
  return (
    <Page>
      <Page.Header title={getPortfolioTitle(intl)} />
      <Page.Body>
        <ScrollView>
          <PerpPortfolioContent
            isMobile
            initialChartType={route.params?.initialChartType}
            onStartTrading={() => {
              void goToTrade();
            }}
          />
        </ScrollView>
      </Page.Body>
    </Page>
  );
}

export function PerpPortfolioPage() {
  return (
    <PerpsProviderMirror>
      <PerpPortfolioPageContent />
    </PerpsProviderMirror>
  );
}

export default PerpPortfolioPage;
