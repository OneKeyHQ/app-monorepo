import type { IPageScreenProps } from '@onekeyhq/components';
import {
  Badge,
  Heading,
  Icon,
  Markdown,
  Page,
  ScrollView,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type {
  EAppUpdateRoutes,
  IAppUpdatePagesParamList,
} from '@onekeyhq/shared/src/routes';

import { UpdatePreviewActionButton } from '../components/UpdatePreviewActionButton';

const ExtPluginText = platformEnv.isExtension ? (
  <SizableText size="$bodyMd" color="$textSubdued">
    To ensure you get the best experience, we recommend that you regularly check
    for and manually update the plugin.
  </SizableText>
) : null;

function UpdatePreview({
  route,
}: IPageScreenProps<IAppUpdatePagesParamList, EAppUpdateRoutes.UpdatePreview>) {
  const { version, latestVersion, changeLog } = route.params || {};
  return (
    <Page>
      <Page.Header title="App Update" />
      <Page.Body p="$5">
        <YStack space="$3">
          <Heading size="$heading2xl">New App Version 🎉</Heading>
          {ExtPluginText}
          <XStack space="$2.5" alignItems="center">
            <Badge badgeType="default" badgeSize="lg">
              {version}
            </Badge>
            <Icon name="ArrowRightSolid" size="$4" />
            <Badge badgeType="info" badgeSize="lg">
              {latestVersion}
            </Badge>
          </XStack>
        </YStack>
        <ScrollView pt="$7" contentInsetAdjustmentBehavior="automatic">
          <Markdown>
            {`### ✨ 新功能\r\n- 优化输入的交互体验，支持长按快捷输入 PIN 码和
            Passphrase\r\n- 新增设置项，允许修改上下键的输入方向\r\n\r\n### 🐞 问题修复\r\n- 修复某些场景下设备自动锁定失效的问题\r\n- 修复
            Arbitrum 代币转账时信息展示问题\r\n- 修复核对 Electrum 多签地址 xPub
            展示问题\r\n- 修复 PIN 码输入错误时无法连接 OneKey Wallet
            的问题\r\n- 修复 Fetch.ai 链转账的金额显示问题\r\n- 修复 U2F
            Register 等待时间过长的问题\r\n- 取消 BTC 派生路径地址 index
            索引的限制\r\n- 修复本地化翻译问题\r\n- evm 主币转账时，touch
            显示的金额单位与热钱包保持一致\r\n\r\n### 💎 改进\r\n- 核对 Cardano
            (ADA) 收款地址时，展示地址类型\r\n- 优化 EVM 链交易签名流程\r\n`}
          </Markdown>
        </ScrollView>
      </Page.Body>
      <UpdatePreviewActionButton />
    </Page>
  );
}

export default UpdatePreview;
