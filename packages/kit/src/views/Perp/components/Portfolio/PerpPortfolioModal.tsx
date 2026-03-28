import { Page, ScrollView } from '@onekeyhq/components';
import type { useInTabDialog } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';

import { PerpsProviderMirror } from '../../PerpsProviderMirror';

import { PerpPortfolioContent } from './PerpPortfolioContent';

export function getPortfolioTitle() {
  return appLocale.intl.formatMessage({
    id: ETranslations.perp_portfolio_pnl_title,
  });
}

export function showPerpPortfolioDialog(
  dialogInTab: ReturnType<typeof useInTabDialog>,
) {
  const dialogRef = dialogInTab.show({
    title: getPortfolioTitle(),
    showFooter: false,
    floatingPanelProps: { width: 960 },
    renderContent: (
      <PerpsProviderMirror>
        <PerpPortfolioContent isMobile={false} />
      </PerpsProviderMirror>
    ),
  });
  return dialogRef;
}

export function PerpPortfolioPage() {
  return (
    <Page>
      <Page.Header title={getPortfolioTitle()} />
      <Page.Body>
        <ScrollView>
          <PerpsProviderMirror>
            <PerpPortfolioContent isMobile />
          </PerpsProviderMirror>
        </ScrollView>
      </Page.Body>
    </Page>
  );
}

export default PerpPortfolioPage;
