import { useIntl } from 'react-intl';

import { Box } from '@onekeyhq/components';

import CloudBackupPreviousBackups from '../../../Me/SecuritySection/CloudBackup/PreviousBackups';
import Layout from '../../Layout';

const BackupsList = () => {
  const intl = useIntl();

  return (
    <Layout title={intl.formatMessage({ id: 'content__previous_backups' })}>
      <Box mx={-4}>
        <CloudBackupPreviousBackups />
      </Box>
    </Layout>
  );
};

export default BackupsList;
