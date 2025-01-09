import { YStack } from '@onekeyhq/components';
import { FormattedMessage } from '@onekeyhq/kit/src/components/FormattedMessage';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { Layout } from './utils/Layout';

const FormatMessageGallery = () => (
  <Layout
    description="FormattedMessage component for i18n text display"
    suggestions={['Use for displaying translated text']}
    boundaryConditions={['Must provide valid translation key']}
    elements={[
      {
        title: 'Basic Usage',
        element: (
          <YStack gap="$3">
            <FormattedMessage
              id={ETranslations.hardware_software_cannot_be_upgrade}
              //   defaultMessage={
              //     'o troubleshoot connection issues:\n\n1. Ensure OneKey Bridge is installed and running.\n2. Refresh or switch your browser, then try again.\n3. Use a different cable and port.\n\nIf this doesn’t help, contact <a href="https://onekey.so" style="text-decoration: none;">OneKey support</a>.'
              //   }
              textProps={{}}
            />
          </YStack>
        ),
      },
    ]}
  />
);

export default FormatMessageGallery;
