import { memo, useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Anchor,
  Badge,
  Button,
  Form,
  Input,
  SizableText,
  Skeleton,
  Stack,
  XStack,
  YStack,
  useForm,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { WalletBackupActions } from '@onekeyhq/kit/src/components/WalletBackup';
import { useHelpLink } from '@onekeyhq/kit/src/hooks/useHelpLink';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useSignatureConfirm } from '@onekeyhq/kit/src/hooks/useSignatureConfirm';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import type { OneKeyError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import {
  useGetReferralCodeWalletInfo,
  useWalletBoundReferralCode,
} from '../../../ReferFriends/hooks/useWalletBoundReferralCode';

import InfoBlock from './InfoBlock';
import MainInfoBlock from './MainBlock';

function NotBackedUp() {
  const intl = useIntl();
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

  const [isJoiningReferral, setIsJoiningReferral] = useState(false);

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

  // TODO fix help link
  const referralHelpLink = useHelpLink({ path: 'articles/11461265' });
  const securityFeaturesLink = useHelpLink({ path: 'articles/11829439' });
  const sendAndReceiveLink = useHelpLink({ path: 'articles/11829440' });
  const swapAndBridgeLink = useHelpLink({ path: 'articles/11829441' });

  const handleBackupWallet = useCallback(() => {
    if (platformEnv.isNativeIOS || platformEnv.isDesktopMac) {
      // TODO backup to iCloud
    }
    if (platformEnv.isNativeAndroid || platformEnv.isDesktopWin) {
      // TODO backup to Google Drive
    }
  }, []);

  const backupText = useMemo(() => {
    if (platformEnv.isNativeIOS || platformEnv.isDesktopMac) {
      return 'Backup to iCloud';
    }

    if (platformEnv.isNativeAndroid || platformEnv.isDesktopWin) {
      return 'Backup to Google Drive';
    }

    return intl.formatMessage({ id: ETranslations.backup_backup_now });
  }, [intl]);

  const handleJoinReferral = useCallback(async () => {
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
    } catch (e) {
      if (
        (e as OneKeyError).className === 'OneKeyServerApiError' &&
        (e as OneKeyError).message
      ) {
        form.setError('referralCode', {
          message: (e as OneKeyError).message,
        });
      }
      throw e;
    } finally {
      setIsJoiningReferral(false);
    }
  }, [
    confirmBindReferralCode,
    form,
    navigationToMessageConfirmAsync,
    refreshDisplayReferralCodeButton,
    walletInfo,
  ]);

  const renderReferralCodeActions = useCallback(() => {
    if (isLoadingReferralCodeButton) {
      return <Skeleton.HeadingXl />;
    }

    return shouldBoundReferralCode ? (
      <XStack alignItems="center" gap="$2">
        <Stack flex={1}>
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
          >
            <Input
              size="large"
              w="100%"
              placeholder="Referral code"
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
          disabled={
            form.formState.isSubmitting ||
            !form.formState.isValid ||
            isJoiningReferral
          }
        >
          {intl.formatMessage({
            id: ETranslations.global_join,
          })}
        </Button>
      </XStack>
    ) : (
      <XStack>
        <Badge badgeSize="md" badgeType="info">
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
    form.formState.isValid,
    intl,
  ]);
  return (
    <Stack flexDirection="column" gap="$10" px="$5" pb="$6">
      <Stack
        flexDirection="column"
        $gtMd={{ flexDirection: 'row' }}
        gap="$5"
        pt="$0.5"
      >
        <MainInfoBlock
          title="Backup your wallet"
          iconProps={{ name: 'ShieldCheckDoneOutline' }}
          iconContainerProps={{ bg: '$brand8' }}
          containerProps={{ bg: '$brand1' }}
          actions={
            <XStack>
              {platformEnv.isNativeIOS ||
              platformEnv.isDesktopMac ||
              platformEnv.isDesktopWin ||
              platformEnv.isNativeAndroid ? (
                <Button
                  variant="primary"
                  size="medium"
                  onPress={handleBackupWallet}
                >
                  {backupText}
                </Button>
              ) : (
                <WalletBackupActions wallet={wallet}>
                  <Button variant="primary" size="large" onPress={() => {}}>
                    {backupText}
                  </Button>
                </WalletBackupActions>
              )}
            </XStack>
          }
        />
        <MainInfoBlock
          title="Join the OneKey Referral Program"
          iconProps={{ name: 'GiftOutline' }}
          iconContainerProps={{ bg: '$info8' }}
          containerProps={{ bg: '$blue2' }}
          actions={
            <Form form={form}>
              <YStack gap="$6">
                <Anchor
                  href={referralHelpLink}
                  color="$textSubdued"
                  size="$bodyMd"
                  textDecorationLine="underline"
                >
                  How to get a referral code?
                </Anchor>
                {renderReferralCodeActions()}
              </YStack>
            </Form>
          }
        />
      </Stack>
      <YStack gap="$3">
        <SizableText size="$headingXs" textTransform="uppercase">
          Learn
        </SizableText>
        <Stack
          flexDirection="column"
          gap="$5"
          $gtMd={{
            flexDirection: 'row',
            justifyContent: 'space-between',
          }}
        >
          <InfoBlock
            iconProps={{ name: 'ShieldCheckDoneOutline' }}
            title="Security Features of OneKey App"
            url={securityFeaturesLink}
          />
          <InfoBlock
            iconProps={{ name: 'CoinsAddOutline' }}
            title="Send and receive cryptos"
            url={sendAndReceiveLink}
          />
          <InfoBlock
            iconProps={{ name: 'TradeOutline' }}
            title="Swap and bridge cryptos"
            url={swapAndBridgeLink}
          />
        </Stack>
      </YStack>
    </Stack>
  );
}

export default memo(NotBackedUp);
