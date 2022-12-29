import { useCallback, useEffect, useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  Container,
  HStack,
  Pressable,
  Select,
  Switch,
  Text,
  ToastManager,
  Typography,
  useTheme,
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
  setEnablePerfCheck,
  setEnableTestFiatEndpoint,
  setEnableZeroNotificationThreshold,
  setOverviewDefiBuildByService,
  setPreReleaseUpdate,
  setUpdateDeviceBle,
  setUpdateDeviceRes,
  setUpdateDeviceSys,
} from '@onekeyhq/kit/src/store/reducers/settings';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { NetworkAccountSelectorTrigger } from '../../../components/NetworkAccountSelector';
import { EAccountSelectorMode } from '../../../store/reducers/reducerAccountSelector';

interface IOneKeyPerfCheckPayload {
  testID?: string;
  componentName?: string;

  flatListInfo?: {
    cellKey?: string;
    firstData?: any;
    contentLength?: number;
    perfCheckContentLength?: number;
  };
}
const perfCheckResult: Record<string, IOneKeyPerfCheckPayload> = {};
function usePerfCheck({ enablePerfCheck }: { enablePerfCheck?: boolean }) {
  useEffect(() => {
    if (enablePerfCheck && platformEnv.isRuntimeBrowser) {
      const handler = ((event: CustomEvent) => {
        const payload: IOneKeyPerfCheckPayload = event.detail;
        const id =
          payload?.testID ||
          [payload?.componentName, payload?.flatListInfo?.cellKey]
            .filter(Boolean)
            .join('--');
        if (id && payload) {
          perfCheckResult[id] = payload;
        }
      }) as any;
      window.addEventListener('OneKeyEventPerfCheck', handler);
      return () => {
        window.removeEventListener('OneKeyEventPerfCheck', handler);
      };
    }
  }, [enablePerfCheck]);
}

export const DevSettingSection = () => {
  const { themeVariant } = useTheme();
  const { devMode, pushNotification, instanceId } = useSettings();
  const { registrationId } = pushNotification || {};
  const {
    enable: devModeEnable,
    preReleaseUpdate,
    updateDeviceBle,
    updateDeviceSys,
    updateDeviceRes,
    enableTestFiatEndpoint,
    enableZeroNotificationThreshold,
    enablePerfCheck,
    defiBuildService,
  } = devMode || {};
  const { dispatch } = backgroundApiProxy;
  const intl = useIntl();
  usePerfCheck({ enablePerfCheck });

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
    ToastManager.show({ title: intl.formatMessage({ id: 'msg__copied' }) });
  }, [intl, pushId]);

  const fiatEndpoint = useMemo(getFiatEndpoint, [enableTestFiatEndpoint]);

  return (
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
          title="Build Hash"
          titleColor="text-critical"
          subDescribeCustom={
            <Text color="text-subdued">
              {process.env.GITHUB_SHA
                ? shortenAddress(process.env.GITHUB_SHA)
                : '--'}
            </Text>
          }
        />
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
          title={intl.formatMessage({ id: 'action__test_update_resource' })}
          titleColor="text-critical"
        >
          <Switch
            labelType="false"
            isChecked={updateDeviceRes}
            onToggle={() => {
              dispatch(setUpdateDeviceRes(!updateDeviceRes));
            }}
          />
        </Container.Item>
        <Container.Item
          title={intl.formatMessage({ id: 'action__test_onekey_service' })}
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
        <Container.Item title="允许推送阈值设置为0" titleColor="text-critical">
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
        <Container.Item title="Perf Check" titleColor="text-critical">
          <HStack space={4}>
            <Button
              size="xs"
              onPress={() => {
                copyToClipboard(
                  JSON.stringify({
                    $$onekeyPerfTrace: global?.$$onekeyPerfTrace,
                    perfCheckResult,
                  }),
                );
                ToastManager.show({
                  title: intl.formatMessage({ id: 'msg__copied' }),
                });
                console.log('perfCheckResult', perfCheckResult);
                console.log('$$onekeyPerfTrace', global?.$$onekeyPerfTrace);
              }}
            >
              Export
            </Button>
            <Switch
              labelType="false"
              isChecked={!!enablePerfCheck}
              onToggle={() => {
                dispatch(setEnablePerfCheck(!enablePerfCheck));
              }}
            />
          </HStack>
        </Container.Item>
        <Container.Item
          title="All-Chain Send"
          titleColor="text-critical"
          subDescribeCustom={
            <NetworkAccountSelectorTrigger
              mode={EAccountSelectorMode.Transfer}
            />
          }
        />
        <Container.Item
          title="All-Chain Send"
          titleColor="text-critical"
          subDescribeCustom={
            <Select
              isTriggerPlain
              headerShown={false}
              footer={null}
              containerProps={{
                style: {
                  minWidth: '100px',
                },
              }}
              onChange={(value) => {
                dispatch(setOverviewDefiBuildByService(value));
              }}
              value={defiBuildService || 'all'}
              options={['all', '3', '5', '6', '9'].map((n) => ({
                label: n,
                value: n,
              }))}
            />
          }
        />
      </Container.Box>
    </Box>
  );
};
