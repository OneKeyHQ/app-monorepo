import type { FC } from 'react';
import { useCallback, useEffect, useMemo } from 'react';

import { useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  Container,
  Dialog,
  HStack,
  Pressable,
  Select,
  Switch,
  Text,
  ToastManager,
  Typography,
  VStack,
  useTheme,
} from '@onekeyhq/components';
import { shortenAddress } from '@onekeyhq/components/src/utils';
import { copyToClipboard } from '@onekeyhq/components/src/utils/ClipboardUtils';
import {
  getCovalentApiEndpoint,
  getFiatEndpoint,
  getSocketEndpoint,
} from '@onekeyhq/engine/src/endpoint';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useSettings } from '@onekeyhq/kit/src/hooks/redux';
import type { ISettingsDevModeInfo } from '@onekeyhq/kit/src/store/reducers/settings';
import {
  setDevMode,
  setEnablePerfCheck,
  setEnableTestFiatEndpoint,
  setEnableZeroNotificationThreshold,
  setHideDiscoverContent,
  setOnRamperTestMode,
  setOverviewDefiBuildByService,
  setPreReleaseUpdate,
  setShowContentScriptReloadButton,
  setShowWebEmbedWebviewAgent,
  setUpdateDeviceBle,
  setUpdateDeviceRes,
  setUpdateDeviceSys,
} from '@onekeyhq/kit/src/store/reducers/settings';
import timelinePerfTrace from '@onekeyhq/shared/src/perf/timelinePerfTrace';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { NetworkAccountSelectorTrigger } from '../../../components/NetworkAccountSelector';
import { ModalRoutes, RootRoutes } from '../../../routes/routesEnum';
import { EAccountSelectorMode } from '../../../store/reducers/reducerAccountSelector';
import { showDialog } from '../../../utils/overlayUtils';
import { MonitorRoutes } from '../../Monitor/types';

import { requestsInterceptTest } from './requestsInterceptTest';

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
const emptyObj: any = Object.freeze({});

const DialogGetEnvPath: FC<{
  message: string;
  onClose?: () => void;
  onConfirm?: () => void;
}> = ({ onConfirm, message, onClose }) => {
  const intl = useIntl();
  return (
    <Dialog
      visible
      onClose={onClose}
      contentProps={{
        title: 'getEnvPath',
        contentElement: (
          <VStack>
            <Typography.Body2 textAlign="center" wordBreak="break-all">
              {message}
            </Typography.Body2>
          </VStack>
        ),
      }}
    />
  );
};

export const DevSettingSection = () => {
  const { themeVariant } = useTheme();
  const { devMode, pushNotification, instanceId } = useSettings();
  const registrationId = pushNotification?.registrationId;
  const devModeData: ISettingsDevModeInfo = devMode || emptyObj;
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
    hideDiscoverContent,
    onRamperTestMode,
    showWebEmbedWebviewAgent,
    showContentScriptReloadButton,
  } = devModeData;
  const { dispatch } = backgroundApiProxy;
  const intl = useIntl();
  usePerfCheck({ enablePerfCheck });

  const navigation = useNavigation();

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
        mb="24"
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
          subDescribe={`范围: \n[token、价格、余额、推送、历史记录] \n ${fiatEndpoint}\n ${getSocketEndpoint()} \n ${getCovalentApiEndpoint()}`}
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
                const timelinePerfTraceData =
                  timelinePerfTrace.getTimelineData();
                copyToClipboard(
                  JSON.stringify({
                    $$onekeyPerfTrace: global?.$$onekeyPerfTrace,
                    perfCheckResult,
                    timelinePerfTraceData,
                  }),
                );
                ToastManager.show({
                  title: intl.formatMessage({ id: 'msg__copied' }),
                });
                console.log('$$onekeyPerfTrace', global?.$$onekeyPerfTrace);
                console.log('perfCheckResult', perfCheckResult);
                console.log('timelinePerfTraceData', timelinePerfTraceData);
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
          title="Overview build by service"
          titleColor="text-critical"
          subDescribeCustom={
            <Select
              isTriggerPlain
              headerShown={false}
              footer={null}
              containerProps={{
                style: {
                  minWidth: 100,
                },
              }}
              onChange={(value) => {
                dispatch(setOverviewDefiBuildByService(value));
              }}
              value={defiBuildService || 'all'}
              options={['all', '3', '5', '6', '9', '12'].map((n) => ({
                label: n,
                value: n,
              }))}
            />
          }
        />
        <Container.Item
          title="Hidden Discover Content"
          titleColor="text-critical"
        >
          <Switch
            labelType="false"
            isChecked={hideDiscoverContent}
            onToggle={() => {
              dispatch(setHideDiscoverContent(!hideDiscoverContent));
            }}
          />
        </Container.Item>
        <Container.Item
          title="Enable OnRamper Test Mode"
          titleColor="text-critical"
        >
          <Switch
            labelType="false"
            isChecked={onRamperTestMode}
            onToggle={() => {
              dispatch(setOnRamperTestMode(!onRamperTestMode));
            }}
          />
        </Container.Item>
        <Container.Item
          title="Show WebEmbed Webview Agent"
          titleColor="text-critical"
        >
          <Switch
            labelType="false"
            isChecked={showWebEmbedWebviewAgent}
            onToggle={() => {
              dispatch(setShowWebEmbedWebviewAgent(!showWebEmbedWebviewAgent));
            }}
          />
        </Container.Item>
        <Container.Item
          title="Show content-script reload BUTTON"
          titleColor="text-critical"
        >
          <Switch
            labelType="false"
            isChecked={showContentScriptReloadButton}
            onToggle={() => {
              dispatch(
                setShowContentScriptReloadButton(
                  !showContentScriptReloadButton,
                ),
              );
            }}
          />
        </Container.Item>

        <Container.Item
          title="Print Env Path in Desktop"
          titleColor="text-critical"
        >
          <Button
            size="xs"
            onPress={() => {
              const envPath = window?.desktopApi.getEnvPath();
              console.log(envPath);
              showDialog(
                <DialogGetEnvPath message={JSON.stringify(envPath, null, 2)} />,
              );
            }}
          >
            getEnvPath
          </Button>
        </Container.Item>

        <Container.Item
          title="Request intercept check"
          titleColor="text-critical"
        >
          <Button
            size="xs"
            onPress={async () => {
              const r = await requestsInterceptTest();

              console.log(
                'requestsInterceptTest stringify text >>>>>',
                JSON.stringify(r, null, 2),
              );
              console.log('requestsInterceptTest result >>>> ', r);

              if (r.failed.length) {
                ToastManager.show(
                  {
                    title: 'failed, please check console log',
                  },
                  {
                    type: 'error',
                  },
                );
              } else {
                ToastManager.show({
                  title: 'success',
                });
              }
            }}
          >
            Intercept Test
          </Button>
        </Container.Item>
        <Container.Item title="Monitor" titleColor="text-critical">
          <Button
            size="xs"
            onPress={() => {
              navigation.navigate(RootRoutes.Modal, {
                screen: ModalRoutes.Monitor,
                params: {
                  screen: MonitorRoutes.monitorSetting,
                },
              });
            }}
          >
            settings
          </Button>
        </Container.Item>
      </Container.Box>
    </Box>
  );
};
