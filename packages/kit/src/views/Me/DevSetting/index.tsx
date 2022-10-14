import React, { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  Box,
  Container,
  Pressable,
  Switch,
  Text,
  Typography,
  useTheme,
  useToast,
} from '@onekeyhq/components';
import { shortenAddress } from '@onekeyhq/components/src/utils';
import { copyToClipboard } from '@onekeyhq/components/src/utils/ClipboardUtils';
import {
  getFiatEndpoint,
  getSocketEndpoint,
} from '@onekeyhq/engine/src/endpoint';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useSettings } from '@onekeyhq/kit/src/hooks/redux';
import {
  setDevMode,
  setEnableTestFiatEndpoint,
  setEnableZeroNotificationThreshold,
  setPreReleaseUpdate,
  setUpdateDeviceBle,
  setUpdateDeviceSys,
} from '@onekeyhq/kit/src/store/reducers/settings';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { NetworkAccountSelectorTrigger } from '../../../components/NetworkAccountSelector';
import { EAccountSelectorMode } from '../../../store/reducers/reducerAccountSelector';

export const DevSettingSection = () => {
  const toast = useToast();
  const { themeVariant } = useTheme();
  const { devMode, pushNotification, instanceId } = useSettings();
  const { registrationId } = pushNotification || {};
  const {
    enable: devModeEnable,
    preReleaseUpdate,
    updateDeviceBle,
    updateDeviceSys,
    enableTestFiatEndpoint,
    enableZeroNotificationThreshold,
  } = devMode || {};
  const { dispatch } = backgroundApiProxy;
  const intl = useIntl();

  const pushId = useMemo(() => {
    if (platformEnv.isNative) {
      return registrationId;
    }
    return instanceId;
  }, [registrationId, instanceId]);
  const onToggleTestVersionUpdate = useCallback(() => {
    dispatch(setPreReleaseUpdate(!preReleaseUpdate));
    if (platformEnv.isDesktop) {
      window.desktopApi?.setAutoUpdateSettings?.({
        useTestFeedUrl: !preReleaseUpdate,
      });
    }
  }, [preReleaseUpdate, dispatch]);

  const onToggleDebugMode = useCallback(() => {
    dispatch(setDevMode(!devModeEnable));
  }, [devModeEnable, dispatch]);

  const copyRegistrationId = useCallback(() => {
    copyToClipboard(pushId || '');
    toast.show({ title: intl.formatMessage({ id: 'msg__copied' }) });
  }, [toast, intl, pushId]);

  const fiatEndpoint = useMemo(getFiatEndpoint, [enableTestFiatEndpoint]);

  return (
    <>
      <Box w="full" mb="6">
        <Box pb="2">
          <Typography.Subheading color="text-critical">
            {intl.formatMessage({ id: 'form__dev_mode' })}
          </Typography.Subheading>
        </Box>
        <Container.Box
          borderWidth={themeVariant === 'light' ? 1 : undefined}
          borderColor="border-critical-default"
          borderRadius="12"
          bg="surface-default"
        >
          <Container.Item
            title={intl.formatMessage({ id: 'form__dev_mode' })}
            titleColor="text-critical"
          >
            <Switch
              labelType="false"
              isChecked={devModeEnable}
              onToggle={onToggleDebugMode}
            />
          </Container.Item>
          <Container.Item
            title={intl.formatMessage({ id: 'form__dev_pre_update' })}
            titleColor="text-critical"
          >
            <Switch
              labelType="false"
              isChecked={preReleaseUpdate}
              onToggle={onToggleTestVersionUpdate}
            />
          </Container.Item>
          <Container.Item
            title={intl.formatMessage({
              id: 'action__test_update_ble_firmware',
            })}
            titleColor="text-critical"
          >
            <Switch
              labelType="false"
              isChecked={updateDeviceBle}
              onToggle={() => {
                dispatch(setUpdateDeviceBle(!updateDeviceBle));
              }}
            />
          </Container.Item>
          <Container.Item
            title={intl.formatMessage({ id: 'action__test_update_firmware' })}
            titleColor="text-critical"
          >
            <Switch
              labelType="false"
              isChecked={updateDeviceSys}
              onToggle={() => {
                dispatch(setUpdateDeviceSys(!updateDeviceSys));
              }}
            />
          </Container.Item>
          <Container.Item
            title="测试环境域名(需要重启App)"
            subDescribe={`范围: \n[token、价格、余额、推送] \n ${fiatEndpoint}\n ${getSocketEndpoint()}`}
            titleColor="text-critical"
          >
            <Switch
              labelType="false"
              isChecked={enableTestFiatEndpoint}
              onToggle={() => {
                dispatch(setEnableTestFiatEndpoint(!enableTestFiatEndpoint));
              }}
            />
          </Container.Item>
          <Container.Item
            title="允许推送阈值设置为0"
            titleColor="text-critical"
          >
            <Switch
              labelType="false"
              isChecked={!!enableZeroNotificationThreshold}
              onToggle={() => {
                dispatch(
                  setEnableZeroNotificationThreshold(
                    !enableZeroNotificationThreshold,
                  ),
                );
              }}
            />
          </Container.Item>
          <Container.Item
            title="registrationId"
            titleColor="text-critical"
            subDescribeCustom={
              <Pressable onPress={copyRegistrationId}>
                <Text color="text-subdued">{shortenAddress(pushId || '')}</Text>
              </Pressable>
            }
          />
          <Container.Item
            title={intl.formatMessage({ id: 'form__dev_platform_channel' })}
            titleColor="text-critical"
            subDescribe={[
              `${platformEnv.symbol ?? ''} / ${
                platformEnv.distributionChannel ?? ''
              }`,
            ]}
          />
          <Container.Item
            title="All-Chain Send"
            titleColor="text-critical"
            subDescribeCustom={
              <NetworkAccountSelectorTrigger
                mode={EAccountSelectorMode.Transfer}
              />
            }
          />
        </Container.Box>
      </Box>
    </>
  );
};
