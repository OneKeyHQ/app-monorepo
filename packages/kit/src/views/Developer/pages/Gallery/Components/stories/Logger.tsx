import { useCallback } from 'react';

import { Button, Stack } from '@onekeyhq/components';
import { exportLogs } from '@onekeyhq/kit/src/views/Setting/pages/List/ResourceSection/StateLogsItem/logs';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

import { Layout } from './utils/Layout';

const LoggerDemo = () => {
  const downloadLog = useCallback(() => {
    void exportLogs('onekey_logs');
  }, []);
  return (
    <Stack space="$2">
      <Button onPress={() => defaultLogger.demo.math.sum(1, 2)}>Log #1</Button>
      <Button onPress={() => defaultLogger.demo.math.obj(1, 2)}>Log #2</Button>
      <Button onPress={() => defaultLogger.demo.math.arr(1, 2)}>Log #3</Button>
      <Button onPress={() => defaultLogger.demo.math.logSensitiveMessage(1, 2)}>
        Log #4
      </Button>
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
