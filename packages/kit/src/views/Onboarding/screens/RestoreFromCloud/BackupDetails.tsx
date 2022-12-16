import { Box } from '@onekeyhq/components';

import CloudBackupDetails from '../../../Me/SecuritySection/CloudBackup/BackupDetails';
import Layout from '../../Layout';

const BackupDetails = () => (
  <Layout fullHeight>
    <Box mx={-4} flex={1}>
      <CloudBackupDetails onboarding />
    </Box>
  </Layout>
);

export default BackupDetails;
