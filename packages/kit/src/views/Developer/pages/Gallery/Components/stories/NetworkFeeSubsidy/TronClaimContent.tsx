import { useEffect, useRef, useState } from 'react';

import {
  Button,
  Icon,
  Select,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';

import {
  claimTronDemo,
  createTronClaimDemo,
  formatResourceTime,
  getTronClaimStatus,
  useTronClaimClock,
} from './tronClaimDemo';

import type { ITronClaimDemo } from './tronClaimDemo';

export function TronClaimContent({
  initialState,
  onChange,
  onSuccess,
}: {
  initialState: ITronClaimDemo;
  onChange: (state: ITronClaimDemo) => void;
  onSuccess: () => Promise<void>;
}) {
  const [state, setState] = useState(initialState);
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState<string>();
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const now = useTronClaimClock(state);
  const status = getTronClaimStatus(state, now);

  useEffect(() => () => clearTimeout(timer.current), []);

  const update = (next: ITronClaimDemo) => {
    setState(next);
    onChange(next);
  };
  const claim = () => {
    if (timer.current || !getTronClaimStatus(state, Date.now()).canClaim)
      return;
    setClaiming(true);
    setError(undefined);
    timer.current = setTimeout(() => {
      timer.current = undefined;
      setClaiming(false);
      if (state.failNextClaim) {
        update({ ...state, failNextClaim: false });
        setError('领取失败，请重试。');
        return;
      }
      const next = claimTronDemo(state, Date.now());
      if (next === state) {
        setError('领取条件已变化，请重新确认后再试。');
        return;
      }
      update(next);
      void onSuccess();
    }, 700);
  };

  return (
    <YStack gap="$6" testID="subsidy-tron-claim-sheet">
      <YStack gap="$4">
        <YStack gap="$2">
          <SizableText size="$headingSm">领取账户</SizableText>
          {state.accounts.length ? (
            <Select
              title="选择 TRON 账户"
              value={state.selectedAccountId}
              disabled={claiming}
              renderTrigger={({ onPress, disabled, label }) => (
                <Button
                  testID="subsidy-claim-account-selector"
                  accessibilityLabel={`领取账户：${label ?? '请选择账户'}`}
                  onPress={onPress}
                  disabled={disabled}
                  childrenAsText={false}
                  width="100%"
                  height="auto"
                  p="$4"
                  bg="$bgSubdued"
                  borderWidth={0}
                  borderRadius="$6"
                  borderCurve="continuous"
                  hoverStyle={{ bg: '$bgHover' }}
                  pressStyle={{ bg: '$bgActive' }}
                >
                  <XStack width="100%" alignItems="center" gap="$3">
                    <YStack
                      flex={1}
                      minWidth={0}
                      gap="$1"
                      alignItems="flex-start"
                    >
                      <SizableText size="$bodyLgMedium" textAlign="left">
                        {label ?? '请选择账户'}
                      </SizableText>
                      {status.account ? (
                        <SizableText size="$bodySm" color="$textSubdued">
                          {status.account.address}
                        </SizableText>
                      ) : null}
                    </YStack>
                    <Icon
                      name="ChevronDownSmallOutline"
                      size="$5"
                      color="$iconSubdued"
                    />
                  </XStack>
                </Button>
              )}
              items={state.accounts.map((account) => ({
                value: account.id,
                label: account.name,
                description: account.address,
              }))}
              onChange={(selectedAccountId) => {
                setError(undefined);
                update({ ...state, selectedAccountId });
              }}
            />
          ) : (
            <SizableText size="$bodyMd">暂无 TRON 账户</SizableText>
          )}
        </YStack>
        <YStack gap="$2">
          <XStack justifyContent="space-between" gap="$3">
            <SizableText
              size="$bodyMd"
              color="$textSubdued"
              flex={1}
              minWidth={0}
            >
              资源剩余
            </SizableText>
            <SizableText size="$bodyMdMedium" flexShrink={0}>
              {state.remaining} / {state.total}
            </SizableText>
          </XStack>
          {status.account ? (
            <XStack justifyContent="space-between" gap="$3">
              <SizableText
                size="$bodyMd"
                color="$textSubdued"
                flex={1}
                minWidth={0}
              >
                本地址本月剩余
              </SizableText>
              <SizableText size="$bodyMdMedium" flexShrink={0}>
                {status.account.monthRemaining} / 10 次
              </SizableText>
            </XStack>
          ) : null}
        </YStack>
      </YStack>
      <YStack gap="$2">
        <SizableText size="$headingSm">使用说明</SizableText>
        <SizableText size="$bodyMd" color="$textSubdued">
          资源领取后 10 分钟内有效，请在有效期内完成交易。每日可领取一次（GMT+8
          00:00 重置），每月最多领取 10 次。
        </SizableText>
      </YStack>
      <YStack gap="$3">
        {status.secondsLeft > 0 ? (
          <SizableText
            size="$bodyMdMedium"
            color="$textSuccess"
            testID="subsidy-tron-validity"
          >
            资源已领取，有效期剩余 {formatResourceTime(status.secondsLeft)}
          </SizableText>
        ) : null}
        {status.claimedToday && status.secondsLeft === 0 ? (
          <SizableText size="$bodyMd" color="$textSubdued">
            资源有效期已结束，今日不能重复领取。
          </SizableText>
        ) : null}
        {error || (status.reason && !status.claimedToday) ? (
          <SizableText
            size="$bodyMd"
            color={error ? '$textCritical' : '$textSubdued'}
          >
            {error ?? status.reason}
          </SizableText>
        ) : null}
        <Button
          testID="subsidy-tron-confirm-claim"
          variant="primary"
          size="large"
          loading={claiming}
          disabled={claiming || (!!status.account && !status.canClaim)}
          onPress={() => {
            if (!status.account) {
              const accounts = createTronClaimDemo().accounts.slice(0, 1);
              update({
                ...state,
                accounts,
                selectedAccountId: accounts[0].id,
              });
              return;
            }
            claim();
          }}
        >
          {!status.account ? '添加账户' : status.buttonText}
        </Button>
      </YStack>
    </YStack>
  );
}
