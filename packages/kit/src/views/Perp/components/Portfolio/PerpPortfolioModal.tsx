import { Page, ScrollView } from '@onekeyhq/components';
import type { useInTabDialog } from '@onekeyhq/components';

import { PerpsProviderMirror } from '../../PerpsProviderMirror';

import { PerpPortfolioContent } from './PerpPortfolioContent';

export const PORTFOLIO_TITLE = 'Portfolio & PnL';

export function showPerpPortfolioDialog(
  dialogInTab: ReturnType<typeof useInTabDialog>,
) {
  const dialogRef = dialogInTab.show({
    title: PORTFOLIO_TITLE,
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
      <Page.Header title={PORTFOLIO_TITLE} />
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
