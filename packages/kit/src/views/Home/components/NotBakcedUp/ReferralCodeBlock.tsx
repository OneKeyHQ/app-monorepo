import type { ComponentProps } from 'react';
import {
  memo,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

import { isNil } from 'lodash';
// eslint-disable-next-line import/order
import { useIntl } from 'react-intl';

import {
  scrollTo,
  useAnimatedReaction,
  useSharedValue,
} from 'react-native-reanimated';

import {
  Badge,
  Button,
  CollapsibleTabContext,
  Form,
  Icon,
  Input,
  SizableText,
  Skeleton,
  Stack,
  Toast,
  XStack,
  YStack,
  useForm,
  useKeyboardEvent,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useHelpLink } from '@onekeyhq/kit/src/hooks/useHelpLink';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useSignatureConfirm } from '@onekeyhq/kit/src/hooks/useSignatureConfirm';
import { useThemeVariant } from '@onekeyhq/kit/src/hooks/useThemeVariant';
import {
  useAccountOverviewActions,
  useWalletStatusAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/accountOverview';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import {
  useGetReferralCodeWalletInfo,
  useWalletBoundReferralCode,
} from '@onekeyhq/kit/src/views/ReferFriends/hooks/useWalletBoundReferralCode';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import {
  openUrlExternal,
  openUrlInDiscovery,
} from '@onekeyhq/shared/src/utils/openUrlUtils';

import MainInfoBlock from './MainBlock';

function ReferralCodeBlock({
  inTabList,
  recomputeLayout,
  closable,
  onClose,
  containerProps,
  setShowReferralCodeBlock,
}: {
  inTabList?: boolean;
  recomputeLayout?: () => void;
  closable?: boolean;
  onClose?: () => void;
  containerProps?: ComponentProps<typeof MainInfoBlock>['containerProps'];
  setShowReferralCodeBlock?: (show: boolean) => void;
}) {
  const intl = useIntl();
  const themeVariant = useThemeVariant();

  const { updateWalletStatus } = useAccountOverviewActions().current;
  const [walletStatus] = useWalletStatusAtom();

  const [isJoiningReferral, setIsJoiningReferral] = useState(false);

  const {
    activeAccount: { wallet },
  } = useActiveAccount({
    num: 0,
  });

  const form = useForm({
    defaultValues: {
      referralCode: '',
    },
    mode: 'onChange',
    reValidateMode: 'onChange',
  });

  const getReferralCodeWalletInfo = useGetReferralCodeWalletInfo();
  const { result: walletInfo } = usePromiseResult(async () => {
    const r = await getReferralCodeWalletInfo(wallet?.id);
    if (!r) {
      return null;
    }
    return r;
  }, [wallet?.id, getReferralCodeWalletInfo]);

  const { navigationToMessageConfirmAsync } = useSignatureConfirm({
    accountId: walletInfo?.accountId ?? '',
    networkId: walletInfo?.networkId ?? '',
  });

  const { confirmBindReferralCode, getReferralCodeBondStatus } =
    useWalletBoundReferralCode();

  const isHdOrHwWallet =
    accountUtils.isHdWallet({ walletId: wallet?.id }) ||
    (accountUtils.isHwWallet({ walletId: wallet?.id }) &&
      !accountUtils.isHwHiddenWallet({
        wallet,
      }));

  const {
    result: shouldBoundReferralCode,
    run: refreshDisplayReferralCodeButton,
    isLoading: isLoadingReferralCodeButton,
  } = usePromiseResult(
    async () => {
      if (!isHdOrHwWallet) {
        return false;
      }

      const resp = await backgroundApiProxy.serviceWalletStatus.getWalletStatus(
        {
          walletXfp: wallet?.xfp || '',
        },
      );
      if (resp && (resp?.manuallyCloseReferralCodeBlock || resp?.hasValue)) {
        return false;
      }

      const referralCodeInfo =
        await backgroundApiProxy.serviceReferralCode.getWalletReferralCode({
          walletId: wallet?.id || '',
        });
      if (!referralCodeInfo) {
        const shouldBound = await getReferralCodeBondStatus({
          walletId: wallet?.id,
        });
        return shouldBound;
      }
      return referralCodeInfo?.walletId && !referralCodeInfo?.isBound;
    },
    [isHdOrHwWallet, wallet?.id, wallet?.xfp, getReferralCodeBondStatus],
    {
      initResult: undefined,
      watchLoading: true,
    },
  );

  useEffect(() => {
    if (!isNil(shouldBoundReferralCode)) {
      updateWalletStatus({
        showReferralCodeBlock: !!shouldBoundReferralCode,
        referralCodeBlockInit: true,
      });
    }
  }, [shouldBoundReferralCode, updateWalletStatus]);

  useEffect(() => {
    if (walletStatus.referralCodeBlockInit) {
      setShowReferralCodeBlock?.(walletStatus.showReferralCodeBlock);
    }
  }, [
    walletStatus.referralCodeBlockInit,
    walletStatus.showReferralCodeBlock,
    setShowReferralCodeBlock,
  ]);

  useEffect(() => {
    appEventBus.on(
      EAppEventBusNames.AccountValueUpdate,
      refreshDisplayReferralCodeButton,
    );
    return () => {
      appEventBus.off(
        EAppEventBusNames.AccountValueUpdate,
        refreshDisplayReferralCodeButton,
      );
    };
  }, [
    refreshDisplayReferralCodeButton,
    shouldBoundReferralCode,
    updateWalletStatus,
  ]);

  // Keyboard avoidance: scroll collapsible tab header when input is covered
  const inputWrapperRef = useRef<any>(null);
  const isInputFocusedRef = useRef(false);
  const tabsContext = useContext(CollapsibleTabContext);
  const refMap = (tabsContext as any)?.refMap;
  const focusedTabShared = (tabsContext as any)?.focusedTab;
  const scrollYCurrent = (tabsContext as any)?.scrollYCurrent;
  const tabContentInset = ((tabsContext as any)?.contentInset as number) ?? 0;

  const scrollDelta = useSharedValue(0);

  useAnimatedReaction(
    () => scrollDelta.value,
    (delta, prevDelta) => {
      if (
        delta > 0 &&
        delta !== prevDelta &&
        refMap &&
        focusedTabShared &&
        scrollYCurrent
      ) {
        const ref = refMap[focusedTabShared.value];
        if (ref) {
          const targetScroll = scrollYCurrent.value + delta;
          scrollTo(ref, 0, Math.max(0, targetScroll - tabContentInset), true);
        }
        scrollDelta.value = 0;
      }
    },
  );

  useKeyboardEvent(
    {
      keyboardWillShow: (e) => {
        if (!isInputFocusedRef.current || !inputWrapperRef.current || !refMap) {
          return;
        }
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        inputWrapperRef.current.measureInWindow(
          (_x: number, y: number, _width: number, height: number) => {
            const inputBottom = y + height;
            const keyboardTop = e.endCoordinates.screenY;
            if (inputBottom > keyboardTop - 20) {
              scrollDelta.value = inputBottom - keyboardTop + 60;
            }
          },
        );
      },
    },
    [],
  );

  const referralHelpLink = useHelpLink({ path: 'articles/11461266' });

  const handleJoinReferral = useCallback(async () => {
    const referralCode = form.getValues().referralCode?.trim();

    // Check if referral code is empty
    if (!referralCode) {
      Toast.error({
        title: intl.formatMessage({
          id: ETranslations.referral_invalid_code,
        }),
      });
      return;
    }

    const isValidForm = await form.trigger();
    if (!isValidForm) {
      return;
    }
    setIsJoiningReferral(true);
    try {
      await confirmBindReferralCode({
        walletInfo,
        navigationToMessageConfirmAsync,
        referralCode: form.getValues().referralCode,
        onSuccess: () => {
          setTimeout(() => refreshDisplayReferralCodeButton(), 200);
        },
      });
    } finally {
      setIsJoiningReferral(false);
    }
  }, [
    confirmBindReferralCode,
    form,
    intl,
    navigationToMessageConfirmAsync,
    refreshDisplayReferralCodeButton,
    walletInfo,
  ]);

  const renderReferralCodeActions = useCallback(() => {
    if (isLoadingReferralCodeButton) {
      return <Skeleton.HeadingXl />;
    }

    return shouldBoundReferralCode ? (
      <XStack alignItems="center" gap="$2" alignSelf="stretch">
        <Stack
          flex={platformEnv.isNative ? 1 : undefined}
          ref={inputWrapperRef}
        >
          <Form.Field
            name="referralCode"
            rules={{
              required: true,
              pattern: {
                value: /^[a-zA-Z0-9]{1,30}$/,
                message: intl.formatMessage({
                  id: ETranslations.referral_invalid_code,
                }),
              },
            }}
            renderErrorMessage={() => <></>}
          >
            <Input
              h={48}
              size="large"
              // w="100%"
              placeholder={intl.formatMessage({
                id: ETranslations.referral_your_code,
              })}
              backgroundColor="$bgApp"
              maxLength={30}
              onFocus={() => {
                isInputFocusedRef.current = true;
              }}
              onBlur={() => {
                isInputFocusedRef.current = false;
              }}
            />
          </Form.Field>
        </Stack>
        <Button
          size="large"
          variant="secondary"
          onPress={handleJoinReferral}
          loading={isJoiningReferral}
          disabled={form.formState.isSubmitting || isJoiningReferral}
        >
          {intl.formatMessage({
            id: ETranslations.global_join,
          })}
        </Button>
      </XStack>
    ) : (
      <XStack>
        <Badge
          badgeSize="md"
          badgeType="info"
          py={13}
          px={20}
          borderRadius="$3"
          gap="$2"
        >
          <Icon name="CheckLargeOutline" size="$4" color="$iconInfo" />
          <Badge.Text>
            {intl.formatMessage({
              id: ETranslations.referral_wallet_bind_code_finish,
            })}
          </Badge.Text>
        </Badge>
      </XStack>
    );
  }, [
    isLoadingReferralCodeButton,
    shouldBoundReferralCode,
    handleJoinReferral,
    isJoiningReferral,
    form.formState.isSubmitting,
    intl,
  ]);

  const handleClose = useCallback(async () => {
    if (closable) {
      await backgroundApiProxy.serviceWalletStatus.updateWalletStatus({
        walletXfp: wallet?.xfp || '',
        status: {
          manuallyCloseReferralCodeBlock: true,
        },
      });
      await refreshDisplayReferralCodeButton();
      onClose?.();
    }
  }, [closable, wallet?.xfp, refreshDisplayReferralCodeButton, onClose]);

  useEffect(() => {
    if (
      inTabList &&
      recomputeLayout &&
      !isNil(walletStatus.showReferralCodeBlock)
    ) {
      setTimeout(() => {
        recomputeLayout();
      }, 350);
    }
  }, [inTabList, recomputeLayout, walletStatus.showReferralCodeBlock]);

  const renderReferralCodeBlock = useCallback(() => {
    return (
      <MainInfoBlock
        closable={closable}
        onClose={handleClose}
        bgSource={
          themeVariant === 'light'
            ? require('@onekeyhq/kit/assets/promo-code-bg.png')
            : require('@onekeyhq/kit/assets/promo-code-bg-dark.png')
        }
        title={intl.formatMessage({ id: ETranslations.referral_promo_title })}
        iconProps={{ name: 'GiftOutline' }}
        iconContainerProps={{ bg: '$info8' }}
        containerProps={{
          bg: '$blue1',
          minHeight: 256,
          $gtMd: { flexBasis: 0, flexShrink: 1, flexGrow: 1 },
          pointerEvents: 'box-none',
          ...containerProps,
        }}
        actions={
          <Form form={form}>
            <YStack gap="$2" alignItems="flex-start">
              <SizableText
                color="$textSubdued"
                size="$bodyMd"
                textDecorationLine="underline"
                cursor="pointer"
                onPress={() => {
                  if (platformEnv.isDesktop || platformEnv.isNative) {
                    openUrlInDiscovery({ url: referralHelpLink });
                  } else {
                    openUrlExternal(referralHelpLink);
                  }
                }}
              >
                {intl.formatMessage({
                  id: ETranslations.referral_code_tutorial_label,
                })}
              </SizableText>
              {renderReferralCodeActions()}
            </YStack>
          </Form>
        }
      />
    );
  }, [
    closable,
    handleClose,
    themeVariant,
    intl,
    containerProps,
    form,
    referralHelpLink,
    renderReferralCodeActions,
  ]);

  if (!walletStatus.showReferralCodeBlock) {
    return null;
  }

  return inTabList ? (
    <Stack height={360}>{renderReferralCodeBlock()}</Stack>
  ) : (
    renderReferralCodeBlock()
  );
}

export default memo(ReferralCodeBlock);
