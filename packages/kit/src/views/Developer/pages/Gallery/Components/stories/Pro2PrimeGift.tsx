import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { EDeviceType } from '@onekeyfe/hd-shared';
import { IntlProvider } from 'react-intl';

import type { IDialogInstance, IKeyOfIcons } from '@onekeyhq/components';
import {
  Alert,
  Badge,
  Button,
  Dialog,
  Icon,
  IconButton,
  Image,
  Input,
  LottieView,
  ScrollView,
  SizableText,
  Stack,
  Toast,
  XStack,
  YStack,
  useThemeName,
} from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { ListItemGroup } from '@onekeyhq/kit/src/views/DeviceManagement/pages/ListItemGroup';
import { SetupCard } from '@onekeyhq/kit/src/views/Onboardingv2/components/SetupCard';
import { PrimeBenefitsItem } from '@onekeyhq/kit/src/views/Prime/pages/PrimeDashboard/PrimeBenefitsList';
import { PRIME_FEATURE_INTROS } from '@onekeyhq/kit/src/views/Prime/pages/PrimeFeatures/primeFeatureIntroUtils';
import { ETranslationsMock } from '@onekeyhq/shared/src/locale';
import zhCNMessages from '@onekeyhq/shared/src/locale/json/zh_CN.json';
import deviceUtils from '@onekeyhq/shared/src/utils/deviceUtils';

import { Layout } from './utils/Layout';

type IScreen = 'ready' | 'claim' | 'success' | 'device' | 'wallet';
type IDemoState = {
  screen: IScreen;
  origin: 'ready' | 'device';
  deviceFrom: 'ready' | 'wallet';
  inviteBound: boolean;
  inviteExpired: boolean;
  campaignOpen: boolean;
  loggedIn: boolean;
  verified: boolean;
  claimed: boolean;
  kytEnabled: boolean;
  notifyEnabled: boolean;
  failNext: boolean;
  claimError: string | null;
  loading: boolean;
};
type IConditionPatch = Partial<
  Pick<
    IDemoState,
    | 'loggedIn'
    | 'verified'
    | 'campaignOpen'
    | 'claimed'
    | 'inviteBound'
    | 'inviteExpired'
    | 'failNext'
    | 'kytEnabled'
    | 'notifyEnabled'
  >
>;

const ACCOUNT = 'd***@example.com';
const UNTIL = '2027年3月7日';
const READY_OFFER_SUBTITLE = '可稍后在设备详情领取';
const DEVICE_OFFER_SUBTITLE = '每台设备限领一次';
const DEVICE_SETTINGS_TOAST = '仅展示设备设置，未执行操作';
const PRO2_AVATAR = require('@onekeyhq/shared/src/assets/wallet/avatar/Pro2Black.png');
const KYT_P1 = '开启后，入账确认后会检测资金来源风险。';
const KYT_P2 =
  '发现高风险资金时会提醒你，结果也会显示在交易历史中。可随时在设置中关闭。';
// The app's Intl type also includes mock keys whose values are their display text.
const DEMO_MESSAGES = {
  ...zhCNMessages,
  ...(Object.fromEntries(
    Object.values(ETranslationsMock).map((key) => [key, key]),
  ) as Record<ETranslationsMock, string>),
};

function getPublishedPrimeFeatures() {
  return PRIME_FEATURE_INTROS.filter((feature) => !feature.isComingSoon);
}

function getQualificationStatus(state: IDemoState) {
  const done = state.campaignOpen && !state.claimed;
  let status = '符合赠送条件 · 尚未领取';
  if (state.claimed) {
    status = '本设备已领取';
  } else if (!state.campaignOpen) {
    status = '活动未开放';
  }
  return { done, status };
}

function StatusCheckRow({
  done,
  title,
  status,
}: {
  done: boolean;
  title: string;
  status: string;
}) {
  return (
    <ListItem
      mx="$0"
      minHeight={44}
      py="$2"
      alignItems="flex-start"
      renderIcon={
        <Stack pt="$0.5" flexShrink={0}>
          <Icon
            name={done ? 'CheckRadioSolid' : 'CirclePlaceholderOnOutline'}
            size="$5"
            color={done ? '$brand9' : '$iconSubdued'}
          />
        </Stack>
      }
      title={title}
      titleProps={{ size: '$bodyLgMedium' }}
      subtitle={status}
      subtitleProps={{ size: '$bodyMd' }}
    />
  );
}

function ControlChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Button
      testID={`prime-gift-control-${label}`}
      size="small"
      variant={selected ? 'primary' : 'secondary'}
      onPress={onPress}
      accessibilityState={{ selected }}
    >
      {label}
    </Button>
  );
}

function ControlRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <XStack
      testID={`prime-gift-condition-${label}`}
      alignItems="flex-start"
      gap="$2"
      flexWrap="wrap"
    >
      <SizableText
        size="$bodySmMedium"
        color="$textSubdued"
        pt="$1.5"
        width={72}
        flexShrink={0}
      >
        {label}
      </SizableText>
      <XStack flex={1} flexWrap="wrap" gap="$2" minWidth={180}>
        {children}
      </XStack>
    </XStack>
  );
}

const DEFAULT_STATE: IDemoState = {
  screen: 'ready',
  origin: 'ready',
  deviceFrom: 'ready',
  inviteBound: false,
  inviteExpired: false,
  campaignOpen: true,
  loggedIn: false,
  verified: true,
  claimed: false,
  kytEnabled: false,
  notifyEnabled: false,
  failNext: false,
  claimError: null,
  loading: false,
};

function InviteCodeInput({
  onChangeCode,
}: {
  onChangeCode: (code: string) => void;
}) {
  const [value, setValue] = useState('');
  return (
    <Input
      size="large"
      value={value}
      placeholder="输入邀请码"
      autoCapitalize="none"
      autoCorrect={false}
      maxLength={30}
      onChangeText={(text) => {
        setValue(text);
        onChangeCode(text);
      }}
    />
  );
}

function Header({ title, onBack }: { title: string; onBack?: () => void }) {
  return (
    <XStack h={52} px="$2" alignItems="center">
      {onBack ? (
        <IconButton
          variant="tertiary"
          size="large"
          icon="ChevronLeftOutline"
          onPress={onBack}
        />
      ) : (
        <Stack w="$10" />
      )}
      <SizableText flex={1} textAlign="center" size="$headingMd">
        {title}
      </SizableText>
      <Stack w="$10" />
    </XStack>
  );
}

function showDeviceSettingsToast() {
  Toast.message({ title: DEVICE_SETTINGS_TOAST });
}

function MockDeviceSettingsGroup({
  title,
  rows,
  danger,
}: {
  title?: string;
  rows: { title: string; value?: string }[];
  danger?: boolean;
}) {
  return (
    <ListItemGroup
      title={title}
      withSeparator
      itemProps={{ minHeight: '$12' }}
      groupProps={
        danger ? { borderColor: '$borderCriticalSubdued' } : undefined
      }
    >
      {rows.map((row) => (
        <ListItem
          key={row.title}
          title={row.title}
          titleProps={{ size: '$bodyMdMedium', color: '$text' }}
          drillIn
          onPress={showDeviceSettingsToast}
        >
          {row.value ? (
            <SizableText size="$bodyMdMedium" color="$textSubdued">
              {row.value}
            </SizableText>
          ) : null}
        </ListItem>
      ))}
    </ListItemGroup>
  );
}

function OfferCard({
  icon,
  claimed,
  onPress,
  unclaimedSubtitle = READY_OFFER_SUBTITLE,
}: {
  icon: IKeyOfIcons;
  claimed?: boolean;
  onPress?: () => void;
  unclaimedSubtitle?: string;
}) {
  return (
    <XStack
      onPress={claimed ? undefined : onPress}
      accessibilityRole={claimed ? undefined : 'button'}
      focusable={!claimed}
      alignItems="center"
      gap="$3"
      minHeight={88}
      px="$4"
      py="$4"
      bg="$bgSubdued"
      borderRadius="$4"
      hoverStyle={claimed ? undefined : { bg: '$bgHover' }}
      pressStyle={claimed ? undefined : { bg: '$bgActive' }}
    >
      <Icon name={icon} size="$6" />
      <YStack flex={1} minWidth={0} gap="$0.5">
        <SizableText size="$bodyLgMedium">
          {claimed ? '6 个月 Prime 已领取' : '附赠 6 个月 Prime'}
        </SizableText>
        <SizableText size="$bodyMd" color="$textSubdued">
          {claimed ? `${ACCOUNT} · 有效期至 ${UNTIL}` : unclaimedSubtitle}
        </SizableText>
      </YStack>
      {claimed ? null : (
        <XStack alignItems="center" gap="$0.5" flexShrink={0}>
          <SizableText size="$bodyMdMedium">领取</SizableText>
          <Icon
            name="ChevronRightSmallOutline"
            size="$4"
            color="$iconSubdued"
          />
        </XStack>
      )}
    </XStack>
  );
}

function Pro2PrimeGiftDemo() {
  const icon: IKeyOfIcons =
    useThemeName() === 'light'
      ? 'OnekeyPrimeLightColored'
      : 'OnekeyPrimeDarkColored';
  const publishedFeatures = useMemo(() => getPublishedPrimeFeatures(), []);
  const [state, setState] = useState<IDemoState>(DEFAULT_STATE);
  const stateRef = useRef(state);
  stateRef.current = state;
  const seqRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dialogsRef = useRef<IDialogInstance[]>([]);
  const inviteCodeRef = useRef('');

  const cancelPending = useCallback(() => {
    seqRef.current += 1;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const closeDialogs = useCallback(() => {
    const list = dialogsRef.current;
    dialogsRef.current = [];
    list.forEach((d) => {
      void d.close();
    });
  }, []);

  const showDialog = useCallback((dialog: IDialogInstance) => {
    dialogsRef.current.push(dialog);
  }, []);

  useEffect(
    () => () => {
      cancelPending();
      closeDialogs();
    },
    [cancelPending, closeDialogs],
  );

  const goScreen = useCallback(
    (screen: IScreen, extra?: Partial<IDemoState>) => {
      cancelPending();
      closeDialogs();
      setState((s) => ({
        ...s,
        screen,
        loading: false,
        claimError: null,
        ...extra,
      }));
    },
    [cancelPending, closeDialogs],
  );

  const updateConditions = useCallback(
    (patch: IConditionPatch) => {
      cancelPending();
      closeDialogs();
      setState((s) => ({
        ...s,
        loading: false,
        claimError: null,
        ...patch,
      }));
    },
    [cancelPending, closeDialogs],
  );

  const resetDemo = useCallback(() => {
    cancelPending();
    closeDialogs();
    setState({ ...DEFAULT_STATE });
  }, [cancelPending, closeDialogs]);

  const startClaim = useCallback(() => {
    if (stateRef.current.claimed || stateRef.current.loading) {
      return;
    }
    if (!stateRef.current.campaignOpen) {
      setState((s) => ({
        ...s,
        loading: false,
        claimError: '活动已结束',
      }));
      return;
    }
    const seq = seqRef.current + 1;
    seqRef.current = seq;
    setState((s) => ({ ...s, loading: true, claimError: null }));
    timerRef.current = setTimeout(() => {
      if (seq !== seqRef.current) {
        return;
      }
      timerRef.current = null;
      setState((s) => {
        if (s.claimed) {
          return { ...s, loading: false, claimError: '该设备已领取' };
        }
        if (!s.campaignOpen) {
          return { ...s, loading: false, claimError: '活动已结束' };
        }
        if (s.failNext) {
          return {
            ...s,
            loading: false,
            failNext: false,
            claimError: '领取失败，请重试',
          };
        }
        return {
          ...s,
          loading: false,
          claimed: true,
          claimError: null,
          screen: 'success',
        };
      });
    }, 500);
  }, []);

  const openLogin = useCallback(() => {
    showDialog(
      Dialog.show({
        testID: 'prime-gift-dialog-login',
        title: '登录 OneKey ID',
        description: '登录后即可将 6 个月 Prime 领取到你的账号。',
        onConfirmText: '继续',
        onCancelText: '取消',
        onConfirm: async ({ close }) => {
          setState((s) => ({ ...s, loggedIn: true }));
          await close();
        },
      }),
    );
  }, [showDialog]);

  const openNotify = useCallback(() => {
    showDialog(
      Dialog.show({
        testID: 'prime-gift-dialog-notify',
        icon: 'BellOutline',
        title: '开启通知',
        description:
          '启用通知后，检测到高风险资金时将及时提醒。未启用通知不影响监控功能，检测结果可在交易历史中查看。',
        onConfirmText: '开启',
        onCancelText: '稍后',
        onConfirm: async ({ close }) => {
          const seq = seqRef.current;
          await close();
          if (seq !== seqRef.current) {
            return;
          }
          showDialog(
            Dialog.show({
              testID: 'prime-gift-dialog-notify-permission',
              title: '允许通知',
              description: 'OneKey 想给你发送通知',
              onConfirmText: '允许',
              onCancelText: '不允许',
              onConfirm: async ({ close: closePerm }) => {
                setState((s) => ({ ...s, notifyEnabled: true }));
                await closePerm();
              },
            }),
          );
        },
      }),
    );
  }, [showDialog]);

  const openKyt = useCallback(() => {
    if (!stateRef.current.claimed || stateRef.current.kytEnabled) {
      return;
    }
    showDialog(
      Dialog.show({
        testID: 'prime-gift-dialog-kyt',
        icon: 'ShieldCheckDoneOutline',
        title: '收款风险监控',
        renderContent: (
          <YStack gap="$3">
            <SizableText size="$bodyLg">{KYT_P1}</SizableText>
            <SizableText size="$bodyLg">{KYT_P2}</SizableText>
          </YStack>
        ),
        onConfirmText: '开启监控',
        onCancelText: '暂不开启',
        onConfirm: async ({ close }) => {
          const seq = seqRef.current;
          setState((s) => ({ ...s, kytEnabled: true }));
          await close();
          if (seq !== seqRef.current) {
            return;
          }
          if (!stateRef.current.notifyEnabled) {
            openNotify();
          }
        },
      }),
    );
  }, [openNotify, showDialog]);

  const openBenefits = useCallback(() => {
    showDialog(
      Dialog.show({
        testID: 'prime-gift-dialog-benefits',
        title: 'Prime 会员权益',
        renderContent: (
          <IntlProvider locale="zh-CN" messages={DEMO_MESSAGES}>
            <ScrollView maxHeight={360}>
              {publishedFeatures.map((feature) => (
                <PrimeBenefitsItem
                  key={feature.id}
                  feature={feature}
                  itemProps={{ mx: 0, px: 0 }}
                />
              ))}
            </ScrollView>
          </IntlProvider>
        ),
        onConfirmText: '返回领取',
        showCancelButton: false,
      }),
    );
  }, [publishedFeatures, showDialog]);

  const onClaimPrimary = useCallback(() => {
    const current = stateRef.current;
    if (current.claimed || !current.campaignOpen) {
      return;
    }
    if (!current.loggedIn) {
      openLogin();
      return;
    }
    if (!current.verified) {
      showDialog(
        Dialog.show({
          testID: 'prime-gift-dialog-verify',
          title: '验证设备',
          description: '请按照提示完成设备验证。',
          onConfirmText: '确认',
          onCancelText: '取消',
          onConfirm: async ({ close }) => {
            const seq = seqRef.current;
            setState((s) => ({ ...s, verified: true }));
            await close();
            if (seq !== seqRef.current) {
              return;
            }
            startClaim();
          },
        }),
      );
      return;
    }
    startClaim();
  }, [openLogin, showDialog, startClaim]);

  const openInvite = () => {
    inviteCodeRef.current = '';
    showDialog(
      Dialog.show({
        testID: 'prime-gift-dialog-invite',
        title: '填写邀请码',
        description: '邀请码不是必需的，如果你有可以在这里输入。',
        renderContent: (
          <InviteCodeInput
            onChangeCode={(code) => {
              inviteCodeRef.current = code;
            }}
          />
        ),
        onConfirmText: '确认',
        onCancelText: '取消',
        onConfirm: async ({ close, preventClose }) => {
          if (!inviteCodeRef.current.trim()) {
            preventClose();
            Toast.error({ title: '请输入邀请码' });
            return;
          }
          setState((s) => ({ ...s, inviteBound: true }));
          await close();
        },
      }),
    );
  };

  const qualification = getQualificationStatus(state);
  const claimBlocked = state.claimed || !state.campaignOpen;
  let cta = '领取 6 个月 Prime';
  if (state.claimed) {
    cta = '该设备已领取';
  } else if (!state.campaignOpen) {
    cta = '活动已结束';
  } else if (!state.loggedIn) {
    cta = '登录并继续';
  } else if (!state.verified) {
    cta = '验证设备并领取';
  }

  let kytSubtitle = state.kytEnabled ? '已开启' : '未开启';
  if (!state.claimed) kytSubtitle = '领取 Prime 后可开启';

  const inviteAvailable = !state.inviteBound && !state.inviteExpired;
  const onSuccessPage = state.screen === 'success';

  return (
    <YStack gap="$4" width="100%">
      <SizableText size="$bodySm" color="$textSubdued">
        本地交互稿 · 所有账号、领取与设备操作均为模拟
      </SizableText>
      <YStack gap="$3">
        <YStack gap="$2">
          <SizableText size="$bodyMdMedium">预览页面</SizableText>
          <XStack flexWrap="wrap" gap="$2">
            <ControlChip
              label="完成页"
              selected={state.screen === 'ready'}
              onPress={() => goScreen('ready')}
            />
            <ControlChip
              label="设备详情"
              selected={state.screen === 'device'}
              onPress={() => {
                let deviceFrom = state.deviceFrom;
                if (state.screen !== 'device') {
                  deviceFrom = state.screen === 'wallet' ? 'wallet' : 'ready';
                }
                goScreen('device', { deviceFrom });
              }}
            />
            <ControlChip
              label="领取页"
              selected={state.screen === 'claim'}
              onPress={() => {
                let origin = state.origin;
                if (state.screen !== 'claim') {
                  origin = state.screen === 'device' ? 'device' : 'ready';
                }
                goScreen('claim', { origin });
              }}
            />
            <ControlChip
              label="钱包"
              selected={state.screen === 'wallet'}
              onPress={() => goScreen('wallet')}
            />
          </XStack>
        </YStack>
        <YStack gap="$2">
          <SizableText size="$bodyMdMedium">模拟条件</SizableText>
          <SizableText size="$bodySm" color="$textSubdued">
            切换条件保留当前页面，其他条件不变
          </SizableText>
          {onSuccessPage ? (
            <>
              <ControlRow label="KYT">
                <ControlChip
                  label="未开启"
                  selected={!state.kytEnabled}
                  onPress={() => updateConditions({ kytEnabled: false })}
                />
                <ControlChip
                  label="已开启"
                  selected={state.kytEnabled}
                  onPress={() => updateConditions({ kytEnabled: true })}
                />
              </ControlRow>
              <ControlRow label="通知权限">
                <ControlChip
                  label="未开启"
                  selected={!state.notifyEnabled}
                  onPress={() => updateConditions({ notifyEnabled: false })}
                />
                <ControlChip
                  label="已开启"
                  selected={state.notifyEnabled}
                  onPress={() => updateConditions({ notifyEnabled: true })}
                />
              </ControlRow>
            </>
          ) : (
            <>
              <ControlRow label="OneKey ID">
                <ControlChip
                  label="未登录"
                  selected={!state.loggedIn}
                  onPress={() => updateConditions({ loggedIn: false })}
                />
                <ControlChip
                  label="已登录"
                  selected={state.loggedIn}
                  onPress={() => updateConditions({ loggedIn: true })}
                />
              </ControlRow>
              <ControlRow label="设备验证">
                <ControlChip
                  label="待验证"
                  selected={!state.verified}
                  onPress={() => updateConditions({ verified: false })}
                />
                <ControlChip
                  label="已验证"
                  selected={state.verified}
                  onPress={() => updateConditions({ verified: true })}
                />
              </ControlRow>
              <ControlRow label="活动">
                <ControlChip
                  label="开放"
                  selected={state.campaignOpen}
                  onPress={() => updateConditions({ campaignOpen: true })}
                />
                <ControlChip
                  label="关闭"
                  selected={!state.campaignOpen}
                  onPress={() => updateConditions({ campaignOpen: false })}
                />
              </ControlRow>
              <ControlRow label="领取记录">
                <ControlChip
                  label="未领取"
                  selected={!state.claimed}
                  onPress={() => updateConditions({ claimed: false })}
                />
                <ControlChip
                  label="已领取"
                  selected={state.claimed}
                  onPress={() => updateConditions({ claimed: true })}
                />
              </ControlRow>
              {state.screen === 'ready' ? (
                <ControlRow label="邀请码">
                  <ControlChip
                    label="可填写"
                    selected={inviteAvailable}
                    onPress={() =>
                      updateConditions({
                        inviteBound: false,
                        inviteExpired: false,
                      })
                    }
                  />
                  <ControlChip
                    label="已绑定"
                    selected={state.inviteBound}
                    onPress={() =>
                      updateConditions({
                        inviteBound: true,
                        inviteExpired: false,
                      })
                    }
                  />
                  <ControlChip
                    label="已过期"
                    selected={state.inviteExpired}
                    onPress={() =>
                      updateConditions({
                        inviteBound: false,
                        inviteExpired: true,
                      })
                    }
                  />
                </ControlRow>
              ) : null}
              <ControlRow label="下次领取">
                <ControlChip
                  label="正常"
                  selected={!state.failNext}
                  onPress={() => updateConditions({ failNext: false })}
                />
                <ControlChip
                  label="失败"
                  selected={state.failNext}
                  onPress={() => updateConditions({ failNext: true })}
                />
              </ControlRow>
            </>
          )}
        </YStack>
        <YStack gap="$2">
          <SizableText size="$bodyMdMedium">快捷场景</SizableText>
          <SizableText size="$bodySm" color="$textSubdued">
            「预览领取成功」会设为已登录、设备已验证、已领取，其它条件保留。「恢复默认」回到完成页初始状态。
          </SizableText>
          <XStack flexWrap="wrap" gap="$2">
            <ControlChip
              label="预览领取成功"
              selected={onSuccessPage}
              onPress={() =>
                goScreen('success', {
                  loggedIn: true,
                  verified: true,
                  claimed: true,
                })
              }
            />
            <ControlChip
              label="恢复默认"
              selected={false}
              onPress={resetDemo}
            />
          </XStack>
        </YStack>
      </YStack>
      <YStack
        testID="prime-gift-preview"
        width="100%"
        maxWidth={390}
        height={640}
        alignSelf="center"
        bg="$bgApp"
        borderWidth="$px"
        borderColor="$borderSubdued"
        borderRadius="$4"
        overflow="hidden"
      >
        {state.screen === 'ready' ? (
          <YStack flex={1}>
            <YStack
              flex={1}
              minHeight={220}
              justifyContent="center"
              alignItems="center"
              gap="$4"
              px="$5"
            >
              <YStack
                width={88}
                height={88}
                borderRadius="$full"
                bg="$brand10"
                alignItems="center"
                justifyContent="center"
              >
                <Icon name="CheckmarkSolid" size="$10" color="$bgApp" />
              </YStack>
              <SizableText size="$heading2xl" textAlign="center">
                钱包已准备就绪
              </SizableText>
            </YStack>
            <YStack px="$5" pb="$5" gap="$3">
              {state.claimed || !state.campaignOpen ? null : (
                <OfferCard
                  icon={icon}
                  onPress={() => goScreen('claim', { origin: 'ready' })}
                />
              )}
              {state.inviteBound || state.inviteExpired ? null : (
                <Button
                  variant="tertiary"
                  childrenAsText={false}
                  alignSelf="center"
                  minHeight={44}
                  accessibilityLabel="填写邀请码"
                  testID="prime-gift-open-invite"
                  onPress={openInvite}
                >
                  <XStack alignItems="center" gap="$1">
                    <SizableText size="$bodyMd" color="$textSubdued">
                      有邀请码？
                    </SizableText>
                    <XStack alignItems="center" gap="$0.5">
                      <SizableText size="$bodyMdMedium">填写</SizableText>
                      <Icon
                        name="ChevronRightSmallOutline"
                        size="$4"
                        color="$iconSubdued"
                      />
                    </XStack>
                  </XStack>
                </Button>
              )}
              <Button
                size="large"
                variant="primary"
                onPress={() => goScreen('wallet')}
              >
                进入钱包
              </Button>
            </YStack>
          </YStack>
        ) : null}
        {state.screen === 'claim' ? (
          <YStack flex={1}>
            <Header title="领取 Prime" onBack={() => goScreen(state.origin)} />
            <ScrollView flex={1}>
              <YStack px="$5" pb="$5" gap="$5">
                <YStack alignItems="center" gap="$2" pt="$2">
                  <Icon name={icon} size="$12" />
                  <SizableText size="$heading2xl" textAlign="center">
                    领取 6 个月 Prime
                  </SizableText>
                  <SizableText
                    size="$bodyMd"
                    color="$textSubdued"
                    textAlign="center"
                  >
                    {`感谢您购买 ${deviceUtils.getDeviceModelNameByType(EDeviceType.Pro2) || 'OneKey'}`}
                  </SizableText>
                  <Button
                    variant="tertiary"
                    size="small"
                    minHeight={44}
                    iconAfter="ChevronRightSmallOutline"
                    testID="prime-gift-open-benefits"
                    onPress={openBenefits}
                  >
                    了解权益
                  </Button>
                </YStack>
                <SetupCard elevated={false}>
                  <YStack
                    bg="$bgSubdued"
                    borderRadius="$4"
                    overflow="hidden"
                    py="$1"
                  >
                    <StatusCheckRow
                      done={state.loggedIn}
                      title="登录 OneKey ID"
                      status={state.loggedIn ? ACCOUNT : '用于接收 Prime 权益'}
                    />
                    <StatusCheckRow
                      done={state.verified}
                      title="设备验证"
                      status={
                        state.verified ? '已通过验证' : '领取前需完成验证'
                      }
                    />
                    <StatusCheckRow
                      done={state.verified && qualification.done}
                      title="领取资格"
                      status={
                        state.verified
                          ? qualification.status
                          : '完成设备验证后确认'
                      }
                    />
                  </YStack>
                </SetupCard>
                {state.claimError ? (
                  <Alert
                    type="critical"
                    title={state.claimError}
                    description="本次未消耗领取资格，可重试。"
                  />
                ) : null}
              </YStack>
            </ScrollView>
            <YStack px="$5" pt="$3" pb="$5" gap="$3" flexShrink={0}>
              <SizableText
                size="$bodySm"
                color="$textSubdued"
                textAlign="center"
              >
                每台符合条件的设备限领一次。
              </SizableText>
              <Button
                size="large"
                variant="primary"
                loading={state.loading}
                disabled={state.loading || claimBlocked}
                testID="prime-gift-claim-primary"
                onPress={onClaimPrimary}
              >
                {cta}
              </Button>
            </YStack>
          </YStack>
        ) : null}
        {state.screen === 'success' ? (
          <YStack flex={1}>
            <ScrollView flex={1} contentContainerStyle={{ flexGrow: 1 }}>
              <YStack flex={1} px="$5" py="$4">
                <YStack
                  flex={1}
                  justifyContent="center"
                  alignItems="center"
                  gap="$3"
                >
                  <LottieView
                    source={require('@onekeyhq/kit/assets/animations/lottie-swap-done.json')}
                    width={96}
                    height={96}
                    autoPlay
                    loop={false}
                  />
                  <SizableText size="$heading3xl" textAlign="center">
                    领取成功
                  </SizableText>
                  <YStack alignItems="center" gap="$2">
                    <XStack alignItems="center" gap="$1.5">
                      <Icon name={icon} size="$5" />
                      <SizableText size="$bodyLgMedium">
                        6 个月 Prime
                      </SizableText>
                    </XStack>
                    <YStack alignItems="center" gap="$0.5">
                      <SizableText size="$bodyMd" color="$textSubdued">
                        {ACCOUNT}
                      </SizableText>
                      <SizableText size="$bodyMd" color="$textSubdued">
                        {UNTIL}到期
                      </SizableText>
                    </YStack>
                  </YStack>
                </YStack>
                {state.kytEnabled ? (
                  <YStack
                    mt="$4"
                    width="100%"
                    bg="$bgSubdued"
                    borderRadius="$4"
                    p="$4"
                  >
                    <XStack alignItems="flex-start" gap="$3">
                      <Icon
                        name="CheckRadioSolid"
                        size="$5"
                        color="$brand9"
                        flexShrink={0}
                        pt="$0.5"
                      />
                      <YStack flex={1} minWidth={0} gap="$1">
                        <SizableText size="$bodyLgMedium">
                          收款风险监控已开启
                        </SizableText>
                        <SizableText size="$bodyMd" color="$textSubdued">
                          {state.notifyEnabled
                            ? '发现高风险资金时将通知您'
                            : '检测结果可在交易历史查看'}
                        </SizableText>
                      </YStack>
                    </XStack>
                  </YStack>
                ) : (
                  <XStack
                    mt="$4"
                    width="100%"
                    minHeight={44}
                    bg="$bgSubdued"
                    borderRadius="$4"
                    p="$4"
                    alignItems="center"
                    gap="$3"
                    accessibilityRole="button"
                    focusable
                    testID="prime-gift-open-kyt"
                    onPress={openKyt}
                    hoverStyle={{ bg: '$bgHover' }}
                    pressStyle={{ bg: '$bgActive' }}
                  >
                    <Icon
                      name="ShieldOutline"
                      size="$5"
                      color="$iconSubdued"
                      flexShrink={0}
                    />
                    <YStack flex={1} minWidth={0} gap="$0.5">
                      <SizableText size="$bodyLgMedium">
                        收款风险监控
                      </SizableText>
                      <SizableText size="$bodyMd" color="$textSubdued">
                        入账确认后，发现风险时提醒您。
                      </SizableText>
                    </YStack>
                    <Icon
                      name="ChevronRightSmallOutline"
                      size="$5"
                      color="$iconSubdued"
                      flexShrink={0}
                    />
                  </XStack>
                )}
              </YStack>
            </ScrollView>
            <YStack px="$5" pb="$5">
              <Button
                size="large"
                variant="primary"
                onPress={() => goScreen('wallet')}
              >
                进入钱包
              </Button>
            </YStack>
          </YStack>
        ) : null}
        {state.screen === 'device' ? (
          <YStack flex={1}>
            <Header
              title="关于设备"
              onBack={() => goScreen(state.deviceFrom)}
            />
            <ScrollView flex={1}>
              <YStack px="$5" pb="$8" gap="$5">
                <XStack pt={10} gap="$4" alignItems="center">
                  <Image
                    source={PRO2_AVATAR}
                    width={88}
                    height={88}
                    contentFit="contain"
                  />
                  <YStack flex={1} minWidth={0} gap="$1.5">
                    <SizableText size="$headingXl">OneKey Pro 2</SizableText>
                    <SizableText size="$bodyMd" color="$textSubdued">
                      DEMO-0001
                    </SizableText>
                    <XStack gap="$2" flexWrap="wrap">
                      <Badge badgeSize="sm" badgeType="default">
                        1.0.0
                      </Badge>
                      <Badge
                        badgeSize="sm"
                        badgeType={state.verified ? 'success' : 'default'}
                      >
                        <XStack alignItems="center" gap="$1.5">
                          {state.verified ? (
                            <Icon
                              name="BadgeVerifiedSolid"
                              color="$iconSuccess"
                              size="$4"
                            />
                          ) : null}
                          <SizableText
                            size="$bodySmMedium"
                            color={
                              state.verified
                                ? '$textSuccessStrong'
                                : '$textSubdued'
                            }
                          >
                            {state.verified ? '已验证' : '待验证'}
                          </SizableText>
                        </XStack>
                      </Badge>
                    </XStack>
                  </YStack>
                </XStack>
                {!state.claimed && state.campaignOpen ? (
                  <OfferCard
                    icon={icon}
                    unclaimedSubtitle={DEVICE_OFFER_SUBTITLE}
                    onPress={() => goScreen('claim', { origin: 'device' })}
                  />
                ) : null}
                <MockDeviceSettingsGroup
                  rows={[
                    { title: '关于设备' },
                    { title: '设备验真' },
                    { title: '检查更新' },
                    { title: '故障排查' },
                  ]}
                />
                <MockDeviceSettingsGroup
                  title="通用"
                  rows={[
                    { title: '语言', value: '简体中文' },
                    { title: '自动锁定', value: '1 分钟' },
                    { title: '自动关机', value: '5 分钟' },
                    { title: '振动反馈', value: '开启' },
                  ]}
                />
                <MockDeviceSettingsGroup
                  title="安全"
                  rows={[{ title: '修改 PIN 码' }]}
                />
                <MockDeviceSettingsGroup
                  title="高级"
                  rows={[{ title: 'Passphrase', value: '关闭' }]}
                />
                <MockDeviceSettingsGroup
                  title="设备连接"
                  rows={[{ title: '忘记设备' }]}
                />
                <MockDeviceSettingsGroup
                  title="危险区域"
                  danger
                  rows={[{ title: '重置设备' }]}
                />
              </YStack>
            </ScrollView>
          </YStack>
        ) : null}
        {state.screen === 'wallet' ? (
          <YStack flex={1}>
            <Header title="钱包" />
            <YStack px="$3" pb="$5" gap="$3">
              {state.claimed ? <OfferCard icon={icon} claimed /> : null}
              <YStack bg="$bgSubdued" borderRadius="$4" overflow="hidden">
                <ListItem
                  mx="$0"
                  title="查看设备"
                  drillIn
                  onPress={() => goScreen('device', { deviceFrom: 'wallet' })}
                />
                <ListItem
                  mx="$0"
                  title="收款风险监控"
                  subtitle={kytSubtitle}
                  drillIn={state.claimed && !state.kytEnabled}
                  disabled={!state.claimed}
                  onPress={
                    state.claimed && !state.kytEnabled ? openKyt : undefined
                  }
                />
              </YStack>
            </YStack>
          </YStack>
        ) : null}
      </YStack>
    </YStack>
  );
}

function Pro2PrimeGiftDemoZhCN() {
  return (
    <IntlProvider locale="zh-CN" messages={DEMO_MESSAGES}>
      <Pro2PrimeGiftDemo />
    </IntlProvider>
  );
}

export default function Pro2PrimeGiftGallery() {
  return (
    <Layout
      getFilePath={() => __CURRENT_FILE_PATH__}
      componentName="Pro2PrimeGift"
      description="Pro 2 附赠 6 个月 Prime 的 Gallery 交互稿。账号、登录、设备确认、领取与通知均为本地模拟，无真实接口"
      suggestions={[
        '进入钱包始终直达，不自动弹出邀请码或收款风险监控',
        '邀请码仅未绑定时可选填写；Prime 随设备限领一次，领取前可见接收账号',
        '成功页可稍后开启收款风险监控，主按钮进入钱包不自动弹出',
      ]}
      boundaryConditions={[
        '首页 KYT 自动引导移除另见 OK-62310；本成功页不再叠加通用 KYT 弹窗，跳过或进入钱包后不重复引导。当前 Gallery 仅模拟，生产逻辑尚未改动',
        '设备验证方式及验证结果能否复用，待与开发确认；当前领取流程仍为模拟',
        '6 个月和有效期 2027年3月7日 仅为示意；正式接入使用服务端返回的赠送月数和实际到期日',
      ]}
      elements={[{ title: '交互预览', element: Pro2PrimeGiftDemoZhCN }]}
    />
  );
}
