import { YStack } from '@onekeyhq/components';
import { HyperlinkText } from '@onekeyhq/kit/src/components/HyperlinkText';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { Layout } from './utils/Layout';

const HyperlinkTextGallery = () => (
  <Layout
    filePath={__CURRENT_FILE_PATH__}
    componentName="HyperlinkText"
    description="FormattedMessage component for i18n text display"
    suggestions={['Use for displaying translated text']}
    boundaryConditions={['Must provide valid translation key']}
    elements={[
      {
        title: 'Basic Usage',
        element: (
          <YStack gap="$3">
            <HyperlinkText
              translationId={ETranslations.hardware_software_cannot_be_upgrade}
            />
          </YStack>
        ),
      },
    ]}
  />
);

export default HyperlinkTextGallery;
