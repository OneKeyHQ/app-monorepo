import React from 'react';

import { useIntl } from 'react-intl';

import CloudBackupPreviousBackups from '../../../Me/SecuritySection/CloudBackup/PreviousBackups';
import Layout from '../../Layout';

const BackupsList = () => {
  const intl = useIntl();

  return (
    <Layout
      title={intl.formatMessage({ id: 'content__previous_backups' })}
      secondaryContent={<CloudBackupPreviousBackups />}
    />
  );
};

export default BackupsList;
