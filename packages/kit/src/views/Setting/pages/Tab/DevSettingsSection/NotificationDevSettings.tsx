import type { PropsWithChildren, ReactElement } from 'react';
import {
  Children,
  cloneElement,
  useCallback,
  useEffect,
  useState,
} from 'react';

import type { IPropsWithTestId } from '@onekeyhq/components';
import {
  Button,
  ESwitchSize,
  Select,
  SizableText,
  Stack,
  Switch,
  Toast,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IListItemProps } from '@onekeyhq/kit/src/components/ListItem';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import type { INotificationsDevSettingsKeys } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  useNotificationsAtom,
  useNotificationsDevSettingsPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { INotificationPermissionRecoveryResult } from '@onekeyhq/shared/types/notification';
import {
  ENotificationPermissionRecoverySource,
  ENotificationPermissionRecoveryTestScenario,
} from '@onekeyhq/shared/types/notification';

interface INotificationSectionFieldItem extends PropsWithChildren {
  name?: INotificationsDevSettingsKeys;
  title: IListItemProps['title'];
  titleProps?: IListItemProps['titleProps'];
  onValueChange?: (v: any) => void;
}

const permissionRecoveryScenarioOptions = [
  {
    label: 'Real system',
    value: ENotificationPermissionRecoveryTestScenario.real,
  },
  {
    label: 'Push ON + Granted',
    value: ENotificationPermissionRecoveryTestScenario.pushOnGranted,
  },
  {
    label: 'Push ON + Default',
    value: ENotificationPermissionRecoveryTestScenario.pushOnDefault,
  },
  {
    label: 'Push ON + Denied',
    value: ENotificationPermissionRecoveryTestScenario.pushOnDenied,
  },
  {
    label: 'Push OFF',
    value: ENotificationPermissionRecoveryTestScenario.pushOff,
  },
  {
    label: 'Unsupported',
    value: ENotificationPermissionRecoveryTestScenario.unsupported,
  },
  {
    label: 'Permission query failed',
    value: ENotificationPermissionRecoveryTestScenario.queryFailed,
  },
];

function NotificationSectionFieldItem({
  name,
  title,
  titleProps = { color: '$textCritical' },
  children,
  onValueChange,
  testID = '',
}: IPropsWithTestId<INotificationSectionFieldItem>) {
  const [devSetting, setDevSetting] = useNotificationsDevSettingsPersistAtom();
  const child = Children.only(children) as ReactElement;
  const value = name ? devSetting?.[name] : '';
  const handleChange = useCallback(
    async (v: any) => {
      if (name) {
        setDevSetting((o) => ({ ...o, [name]: v }));
        onValueChange?.(v);
      }
    },
    [name, onValueChange, setDevSetting],
  );
  const field = child
    ? cloneElement(child, {
        ...(child.props as any),
        value,
        onChange: handleChange,
      })
    : null;
  return (
    <ListItem title={title} titleProps={titleProps} testID={testID}>
      {field}
    </ListItem>
  );
}

export function NotificationDevSettings() {
  const [, setData] = useNotificationsAtom();
  const [permissionRecoveryScenario, setPermissionRecoveryScenario] = useState(
    ENotificationPermissionRecoveryTestScenario.real,
  );
  const [permissionRecoveryResult, setPermissionRecoveryResult] =
    useState<INotificationPermissionRecoveryResult>();

  useEffect(() => {
    if (!platformEnv.isNative) {
      return;
    }
    void backgroundApiProxy.serviceNotification
      .getNotificationPermissionRecoveryTestScenario()
      .then(setPermissionRecoveryScenario)
      .catch(() => undefined);
  }, []);

  const runPermissionRecoveryCheck = useCallback(async () => {
    const result =
      await backgroundApiProxy.serviceNotification.checkNotificationPermissionRecovery(
        {
          ignoreCooldown: true,
          source: ENotificationPermissionRecoverySource.qaManual,
        },
      );
    setPermissionRecoveryResult(result);
    return result;
  }, []);

  const handlePermissionRecoveryScenarioChange = useCallback(
    async (scenario: ENotificationPermissionRecoveryTestScenario) => {
      try {
        await backgroundApiProxy.serviceNotification.setNotificationPermissionRecoveryTestScenario(
          scenario,
        );
        await backgroundApiProxy.serviceNotification.resetNotificationPermissionRecoveryState();
        setPermissionRecoveryScenario(scenario);
        const result = await runPermissionRecoveryCheck();
        Toast.success({
          title: 'Permission recovery scenario applied',
          message: `${result.reason}: shouldShow=${String(result.shouldShow)}`,
        });
      } catch (error) {
        Toast.error({
          title: 'Failed to apply permission recovery scenario',
          message: String(error),
        });
      }
    },
    [runPermissionRecoveryCheck],
  );

  const handleResetPermissionRecovery = useCallback(async () => {
    try {
      await backgroundApiProxy.serviceNotification.setNotificationPermissionRecoveryTestScenario(
        ENotificationPermissionRecoveryTestScenario.real,
      );
      await backgroundApiProxy.serviceNotification.resetNotificationPermissionRecoveryState();
      setPermissionRecoveryScenario(
        ENotificationPermissionRecoveryTestScenario.real,
      );
      setPermissionRecoveryResult(undefined);
      Toast.success({ title: 'Permission recovery state reset' });
    } catch (error) {
      Toast.error({
        title: 'Failed to reset permission recovery state',
        message: String(error),
      });
    }
  }, []);

  return (
    <Stack>
      <NotificationSectionFieldItem
        name="showMessagePushSource"
        title="显示消息推送来源"
      >
        <Switch size={ESwitchSize.small} />
      </NotificationSectionFieldItem>

      <NotificationSectionFieldItem
        name="disabledWebSocket"
        title="禁用 WebSocket (重启生效）"
      >
        <Switch size={ESwitchSize.small} />
      </NotificationSectionFieldItem>

      <NotificationSectionFieldItem
        name="disabledJPush"
        title="禁用 JPush (重启生效）"
      >
        <Switch size={ESwitchSize.small} />
      </NotificationSectionFieldItem>

      <Button
        onPress={async () => {
          const res =
            await backgroundApiProxy.serviceNotification.pingWebSocket({
              count: 1,
              date: new Date().toISOString(),
            });
          console.log('res', res);
          Toast.success({
            title: 'Ping Success',
            message: JSON.stringify(res),
          });
        }}
      >
        WebSocket Ping
      </Button>

      <Button
        onPress={() => {
          setData((v) => ({
            ...v,
            firstTimeGuideOpened: false,
          }));
          Toast.success({
            title: '重置成功',
            message:
              '首页消息中心入口，点击后将提示权限引导，而不是进入消息列表',
          });
        }}
      >
        重置首次通知权限引导提醒
      </Button>

      <Button
        onPress={() => {
          setData((v) => ({
            ...v,
            lastRegisterTime: undefined,
          }));
          Toast.success({
            title: '重置成功',
            message: '进入首页将再次发起 register 请求',
          });
        }}
      >
        重置每日同步账户时间戳
      </Button>

      {platformEnv.isNative ? (
        <YStack gap="$3" py="$4">
          <SizableText size="$headingSm">
            Notification Permission Recovery QA
          </SizableText>
          <SizableText size="$bodySm" color="$textSubdued">
            Apply a scenario, return to Home, and wait 6 seconds. Test mode
            never opens system settings or registers a real push client.
          </SizableText>
          <Select
            testID="notification-permission-recovery-scenario"
            title="Permission Recovery Scenario"
            items={permissionRecoveryScenarioOptions}
            value={permissionRecoveryScenario}
            onChange={(value) => {
              void handlePermissionRecoveryScenarioChange(value);
            }}
          />
          <Button
            testID="notification-permission-recovery-check-now"
            onPress={() => {
              void runPermissionRecoveryCheck().catch((error) => {
                Toast.error({
                  title: 'Permission recovery check failed',
                  message: String(error),
                });
              });
            }}
          >
            Run Recovery Check Now
          </Button>
          <Button
            testID="notification-permission-recovery-reset"
            variant="secondary"
            onPress={() => {
              void handleResetPermissionRecovery();
            }}
          >
            Restore Real System and Reset State
          </Button>
          {permissionRecoveryResult ? (
            <SizableText
              testID="notification-permission-recovery-result"
              size="$bodySm"
              color="$textSubdued"
            >
              {JSON.stringify(permissionRecoveryResult, null, 2)}
            </SizableText>
          ) : null}
        </YStack>
      ) : null}
    </Stack>
  );
}
