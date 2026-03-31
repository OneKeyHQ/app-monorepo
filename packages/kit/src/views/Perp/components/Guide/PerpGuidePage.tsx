import { useIntl } from 'react-intl';

import { Page } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { PerpsProviderMirror } from '../../PerpsProviderMirror';

import { PerpGuideContent } from './PerpGuideContent';

function PerpGuidePageContent() {
  const intl = useIntl();
  return (
    <Page>
      <Page.Header
        title={intl.formatMessage({
          id: ETranslations.perp_guide_help_center,
        })}
      />
      <Page.Body>
        <PerpGuideContent />
      </Page.Body>
    </Page>
  );
}

export default function PerpGuidePage() {
  return (
    <PerpsProviderMirror>
      <PerpGuidePageContent />
    </PerpsProviderMirror>
  );
}
