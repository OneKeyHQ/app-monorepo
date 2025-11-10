import type { ComponentProps } from 'react';
import { memo, useCallback, useEffect, useState } from 'react';

import { isNil } from 'lodash';
import { useIntl } from 'react-intl';

import {
  Anchor,
  Badge,
  Button,
  Form,
  Icon,
  Input,
  Skeleton,
  Stack,
  Toast,
  XStack,
  YStack,
  useForm,
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

import MainInfoBlock from './MainBlock';

function ReferralCodeBlock({
  inTabList,
  recomputeLayout,
  closable,
  onClose,
  containerProps,
}: {
  inTabList?: boolean;
  recomputeLayout?: () => void;
  closable?: boolean;
  onClose?: () => void;
  containerProps?: ComponentProps<typeof MainInfoBlock>['containerProps'];
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
        <Stack flex={platformEnv.isNative ? 1 : undefined}>
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
          minHeight: 288,
          $gtMd: { flexBasis: 0, flexShrink: 1, flexGrow: 1 },
          ...containerProps,
        }}
        actions={
          <Form form={form}>
            <YStack gap="$2" alignItems="flex-start">
              <Anchor
                href={referralHelpLink}
                color="$textSubdued"
                size="$bodyMd"
                textDecorationLine="underline"
              >
                {intl.formatMessage({
                  id: ETranslations.referral_code_tutorial_label,
                })}
              </Anchor>
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
