import React, { useCallback } from 'react';

import { Box, Container, Switch, Typography } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useDevSettings } from '@onekeyhq/kit/src/hooks/redux';

import {
  setDebugMode,
  setTestVersionUpdate,
} from '../../../store/reducers/devSettings';

export const DevSettingSection = () => {
  const devSetting = useDevSettings();
  const { dispatch } = backgroundApiProxy;

  const onToggleTestVersionUpdate = useCallback(() => {
    dispatch(setTestVersionUpdate(!devSetting.testVersionUpdate));
  }, [devSetting.testVersionUpdate, dispatch]);

  const onToggleDebugMode = useCallback(() => {
    dispatch(setDebugMode(!devSetting.debugMode));
  }, [devSetting.debugMode, dispatch]);

  return (
    <>
      <Box w="full" mb="6">
        <Box pb="2">
          <Typography.Subheading color="text-subdued">
            Debug
          </Typography.Subheading>
        </Box>
        <Container.Box>
          <Container.Item title="Debug Mode" titleColor="text-default">
            <Switch
              labelType="false"
              isChecked={devSetting.debugMode}
              onToggle={onToggleDebugMode}
            />
          </Container.Item>
          <Container.Item title="Test Update" titleColor="text-default">
            <Switch
              labelType="false"
              isChecked={devSetting.testVersionUpdate}
              onToggle={onToggleTestVersionUpdate}
            />
          </Container.Item>
        </Container.Box>
      </Box>
    </>
  );
};
