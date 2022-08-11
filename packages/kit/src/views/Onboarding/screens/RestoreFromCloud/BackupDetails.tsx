import React from 'react';

import { useIntl } from 'react-intl';

import CloudBackupDetails from '../../../Me/SecuritySection/CloudBackup/BackupDetails';
import Layout from '../../Layout';

const BackupDetails = () => {
  const intl = useIntl();

  return (
    <Layout
      title={intl.formatMessage({ id: 'title__backup_details' })}
      secondaryContent={<CloudBackupDetails onboarding />}
    />
  );
};

export default BackupDetails;
