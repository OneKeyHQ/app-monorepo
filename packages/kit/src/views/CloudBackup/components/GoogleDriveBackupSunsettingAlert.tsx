import { useIntl } from 'react-intl';

import { Alert } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

const GoogleDriveBackupSunsettingAlert = () => {
  const intl = useIntl();

  return (
    <Alert
      m="$5"
      title={intl.formatMessage({
        id: ETranslations.backup_google_backup_sunsetting,
      })}
      description={intl.formatMessage({
        id: ETranslations.backup_google_backup_sunsetting_description,
      })}
      type="warning"
    />
  );
};

export default GoogleDriveBackupSunsettingAlert;
