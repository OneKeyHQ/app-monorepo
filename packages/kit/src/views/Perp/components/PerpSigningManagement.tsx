import { useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  Dialog,
  Icon,
  IconButton,
  Input,
  SizableText,
  Toast,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useIsMounted } from '@onekeyhq/kit/src/hooks/useIsMounted';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  useHyperLiquidAgentPasswordStatusAtom,
  usePerpsActiveAccountAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import errorToastUtils from '@onekeyhq/shared/src/errors/utils/errorToastUtils';
import type { IHex } from '@onekeyhq/shared/types/hyperliquid/sdk';

import { useRequestEnableTradingWithDepositFallback } from '../hooks/useEnableTradingWithDepositFallback';
import { PerpsProviderMirror } from '../PerpsProviderMirror';
import { getTradingButtonStyleValues } from '../utils/styleUtils';

type ISigningMode = 'agent' | 'main' | 'multi';

const OPTIONS: {
  value: ISigningMode;
  label: string;
}[] = [
  {
    value: 'agent',
    label: '代理钱包',
  },
  {
    value: 'main',
    label: '主钱包',
  },
  {
    value: 'multi',
    label: '多签钱包',
  },
];

function PerpSigningManagementContent() {
  const [account] = usePerpsActiveAccountAtom();
  return (
    <PerpSigningManagementAccountContent
      key={`${account.accountId ?? ''}:${account.accountAddress ?? ''}`}
      accountId={account.accountId ?? undefined}
      accountAddress={account.accountAddress ?? undefined}
    />
  );
}

function PerpSigningManagementAccountContent({
  accountId,
  accountAddress,
}: {
  accountId?: string;
  accountAddress?: IHex;
}) {
  const intl = useIntl();
  const [passwordStatus] = useHyperLiquidAgentPasswordStatusAtom();
  const locked = passwordStatus.requiresPasswordSetupOrVerify;
  const isMounted = useIsMounted();
  const [selected, setSelected] = useState<ISigningMode>('agent');
  // Preview only: this selection never changes the trading signer.
  const [previewMode, setPreviewMode] = useState<ISigningMode | null>(null);
  const [members, setMembers] = useState([
    { id: 1, address: '' },
    { id: 2, address: '' },
  ]);
  const [multiExpanded, setMultiExpanded] = useState(false);
  const nextMemberId = useRef(3);
  const [threshold, setThreshold] = useState(2);
  const [multiStep, setMultiStep] = useState<'edit' | 'review' | 'done'>(
    'edit',
  );
  const memberAddresses = members.map((member) => member.address.trim());
  const validMembers =
    memberAddresses.every((address) => /^0x[0-9a-fA-F]{40}$/.test(address)) &&
    new Set(memberAddresses.map((address) => address.toLowerCase())).size ===
      members.length;
  const {
    result: roleResult,
    isLoading: roleLoading,
    run: refreshRole,
  } = usePromiseResult(
    async () => {
      if (selected !== 'multi' || !accountAddress) return undefined;
      try {
        const role =
          await backgroundApiProxy.serviceHyperliquid.getSigningAccountRole({
            accountAddress,
          });
        return { role, error: false };
      } catch {
        return { role: undefined, error: true };
      }
    },
    [accountAddress, selected],
    { watchLoading: true, undefinedResultIfReRun: true },
  );
  const roleLabels = {
    user: '普通账户',
    multiSig: '多签账户',
    missing: '未激活',
    agent: '代理账户',
    vault: '金库账户',
    subAccount: '子账户',
  };
  let accountRoleLabel = '—';
  if (accountAddress) {
    accountRoleLabel = '查询中…';
    if (roleResult?.error) accountRoleLabel = '查询失败';
    else if (roleResult?.role) accountRoleLabel = roleLabels[roleResult.role];
  }
  let thresholdLabel = roleResult?.role === 'user' ? '1/1' : '—';
  if (validMembers) thresholdLabel = `${threshold}/${members.length}`;
  const [creating, setCreating] = useState(false);
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);
  const requestEnableTrading = useRequestEnableTradingWithDepositFallback();
  const { result, isLoading, run } = usePromiseResult(
    async () => {
      if (!accountId || !accountAddress || locked)
        return { agent: null, error: false };
      try {
        const status =
          await backgroundApiProxy.servicePassword.refreshHyperLiquidAgentPasswordStatus();
        if (status.requiresPasswordSetupOrVerify)
          return { agent: null, error: false };
        const agent =
          await backgroundApiProxy.serviceHyperliquid.getActiveAgentInfo({
            accountId,
            accountAddress,
          });
        return { agent, error: false };
      } catch {
        return { agent: null, error: true };
      }
    },
    [accountId, accountAddress, locked],
    {
      watchLoading: true,
      undefinedResultIfReRun: true,
    },
  );
  const agent = locked ? null : result?.agent;
  const hasAccount = Boolean(accountId && accountAddress);
  const expired = Boolean(agent && agent.validUntil <= Date.now());
  let enableDisabled = Boolean(
    locked || !hasAccount || agent || pending || isLoading || !result,
  );
  if (selected === 'multi') {
    enableDisabled =
      pending ||
      !hasAccount ||
      (multiExpanded && !validMembers) ||
      (multiStep === 'done' && previewMode === 'multi');
  } else if (selected !== 'agent' || previewMode !== null) {
    enableDisabled = pending || !hasAccount || selected === previewMode;
  }
  const buttonStyles = getTradingButtonStyleValues('long');

  const refreshAgent = async () => {
    await run();
  };

  const handleUnlock = async () => {
    if (!hasAccount || pendingRef.current) return;
    pendingRef.current = true;
    setPending(true);
    try {
      await errorToastUtils.withErrorAutoToast(async () => {
        await backgroundApiProxy.servicePassword.promptHyperLiquidAgentPasswordSetupOrVerify();
        await backgroundApiProxy.servicePassword.ensureHyperLiquidAgentPasswordSessionReady();
      });
      if (isMounted.current) await refreshAgent();
    } catch {
      // Cancellation keeps the information hidden; other errors are toasted.
    } finally {
      pendingRef.current = false;
      if (isMounted.current) setPending(false);
    }
  };

  const handleCreate = async () => {
    if (!agent || !accountId || !accountAddress || pendingRef.current) return;
    pendingRef.current = true;
    setPending(true);
    try {
      await backgroundApiProxy.serviceHyperliquid.rotateActiveAgent({
        accountId,
        accountAddress,
        agentName: agent.agentName,
        agentAddress: agent.agentAddress,
      });
      if (isMounted.current) {
        setCreating(false);
        Toast.success({ title: '代理钱包已换新' });
      }
    } catch {
      // The background method displays signing and authorization errors.
    } finally {
      pendingRef.current = false;
      if (isMounted.current) {
        setPending(false);
        await refreshAgent();
      }
    }
  };

  if (creating && agent) {
    return (
      <YStack gap="$5">
        <YStack gap="$2">
          <SizableText size="$headingMd">更换代理钱包</SizableText>
          <SizableText color="$textSubdued">
            使用主钱包签名授权新的代理钱包。授权成功后，当前代理将失效，并使用新代理继续交易。
          </SizableText>
          <SizableText size="$bodySm" color="$textSubdued">
            取消签名不会替换当前代理，也不会影响其他客户端的代理钱包。
          </SizableText>
        </YStack>
        <XStack gap="$3">
          <Button
            testID="perp-signing-create-cancel"
            flex={1}
            disabled={pending}
            onPress={() => setCreating(false)}
          >
            取消
          </Button>
          <Button
            testID="perp-signing-create-confirm"
            flex={1}
            variant="primary"
            loading={pending}
            disabled={pending}
            onPress={handleCreate}
          >
            授权并更换
          </Button>
        </XStack>
      </YStack>
    );
  }

  let enableLabel = selected === 'main' ? '切换为主钱包签名' : '切换为多签';
  if (selected === 'agent' && previewMode === null) {
    enableLabel = '启用交易';
    if (agent && !expired) enableLabel = '已启用';
    if (expired) enableLabel = '代理已过期，请换新';
    if (!hasAccount) enableLabel = '请先选择钱包';
    if (isLoading || !result) enableLabel = '加载中…';
    if (result?.error) enableLabel = '重新加载';
    if (locked) enableLabel = '请先解锁查看';
  } else {
    if (selected === 'agent') enableLabel = '切换为代理钱包签名';
    if (selected === previewMode) enableLabel = '已启用';
    if (!hasAccount) enableLabel = '请先选择钱包';
  }
  if (selected === 'multi' && hasAccount) {
    if (!multiExpanded && !validMembers) enableLabel = '配置多签';
    else if (multiStep === 'edit') enableLabel = '下一步';
    else if (multiStep === 'review') enableLabel = '确认启用多签';
    else enableLabel = previewMode === 'multi' ? '已启用' : '切换为多签';
  }
  const multiTitles = {
    edit: '配置多签',
    review: '确认多签配置',
    done: '多签账户',
  };
  const multiProgress = {
    edit: '1 / 2',
    review: '2 / 2',
    done: `${threshold} / ${members.length} 签名`,
  };

  return (
    <YStack gap="$6">
      <XStack gap="$2" role="tablist" aria-label="签名方式">
        {OPTIONS.map((option) => {
          const isSelected = selected === option.value;
          return (
            <YStack
              key={option.value}
              testID={`perp-signing-mode-${option.value}`}
              role="tab"
              accessibilityRole="tab"
              accessibilityLabel={option.label}
              accessibilityState={{ selected: isSelected }}
              aria-selected={isSelected}
              accessible
              focusable
              flex={1}
              minWidth={0}
              px="$3"
              minHeight="$11"
              py="$2"
              alignItems="center"
              justifyContent="center"
              borderWidth="$px"
              borderRadius="$3"
              borderColor={isSelected ? '$borderActive' : '$borderSubdued'}
              hoverStyle={{
                borderColor: isSelected ? '$borderActive' : '$borderStrong',
              }}
              pressStyle={{ borderColor: '$borderActive' }}
              onPress={() => setSelected(option.value)}
            >
              <SizableText size="$bodySmMedium">{option.label}</SizableText>
            </YStack>
          );
        })}
      </XStack>

      <YStack gap="$4">
        {selected === 'agent' ? (
          <>
            <SizableText size="$bodySm" color="$textSubdued">
              授权代理钱包在有效期内代为签署交易，无需主钱包逐笔签名。授权到期后需重新授权。
            </SizableText>
            <YStack p="$4" gap="$3" borderRadius="$3" bg="$bgSubdued">
              <XStack
                justifyContent="space-between"
                alignItems="center"
                gap="$3"
              >
                <SizableText size="$bodySm" color="$textSubdued" flexShrink={0}>
                  代理钱包
                </SizableText>
                <XStack
                  gap="$2"
                  alignItems="center"
                  justifyContent="flex-end"
                  flexWrap="wrap"
                  flex={1}
                  minWidth={0}
                >
                  <SizableText size="$bodySmMedium">
                    {agent
                      ? `${agent.agentAddress.slice(0, 8)}…${agent.agentAddress.slice(-6)}`
                      : '—'}
                  </SizableText>
                  <SizableText
                    testID="perp-signing-agent-action"
                    size="$bodySmMedium"
                    color={
                      hasAccount && !pending && !isLoading
                        ? '$textInfo'
                        : '$textDisabled'
                    }
                    textDecorationLine="underline"
                    accessibilityRole="button"
                    accessibilityState={{
                      disabled: !hasAccount || pending || Boolean(isLoading),
                    }}
                    onPress={async () => {
                      if (!hasAccount || pending || isLoading) return;
                      if (agent) {
                        setCreating(true);
                      } else {
                        await handleUnlock();
                      }
                    }}
                  >
                    {agent ? '更换' : '解锁查看'}
                  </SizableText>
                </XStack>
              </XStack>
              <XStack justifyContent="space-between" gap="$2">
                <SizableText size="$bodySm" color="$textSubdued">
                  有效期至
                </SizableText>
                <SizableText size="$bodySmMedium">
                  {agent
                    ? intl.formatDate(agent.validUntil, {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : '—'}
                </SizableText>
              </XStack>
              <XStack gap="$2" alignItems="center" mt="$2">
                <Icon name="LockOutline" size="$4" color="$iconSubdued" />
                <SizableText size="$bodySm" color="$textSubdued" flex={1}>
                  代理钱包私钥已加密保存在本设备。
                </SizableText>
              </XStack>
            </YStack>
          </>
        ) : (
          <>
            <SizableText size="$bodySm" color="$textSubdued">
              {selected === 'main'
                ? '使用主钱包签署交易，下单、撤单等操作均需手动确认。使用硬件钱包时，每次签名需连接设备并在设备上确认。'
                : '将当前账户设为 Hyperliquid 多签账户，由授权成员共同管理，达到签名门槛后执行操作。'}
            </SizableText>
            <YStack p="$4" gap="$2" borderRadius="$3" bg="$bgSubdued">
              {selected === 'main' ? (
                <XStack
                  alignItems="center"
                  justifyContent="space-between"
                  gap="$3"
                >
                  <SizableText
                    size="$bodySm"
                    color="$textSubdued"
                    flexShrink={0}
                  >
                    主钱包
                  </SizableText>
                  <SizableText size="$bodySmMedium">
                    {accountAddress
                      ? `${accountAddress.slice(0, 8)}…${accountAddress.slice(-6)}`
                      : '—'}
                  </SizableText>
                </XStack>
              ) : (
                <>
                  {!multiExpanded ? (
                    <YStack gap="$3">
                      <XStack
                        justifyContent="space-between"
                        alignItems="center"
                        gap="$2"
                      >
                        <SizableText size="$bodySm" color="$textSubdued">
                          主钱包状态
                        </SizableText>
                        <XStack gap="$2" alignItems="center">
                          <SizableText size="$bodySmMedium">
                            {accountRoleLabel}
                          </SizableText>
                          {roleResult?.error ? (
                            <SizableText
                              size="$bodySmMedium"
                              color="$textInfo"
                              textDecorationLine="underline"
                              accessibilityRole="button"
                              onPress={() => {
                                if (!roleLoading) void refreshRole();
                              }}
                            >
                              重试
                            </SizableText>
                          ) : null}
                        </XStack>
                      </XStack>
                      <XStack
                        justifyContent="space-between"
                        alignItems="center"
                        gap="$2"
                      >
                        <SizableText size="$bodySm" color="$textSubdued">
                          签名门槛
                        </SizableText>
                        <SizableText size="$bodySmMedium">
                          {thresholdLabel}
                        </SizableText>
                      </XStack>
                      <XStack
                        justifyContent="space-between"
                        alignItems="center"
                        gap="$2"
                      >
                        <SizableText size="$bodySm" color="$textSubdued">
                          授权成员
                        </SizableText>
                        <XStack alignItems="center" gap="$2">
                          <SizableText size="$bodySmMedium">
                            {validMembers
                              ? `${members.length} 名成员`
                              : '未配置'}
                          </SizableText>
                          <SizableText
                            testID="perp-multi-configure"
                            size="$bodySmMedium"
                            color="$textInfo"
                            textDecorationLine="underline"
                            accessibilityRole="button"
                            onPress={() => {
                              setMultiStep(
                                previewMode === 'multi' ? 'done' : 'edit',
                              );
                              setMultiExpanded(true);
                            }}
                          >
                            {previewMode === 'multi' ? '查看' : '配置'}
                          </SizableText>
                        </XStack>
                      </XStack>
                    </YStack>
                  ) : null}
                  {multiExpanded ? (
                    <YStack gap="$4">
                      <XStack
                        justifyContent="space-between"
                        alignItems="center"
                      >
                        <SizableText size="$bodySmMedium">
                          {multiTitles[multiStep]}
                        </SizableText>
                        <SizableText size="$bodySm" color="$textSubdued">
                          {multiProgress[multiStep]}
                        </SizableText>
                      </XStack>
                      <XStack justifyContent="space-between" gap="$2">
                        <SizableText size="$bodySm" color="$textSubdued">
                          账户地址
                        </SizableText>
                        <SizableText size="$bodySmMedium">
                          {accountAddress
                            ? `${accountAddress.slice(0, 8)}…${accountAddress.slice(-6)}`
                            : '—'}
                        </SizableText>
                      </XStack>
                      {multiStep === 'edit' ? (
                        <>
                          <YStack gap="$2">
                            <XStack
                              alignItems="center"
                              justifyContent="space-between"
                            >
                              <SizableText size="$bodySmMedium">
                                授权成员
                              </SizableText>
                              <SizableText
                                testID="perp-multi-add"
                                size="$bodySmMedium"
                                color={
                                  members.length >= 10
                                    ? '$textDisabled'
                                    : '$textInfo'
                                }
                                textDecorationLine="underline"
                                accessibilityRole="button"
                                accessibilityState={{
                                  disabled: members.length >= 10,
                                }}
                                onPress={() => {
                                  if (members.length >= 10) return;
                                  const id = nextMemberId.current;
                                  nextMemberId.current += 1;
                                  setMembers((previous) => [
                                    ...previous,
                                    { id, address: '' },
                                  ]);
                                }}
                              >
                                添加成员
                              </SizableText>
                            </XStack>
                            {members.map((member, index) => {
                              const address = member.address.trim();
                              const invalid =
                                Boolean(address) &&
                                !/^0x[0-9a-fA-F]{40}$/.test(address);
                              const duplicate =
                                Boolean(address) &&
                                memberAddresses.some(
                                  (other, otherIndex) =>
                                    otherIndex !== index &&
                                    other.toLowerCase() ===
                                      address.toLowerCase(),
                                );
                              return (
                                <YStack key={member.id} gap="$1">
                                  <XStack gap="$2" alignItems="center">
                                    <Input
                                      testID={`perp-multi-member-${member.id}`}
                                      size="medium"
                                      containerProps={{ flex: 1, minWidth: 0 }}
                                      error={invalid || duplicate}
                                      value={member.address}
                                      placeholder={`成员 ${index + 1} 地址（0x…）`}
                                      autoCapitalize="none"
                                      autoCorrect={false}
                                      onChangeText={(value) =>
                                        setMembers((previous) =>
                                          previous.map((item) =>
                                            item.id === member.id
                                              ? { ...item, address: value }
                                              : item,
                                          ),
                                        )
                                      }
                                    />
                                    <IconButton
                                      size="small"
                                      icon="CrossedSmallOutline"
                                      accessibilityLabel={`移除成员 ${index + 1}`}
                                      flexShrink={0}
                                      variant="tertiary"
                                      testID={`perp-multi-remove-${member.id}`}
                                      disabled={members.length <= 1}
                                      onPress={() => {
                                        setMembers((previous) =>
                                          previous.filter(
                                            (item) => item.id !== member.id,
                                          ),
                                        );
                                        setThreshold((previous) =>
                                          Math.min(
                                            previous,
                                            members.length - 1,
                                          ),
                                        );
                                      }}
                                    />
                                  </XStack>
                                  {invalid || duplicate ? (
                                    <SizableText
                                      size="$bodySm"
                                      color="$textCritical"
                                    >
                                      {invalid
                                        ? '请输入有效的 EVM 地址'
                                        : '成员地址不能重复'}
                                    </SizableText>
                                  ) : null}
                                </YStack>
                              );
                            })}

                            <SizableText size="$bodySm" color="$textSubdued">
                              最多 10 名成员，须为已有的 Hyperliquid 用户。
                            </SizableText>
                          </YStack>
                          <XStack
                            alignItems="center"
                            justifyContent="space-between"
                            gap="$2"
                          >
                            <SizableText size="$bodySmMedium">
                              签名门槛
                            </SizableText>
                            <XStack alignItems="center" gap="$3">
                              <Button
                                size="small"
                                testID="perp-multi-threshold-decrease"
                                disabled={threshold <= 1}
                                onPress={() =>
                                  setThreshold((previous) => previous - 1)
                                }
                              >
                                −
                              </Button>
                              <SizableText size="$bodySmMedium">
                                {threshold} / {members.length}
                              </SizableText>
                              <Button
                                size="small"
                                testID="perp-multi-threshold-increase"
                                disabled={threshold >= members.length}
                                onPress={() =>
                                  setThreshold((previous) => previous + 1)
                                }
                              >
                                +
                              </Button>
                            </XStack>
                          </XStack>
                        </>
                      ) : (
                        <>
                          <YStack gap="$2">
                            {members.map((member, index) => (
                              <XStack
                                key={member.id}
                                justifyContent="space-between"
                                gap="$2"
                              >
                                <SizableText
                                  size="$bodySm"
                                  color="$textSubdued"
                                >
                                  成员 {index + 1}
                                </SizableText>
                                <SizableText size="$bodySmMedium">
                                  {member.address.trim().slice(0, 8)}…
                                  {member.address.trim().slice(-6)}
                                </SizableText>
                              </XStack>
                            ))}
                          </YStack>
                          <SizableText size="$bodySm" color="$textSubdued">
                            每次操作需 {members.length} 名成员中的 {threshold}{' '}
                            名签署。
                          </SizableText>
                          {multiStep === 'review' ? (
                            <>
                              <SizableText size="$bodySm" color="$textSubdued">
                                启用后，修改成员、门槛或恢复普通账户也需要多签授权。
                              </SizableText>
                              <Button
                                size="small"
                                variant="tertiary"
                                testID="perp-multi-edit"
                                onPress={() => setMultiStep('edit')}
                              >
                                返回修改
                              </Button>
                            </>
                          ) : null}
                        </>
                      )}
                      <SizableText size="$bodySm" color="$textSubdued">
                        交互预览，不提交真实授权。
                      </SizableText>
                    </YStack>
                  ) : null}
                </>
              )}
            </YStack>
          </>
        )}
      </YStack>

      <YStack gap="$3">
        <Button
          testID="perp-signing-enable"
          size="large"
          variant="primary"
          color={buttonStyles.textColor}
          bg={buttonStyles.bg}
          hoverStyle={
            !enableDisabled ? { bg: buttonStyles.hoverBg } : undefined
          }
          pressStyle={
            !enableDisabled ? { bg: buttonStyles.pressBg } : undefined
          }
          disabled={enableDisabled}
          disabledStyle={
            pending ? { opacity: 1, bg: buttonStyles.bg } : undefined
          }
          opacity={pending ? 1 : undefined}
          loading={pending}
          onPress={async () => {
            if (pendingRef.current) return;
            if (selected === 'multi') {
              if (!hasAccount) return;
              if (!multiExpanded) {
                setMultiStep(validMembers ? 'review' : 'edit');
                setMultiExpanded(true);
                return;
              }
              if (!validMembers) return;
              if (multiStep === 'edit') {
                setMultiStep('review');
              } else {
                setMultiStep('done');
                setMultiExpanded(false);
                setPreviewMode('multi');
              }
              return;
            }
            if (selected !== 'agent' || previewMode !== null) {
              setPreviewMode(selected);
              return;
            }
            if (result?.error) {
              await refreshAgent();
              return;
            }
            pendingRef.current = true;
            setPending(true);
            try {
              await requestEnableTrading();
            } finally {
              pendingRef.current = false;
              if (isMounted.current) {
                setPending(false);
                await refreshAgent();
              }
            }
          }}
        >
          {enableLabel}
        </Button>
      </YStack>
    </YStack>
  );
}

export function showPerpSigningManagementDialog() {
  return Dialog.show({
    title: '交易签名管理',
    showFooter: false,
    floatingPanelProps: { width: 600, maxWidth: '100%' },
    renderContent: (
      <PerpsProviderMirror>
        <PerpSigningManagementContent />
      </PerpsProviderMirror>
    ),
  });
}
