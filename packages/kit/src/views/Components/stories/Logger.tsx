import React, { useEffect } from 'react';

import {
  Box,
  Button,
  CheckBox,
  ScrollView,
  Typography,
} from '@onekeyhq/components';
import {
  LoggerNames,
  logger,
  saveDebugLoggerSettings,
} from '@onekeyhq/shared/src/logger/debugLogger';

import { useNavigationBack } from '../../../hooks/useAppNavigation';

function DebugLoggerSettings() {
  const [keys, setKeys] = React.useState<LoggerNames[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [checkedStatus, setCheckedStatus] = React.useState<
    Partial<Record<LoggerNames, boolean>>
  >({});
  useEffect(() => {
    const allKeys = Object.keys(LoggerNames).filter((key) => key !== 'debug');
    setKeys(allKeys as LoggerNames[]);
  }, []);
  return (
    <Box>
      <Typography.DisplayXLarge>DebugLogger</Typography.DisplayXLarge>
      {keys.map((key: LoggerNames) => (
        <Box py={1} key={key}>
          <CheckBox
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
            {key}
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
      <Button onPress={goBack}>Back to HOME</Button>
      <DebugLoggerSettings />
    </ScrollView>
  );
};
export default LoggerGallery;
