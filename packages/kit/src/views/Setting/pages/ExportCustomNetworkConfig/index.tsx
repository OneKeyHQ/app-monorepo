import { useIntl } from 'react-intl';

import { Page } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { ETranslations } from '@onekeyhq/shared/src/locale';

const ExportCustomNetworkConfigPage = () => {
  const intl = useIntl();
  return (
    <Page>
      <Page.Header
        title={intl.formatMessage({ id: ETranslations.settings_protection })}
      />
      <Page.Body />
    </Page>
  );
};

export default ExportCustomNetworkConfigPage;
