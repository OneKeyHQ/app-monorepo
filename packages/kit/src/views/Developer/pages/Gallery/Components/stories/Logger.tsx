import { useCallback } from 'react';

import {
  Accordion,
  Button,
  Checkbox,
  SizableText,
  Stack,
} from '@onekeyhq/components';
import { exportLogs } from '@onekeyhq/kit/src/views/Setting/pages/List/ResourceSection/StateLogsItem/logs';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import perfUtils, {
  EPerformanceTimerLogNames,
} from '@onekeyhq/shared/src/utils/debug/perfUtils';

import LoggingConfigCheckbox from './LoggerConfigGallery';
import { Layout } from './utils/Layout';

const LoggerDemo = () => {
  const downloadLog = useCallback(() => {
    void exportLogs('onekey_logs');
  }, []);
  return (
    <Stack gap="$2">
      <Accordion
        type="multiple"
        defaultValue={
          [
            // 'logging-config',
            // 'logging-perf',
            // 'logging-demo'
          ]
        }
      >
        <Accordion.Item value="logging-config">
          <Accordion.Trigger>
            {({ open }: { open: boolean }) => (
              <SizableText>LoggingConfig {open ? '↓' : '→'}</SizableText>
            )}
          </Accordion.Trigger>
          <Accordion.Content>
            <LoggingConfigCheckbox />
          </Accordion.Content>
        </Accordion.Item>

        <Accordion.Item value="logging-perf">
          <Accordion.Trigger>
            {({ open }: { open: boolean }) => (
              <SizableText>PerformanceTimer Log {open ? '↓' : '→'}</SizableText>
            )}
          </Accordion.Trigger>
          <Accordion.Content>
            {Object.values(EPerformanceTimerLogNames).map((logName) => (
              <Checkbox
                key={logName}
                isUncontrolled
                defaultChecked={perfUtils.getPerformanceTimerLogConfig(logName)}
                label={logName}
                onChange={(v) =>
                  perfUtils.updatePerformanceTimerLogConfig(logName as any, !!v)
                }
              />
            ))}
          </Accordion.Content>
        </Accordion.Item>

        <Accordion.Item value="logging-demo">
          <Accordion.Trigger>
            {({ open }: { open: boolean }) => (
              <SizableText>LoggingDemo {open ? '↓' : '→'}</SizableText>
            )}
          </Accordion.Trigger>
          <Accordion.Content>
            <Button onPress={() => defaultLogger.demo.math.sum(1, 2)}>
              Log #1
            </Button>
            <Button onPress={() => defaultLogger.demo.math.obj(1, 2)}>
              Log #2
            </Button>
            <Button onPress={() => defaultLogger.demo.math.arr(1, 2)}>
              Log #3
            </Button>
            <Button
              onPress={() => defaultLogger.demo.math.logSensitiveMessage(1, 2)}
            >
              logSensitiveMessage
            </Button>
            <Button
              onPress={() =>
                defaultLogger.app.page.pageView('HelloWorld.'.repeat(100_000))
              }
            >
              Log large content
            </Button>
            <Button
              onPress={() =>
                defaultLogger.discovery.browser.tabsData([
                  {
                    id: '1',
                    url: '1',
                    title: 'Tab 1',
                  },
                ])
              }
            >
              Log Browser Tabs
            </Button>
            <Button onPress={downloadLog}>Download Log</Button>
            <Button
              onPress={() => {
                console.log(
                  'BigInt toString: ',
                  1_234_567_890_123_456_789_077_777_777_777_777_777_799_999_999_999_998_888_888n.toString(),
                );
              }}
            >
              BigInt toString
            </Button>
            <Button
              onPress={() => {
                console.log(
                  'Int toString: ',
                  // eslint-disable-next-line no-loss-of-precision, @typescript-eslint/no-loss-of-precision
                  (1_234_567_890_123_456_789_077_777_777_777_777_777_799_999_999_999_998_888_888).toString(),
                );
              }}
            >
              Int toString
            </Button>
          </Accordion.Content>
        </Accordion.Item>
      </Accordion>
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
          <Stack gap="$1">
            <LoggerDemo />
          </Stack>
        ),
      },
    ]}
  />
);

export default LoggerGallery;
