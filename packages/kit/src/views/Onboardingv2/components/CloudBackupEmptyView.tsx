import { useIntl } from 'react-intl';

import { Empty } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

export function CloudBackupListEmptyView() {
  const intl = useIntl();

  if (platformEnv.isNativeIOS || platformEnv.isDesktopMac) {
    return (
      <Empty
        title={intl.formatMessage({ id: ETranslations.no_backups_found })}
        description={intl.formatMessage({
          id: ETranslations.no_backup_found_icloud_desc,
        })}
      />
    );
  }
  return (
    <Empty
      title={intl.formatMessage({ id: ETranslations.no_backups_found })}
      description={intl.formatMessage({
        id: ETranslations.no_backup_found_google_desc,
      })}
    />
  );
}

export function CloudBackupDetailsEmptyView() {
  const intl = useIntl();

  return (
    <Empty
      title={intl.formatMessage({
        id: ETranslations.no_backup_found_no_wallet,
      })}
      description={intl.formatMessage({
        id: ETranslations.no_backup_found_no_wallet_desc,
      })}
    />
  );
}
