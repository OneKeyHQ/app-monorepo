import React, { useEffect } from 'react';

import {
  Box,
  Button,
  CheckBox,
  ScrollView,
  Typography,
} from '@onekeyhq/components';
import { LoggerNames, logger } from '@onekeyhq/shared/src/logger/debugLogger';

import { useNavigationBack } from '../../../hooks/useAppNavigation';

function DebugLoggerSettings() {
  const [keys, setKeys] = React.useState<string[]>([]);

  useEffect(() => {
    const allKeys = Object.keys(LoggerNames).filter((key) => key !== 'debug');
    setKeys(allKeys);
  }, []);
  return (
    <Box>
      <Typography.DisplayXLarge>DebugLogger</Typography.DisplayXLarge>
      {keys.map((key: string) => (
        <Box py={1} key={key}>
          <CheckBox
            key={key}
            value={key}
            onChange={(status) =>
              status ? logger.enable(key) : logger.disable(key)
            }
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
