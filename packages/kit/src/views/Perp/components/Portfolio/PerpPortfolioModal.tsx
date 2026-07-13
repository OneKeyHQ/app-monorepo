import { useIntl } from 'react-intl';

import { Page, ScrollView } from '@onekeyhq/components';
import type { useInTabDialog } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { PerpsAccountSelectorProviderMirror } from '../../PerpsAccountSelectorProviderMirror';
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
      // In-tab dialogs render through the IN_PAGE_TAB_CONTAINER portal at the
      // TabNavigator root, so they do NOT inherit the page/header providers.
      // Web-dapp /perps opens this from the header pill (no perps page tree), so
      // mirror the native page nesting for dialog flows started from this content.
      <PerpsAccountSelectorProviderMirror>
        <PerpsProviderMirror>
          <PerpPortfolioContent isMobile={false} />
        </PerpsProviderMirror>
      </PerpsAccountSelectorProviderMirror>
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
