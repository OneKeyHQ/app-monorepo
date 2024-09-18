import type { PropsWithChildren, ReactElement } from 'react';
import { Children, cloneElement, useCallback } from 'react';

import type { IPropsWithTestId } from '@onekeyhq/components';
import {
  Button,
  ESwitchSize,
  Stack,
  Switch,
  Toast,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IListItemProps } from '@onekeyhq/kit/src/components/ListItem';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import type { INotificationsDevSettingsKeys } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  useNotificationsAtom,
  useNotificationsDevSettingsPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';

interface INotificationSectionFieldItem extends PropsWithChildren {
  name?: INotificationsDevSettingsKeys;
  title: IListItemProps['title'];
  titleProps?: IListItemProps['titleProps'];
  onValueChange?: (v: any) => void;
}

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
        ...child.props,
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
    </Stack>
  );
}
