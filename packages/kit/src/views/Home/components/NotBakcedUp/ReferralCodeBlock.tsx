import { memo, useCallback, useState } from 'react';

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
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import {
  useGetReferralCodeWalletInfo,
  useWalletBoundReferralCode,
} from '@onekeyhq/kit/src/views/ReferFriends/hooks/useWalletBoundReferralCode';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import MainInfoBlock from './MainBlock';

function ReferralCodeBlock({ hideOnBound = false }: { hideOnBound?: boolean }) {
  const intl = useIntl();
  const themeVariant = useThemeVariant();

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
    [wallet?.id, getReferralCodeBondStatus, isHdOrHwWallet],
    {
      initResult: undefined,
      watchLoading: true,
    },
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

  if (!shouldBoundReferralCode && hideOnBound) {
    return null;
  }

  return (
    <MainInfoBlock
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
        $gtMd: { flexBasis: 0, flexShrink: 1, flexGrow: 1 },
      }}
      actions={
        <Form form={form}>
          <YStack gap="$6" alignItems="flex-start">
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
}

export default memo(ReferralCodeBlock);
