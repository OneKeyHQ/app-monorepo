import { useRef, useState } from 'react';

import {
  Button,
  Dialog,
  Input,
  ScrollView,
  SizableText,
  XStack,
  YStack,
  useClipboard,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import type { IAlphHardwareInputTestResult } from '@onekeyhq/kit-bg/src/services/ServiceDevSetting/alphHardwareInputTest';
import { presetNetworksMap } from '@onekeyhq/shared/src/config/presetNetworks';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { stableStringify } from '@onekeyhq/shared/src/utils/stringUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

function AlphHardwareInputTest() {
  const {
    activeAccount: { account, network, wallet },
  } = useActiveAccount({ num: 0 });
  const [inputCount, setInputCount] = useState('17');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<IAlphHardwareInputTestResult>();
  const running = useRef(false);
  const { copyText } = useClipboard();
  const hasAccount =
    !!account?.id &&
    network?.id === presetNetworksMap.alph.id &&
    accountUtils.isHwWallet({ walletId: wallet?.id });
  const count = Number(inputCount);
  const validCount = Number.isInteger(count) && count >= 1 && count <= 256;

  return (
    <YStack gap="$3">
      <SizableText size="$bodyMd">
        先在首页选择 OneKey 硬件钱包的 ALPH 账户。使用合成 UTXO
        构造自转交易，真实调用硬件签名；不广播，不需要余额。
      </SizableText>
      <SizableText size="$bodySm" testID="alph-input-test-account">
        {hasAccount
          ? `${wallet?.name ?? ''} · ${account?.address ?? ''}`
          : '当前未选择 ALPH 硬件账户，请先回首页选择。'}
      </SizableText>
      <XStack gap="$2" flexWrap="wrap">
        {[1, 16, 17, 32, 64].map((value) => (
          <Button
            key={value}
            size="small"
            variant={count === value ? 'primary' : 'secondary'}
            disabled={loading}
            testID={`alph-input-test-preset-${value}`}
            onPress={() => setInputCount(String(value))}
          >
            {value} inputs
          </Button>
        ))}
      </XStack>
      <Input
        testID="alph-input-test-count"
        value={inputCount}
        onChangeText={setInputCount}
        keyboardType="number-pad"
        editable={!loading}
        placeholder="输入数量（1–256，仅为测试数据范围）"
      />
      <Button
        testID="alph-input-test-sign"
        loading={loading}
        disabled={!hasAccount || !validCount || loading}
        onPress={async () => {
          if (!account?.id || running.current) return;
          running.current = true;
          setLoading(true);
          setResult(undefined);
          try {
            const response =
              await backgroundApiProxy.serviceDevSetting.testAlphHardwareInputs(
                {
                  accountId: account.id,
                  inputCount: count,
                },
              );
            setResult(response);
          } finally {
            running.current = false;
            setLoading(false);
          }
        }}
      >
        发送到硬件签名（不广播）
      </Button>
      {result ? (
        <YStack gap="$2">
          <SizableText size="$bodyMd" testID="alph-input-test-status">
            {result.success
              ? `硬件已接受 ${result.inputCount} 个输入并完成签名。签名已丢弃。`
              : `测试失败，阶段：${result.stage}`}
          </SizableText>
          <SizableText size="$bodySm">
            sdkError 为 SDK 原始返回；appError 为现有 App 错误转换结果。
          </SizableText>
          {result.appError?.message ? (
            <SizableText size="$bodyMd" color="$textCritical" selectable>
              {result.appError.message}
            </SizableText>
          ) : null}
          <ScrollView maxHeight={220}>
            <SizableText
              size="$bodySm"
              selectable
              testID="alph-input-test-result"
            >
              {stableStringify(result, null, 2)}
            </SizableText>
          </ScrollView>
          <Button
            size="small"
            testID="alph-input-test-copy"
            onPress={() => copyText(stableStringify(result, null, 2))}
          >
            复制测试结果
          </Button>
        </YStack>
      ) : null}
    </YStack>
  );
}

export function showAlphHardwareInputTestDialog() {
  Dialog.cancel({
    title: 'ALPH UTXO 硬件实测',
    renderContent: (
      <AccountSelectorProviderMirror
        config={{ sceneName: EAccountSelectorSceneName.home }}
        enabledNum={[0]}
      >
        <AlphHardwareInputTest />
      </AccountSelectorProviderMirror>
    ),
  });
}
