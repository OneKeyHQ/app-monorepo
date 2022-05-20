import React, { useCallback } from 'react';

import { useIntl } from 'react-intl';

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
  const intl = useIntl();

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
            {intl.formatMessage({ id: 'form__dev_mode' })}
          </Typography.Subheading>
        </Box>
        <Container.Box>
          <Container.Item
            title={intl.formatMessage({ id: 'form__dev_mode' })}
            titleColor="text-default"
          >
            <Switch
              labelType="false"
              isChecked={devModeEnable}
              onToggle={onToggleDebugMode}
            />
          </Container.Item>
          <Container.Item
            title={intl.formatMessage({ id: 'form__dev_pre_update' })}
            titleColor="text-default"
          >
            <Switch
              labelType="false"
              isChecked={preReleaseUpdate}
              onToggle={onToggleTestVersionUpdate}
            />
          </Container.Item>
          <Container.Item
            title={intl.formatMessage({ id: 'form__dev_platform_channel' })}
            titleColor="text-default"
            subDescribe={[
              `ONEKEY_PLATFORM: ${process.env.ONEKEY_PLATFORM ?? 'undefined'}`,
              `EXT_CHANNEL: ${process.env.EXT_CHANNEL ?? 'undefined'}`,
              `ANDROID_CHANNEL: ${process.env.ANDROID_CHANNEL ?? 'undefined'}`,
              `DESKTOP_PLATFORM: ${window?.desktopApi?.platform}`,
              `DESKTOP_ARCH: ${window?.desktopApi?.arch}`,
            ]}
          />
        </Container.Box>
      </Box>
    </>
  );
};
