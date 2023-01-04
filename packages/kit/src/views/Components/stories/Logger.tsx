import { useEffect, useState } from 'react';

import {
  Box,
  Button,
  CheckBox,
  ScrollView,
  Text,
  Typography,
} from '@onekeyhq/components';
import {
  LoggerNames,
  logger,
  saveDebugLoggerSettings,
} from '@onekeyhq/shared/src/logger/debugLogger';

import { useNavigationBack } from '../../../hooks/useAppNavigation';

function DebugLoggerSettings() {
  const [keys, setKeys] = useState<LoggerNames[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [checkedStatus, setCheckedStatus] = useState<
    Partial<Record<LoggerNames, boolean>>
  >({});
  useEffect(() => {
    const allKeys = Object.keys(LoggerNames)
      .sort()
      .filter((key) => key !== 'debug');
    setKeys(allKeys as LoggerNames[]);
  }, []);
  return (
    <Box>
      {keys.map((key: LoggerNames) => (
        <Box py={1} key={key}>
          <CheckBox
            flex={1}
            value={key}
            // @ts-ignore
            isChecked={!!logger._isExtensionEnabled(key)}
            // isChecked={checkedStatus[key]}
            onChange={(status) => {
              console.log('logger update >>> ', status, key);
              setTimeout(() => {
                setCheckedStatus((map) => ({ ...map, [key]: status }));
                saveDebugLoggerSettings();
              }, 0);
              return status ? logger.enable(key) : logger.disable(key);
            }}
          >
            <Box minW={300} pl={2}>
              <Text>{key}</Text>
            </Box>
          </CheckBox>
        </Box>
      ))}
    </Box>
  );
}

const LoggerGallery = () => {
  const goBack = useNavigationBack();
  return (
    <ScrollView p={4} flex="1" bg="background-hovered">
      <Typography.DisplayXLarge>DebugLogger</Typography.DisplayXLarge>
      <Button onPress={goBack}>Back to HOME</Button>
      <Button
        onPress={() => {
          if (global.localStorage) {
            const key = '@onekey_debug_useEffect_log';
            const value = global.localStorage.getItem(key) ? '' : 'on';
            global.localStorage.setItem(key, value);
            console.log(
              `localStorage setItem:  @onekey_debug_useEffect_log=${value}`,
            );
          }
        }}
      >
        Toggle UseEffect log
      </Button>
      <Box py={4}>
        <DebugLoggerSettings />
      </Box>
      <Button onPress={goBack}>Back to HOME</Button>
    </ScrollView>
  );
};
export default LoggerGallery;
