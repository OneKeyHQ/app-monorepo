import { useIntl } from 'react-intl';

import { Page } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

function CustomNonce() {
  const intl = useIntl();

  return (
    <Page>
      <Page.Header
        title={intl.formatMessage({ id: ETranslations.global_customize_nonce })}
      />
      <Page.Body>Hello World</Page.Body>
    </Page>
  );
}

export default CustomNonce;
