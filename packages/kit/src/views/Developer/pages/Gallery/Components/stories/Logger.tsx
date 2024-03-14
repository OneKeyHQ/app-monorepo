import { useCallback } from 'react';

import { Button, Stack } from '@onekeyhq/components';
import { exportLogs } from '@onekeyhq/kit/src/views/Setting/pages/List/ResourceSection/StateLogsItem/logs';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

import { Layout } from './utils/Layout';

const LoggerDemo = () => {
  const writeLog = useCallback(() => {
    defaultLogger.common.test('a', 2);
  }, []);
  const downloadLog = useCallback(() => {
    void exportLogs();
  }, []);
  return (
    <Stack space="$2">
      <Button onPress={writeLog}>Write Log</Button>
      <Button onPress={downloadLog}>Download Log</Button>
    </Stack>
  );
};

const LoggerGallery = () => (
  <Layout
    description=""
    suggestions={[]}
    boundaryConditions={[]}
    elements={[
      {
        title: 'Logger',
        element: (
          <Stack space="$1">
            <LoggerDemo />
          </Stack>
        ),
      },
    ]}
  />
);

export default LoggerGallery;
