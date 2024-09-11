import { Button, Stack, Toast } from '@onekeyhq/components';
import { useNotificationsAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

export function NotificationDevSettings() {
  const [, setData] = useNotificationsAtom();
  return (
    <Stack>
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
