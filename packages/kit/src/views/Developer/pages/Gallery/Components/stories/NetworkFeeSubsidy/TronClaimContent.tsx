import { useEffect, useRef, useState } from 'react';

import {
  Button,
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
}: {
  initialState: ITronClaimDemo;
  onChange: (state: ITronClaimDemo) => void;
}) {
  const [state, setState] = useState(initialState);
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState<string>();
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const now = useTronClaimClock();
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
      update(claimTronDemo(state, Date.now()));
    }, 700);
  };

  return (
    <YStack gap="$5" testID="subsidy-tron-claim-sheet">
      <YStack gap="$2">
        <SizableText size="$bodySm" color="$textSubdued">
          领取账户
        </SizableText>
        {state.accounts.length ? (
          <Select
            title="选择 TRON 账户"
            value={state.selectedAccountId}
            disabled={claiming}
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
        {status.account ? (
          <SizableText size="$bodySm" color="$textSubdued">
            {status.account.address}
          </SizableText>
        ) : null}
      </YStack>
      <YStack
        bg="$bgSubdued"
        borderRadius="$6"
        borderCurve="continuous"
        p="$4"
        gap="$3"
      >
        <XStack justifyContent="space-between" gap="$3">
          <SizableText size="$bodyMd" color="$textSubdued">
            资源剩余
          </SizableText>
          <SizableText size="$bodyMdMedium">
            {state.remaining} / {state.total}
          </SizableText>
        </XStack>
        {status.account ? (
          <XStack justifyContent="space-between" gap="$3">
            <SizableText size="$bodyMd" color="$textSubdued">
              本地址本月剩余
            </SizableText>
            <SizableText size="$bodyMdMedium">
              {status.account.monthRemaining} / 10 次
            </SizableText>
          </XStack>
        ) : null}
      </YStack>
      <SizableText size="$bodyMd" color="$textSubdued">
        资源领取后 10 分钟内有效，请在有效期内完成交易。每 24
        小时可领一次（GMT+8 重置），每月最多领取 10 次。
      </SizableText>
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
            update({
              ...state,
              accounts: createTronClaimDemo().accounts.slice(0, 1),
            });
            return;
          }
          claim();
        }}
      >
        {!status.account ? '添加账户' : status.buttonText}
      </Button>
    </YStack>
  );
}
