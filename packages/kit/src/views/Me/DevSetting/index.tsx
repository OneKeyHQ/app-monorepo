import React, { useCallback } from 'react';

import { Box, Container, Switch, Typography } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useSettings } from '@onekeyhq/kit/src/hooks/redux';
import {
  setDevMode,
  setPreReleaseUpdate,
} from '@onekeyhq/kit/src/store/reducers/settings';

export const DevSettingSection = () => {
  const { enable: devModeEnable, preReleaseUpdate } =
    useSettings().devMode || {};
  const { dispatch } = backgroundApiProxy;

  const onToggleTestVersionUpdate = useCallback(() => {
    dispatch(setPreReleaseUpdate(!preReleaseUpdate));
  }, [preReleaseUpdate, dispatch]);

  const onToggleDebugMode = useCallback(() => {
    dispatch(setDevMode(!devModeEnable));
  }, [devModeEnable, dispatch]);

  return (
    <>
      <Box w="full" mb="6">
        <Box pb="2">
          <Typography.Subheading color="text-subdued">
            Debug
          </Typography.Subheading>
        </Box>
        <Container.Box>
          <Container.Item title="Dev Mode" titleColor="text-default">
            <Switch
              labelType="false"
              isChecked={devModeEnable}
              onToggle={onToggleDebugMode}
            />
          </Container.Item>
          <Container.Item title="Pre Release Update" titleColor="text-default">
            <Switch
              labelType="false"
              isChecked={preReleaseUpdate}
              onToggle={onToggleTestVersionUpdate}
            />
          </Container.Item>
          <Container.Item
            title="Platform and Channel"
            titleColor="text-default"
            subDescribe={[
              `ONEKEY_PLATFORM: ${process.env.ONEKEY_PLATFORM ?? ''}`,
              `EXT_CHANNEL: ${process.env.EXT_CHANNEL ?? ''}`,
              `ANDROID_CHANNEL: ${process.env.ANDROID_CHANNEL ?? ''}`,
              `DESKTOP_PLATFORM: ${window?.desktopApi?.platform}`,
              `DESKTOP_PLATFORM_ARCH: ${window?.desktopApi?.arch}`,
            ]}
          />
        </Container.Box>
      </Box>
    </>
  );
};
