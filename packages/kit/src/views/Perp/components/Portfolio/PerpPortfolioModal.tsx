import { useIntl } from 'react-intl';

import { Page, ScrollView } from '@onekeyhq/components';
import type { useInTabDialog } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { PerpsProviderMirror } from '../../PerpsProviderMirror';

import { PerpPortfolioContent } from './PerpPortfolioContent';

import type { IntlShape } from 'react-intl';

export function getPortfolioTitle(intl: IntlShape) {
  return intl.formatMessage({
    id: ETranslations.perp_portfolio_pnl_title,
  });
}

export function showPerpPortfolioDialog(
  dialogInTab: ReturnType<typeof useInTabDialog>,
  intl: IntlShape,
) {
  const dialogRef = dialogInTab.show({
    title: getPortfolioTitle(intl),
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
  const intl = useIntl();
  return (
    <Page>
      <Page.Header title={getPortfolioTitle(intl)} />
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
