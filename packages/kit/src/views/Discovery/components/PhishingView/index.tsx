import { useMemo } from 'react';

import { Button, Icon, Text, XStack, YStack } from '@onekeyhq/components';

function PhishingView() {
  const content = useMemo(
    () => (
      <YStack flex={1} bg="red">
        <XStack>
          <Icon name="BucketOutline" width={48} height={48} />
          <Text>欺骗性网站警告</Text>
        </XStack>
        <Text>
          此网站可能尝试诱骗你进行危险操作，如安装软件或泄漏个人或财务信息，如密码、电话号码或信用卡。
        </Text>
        <XStack>
          <Button>显示详细信息</Button>
          <Button>返回</Button>
        </XStack>
      </YStack>
    ),
    [],
  );
  return content;
}

export default PhishingView;
