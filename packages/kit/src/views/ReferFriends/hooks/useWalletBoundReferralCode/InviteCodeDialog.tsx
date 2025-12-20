import { useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  Dialog,
  Form,
  Icon,
  Input,
  Select,
  SizableText,
  Spinner,
  XStack,
  YStack,
  useForm,
} from '@onekeyhq/components';
import { WalletAvatar } from '@onekeyhq/kit/src/components/WalletAvatar/WalletAvatar';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useSignatureConfirm } from '@onekeyhq/kit/src/hooks/useSignatureConfirm';
import type { INavigationToMessageConfirmParams } from '@onekeyhq/kit/src/hooks/useSignatureConfirm';
import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';
import type { OneKeyError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { AllWalletsBoundEmpty } from './AllWalletsBoundEmpty';
import { NoWalletEmpty } from './NoWalletEmpty';
import { useFetchWalletsWithBoundStatus } from './useFetchWalletsWithBoundStatus';
import { useGetReferralCodeWalletInfo } from './useGetReferralCodeWalletInfo';

import type { IReferralCodeWalletInfo } from './types';

export function InviteCodeDialog({
  wallet,
  onSuccess,
  confirmBindReferralCode,
  defaultReferralCode,
}: {
  wallet?: IDBWallet;
  onSuccess?: () => void;
  defaultReferralCode?: string;
  confirmBindReferralCode: (params: {
    referralCode: string;
    preventClose?: () => void;
    walletInfo: IReferralCodeWalletInfo | null | undefined;
    navigationToMessageConfirmAsync: (
      params: INavigationToMessageConfirmParams,
    ) => Promise<string>;
    onSuccess?: () => void;
  }) => Promise<void>;
}) {
  const intl = useIntl();
  const form = useForm({
    defaultValues: {
      referralCode: defaultReferralCode || '',
    },
  });
  const getReferralCodeWalletInfo = useGetReferralCodeWalletInfo();
  const { walletsWithStatus, isLoading: isLoadingWallets } =
    useFetchWalletsWithBoundStatus();

  // Selected wallet state
  const [selectedWalletId, setSelectedWalletId] = useState<string | undefined>(
    wallet?.id,
  );

  // Get the selected wallet object
  const selectedWallet = useMemo(() => {
    if (!walletsWithStatus) return wallet;
    const found = walletsWithStatus.find(
      (w) => w.wallet.id === selectedWalletId,
    );
    return found?.wallet ?? wallet;
  }, [walletsWithStatus, selectedWalletId, wallet]);

  // Build wallet items for Select
  const walletItems = useMemo(() => {
    if (!walletsWithStatus) return [];

    return walletsWithStatus.map((item) => ({
      label: item.wallet.name,
      value: item.wallet.id,
      leading: <WalletAvatar wallet={item.wallet} size="$6" />,
      description: item.isBound
        ? intl.formatMessage({
            id: ETranslations.referral_wallet_bind_code_finish,
          })
        : undefined,
      disabled: item.isBound,
    }));
  }, [walletsWithStatus, intl]);

  // Check if data is ready (loaded and not undefined)
  const isDataReady = !isLoadingWallets && walletsWithStatus !== undefined;

  // Check if there are no available wallets (only when data is ready)
  const hasNoWallets = isDataReady && walletsWithStatus.length === 0;

  // Check if all wallets are already bound
  const allWalletsBound = useMemo(() => {
    if (!walletsWithStatus || walletsWithStatus.length === 0) return false;
    return walletsWithStatus.every((w) => w.isBound);
  }, [walletsWithStatus]);

  // Check if the selected wallet is already bound
  const isSelectedWalletBound = useMemo(() => {
    if (!walletsWithStatus || !selectedWalletId) return false;
    const found = walletsWithStatus.find(
      (w) => w.wallet.id === selectedWalletId,
    );
    return found?.isBound ?? false;
  }, [walletsWithStatus, selectedWalletId]);

  const { result: walletInfo } = usePromiseResult(async () => {
    const r = await getReferralCodeWalletInfo(selectedWallet?.id);
    if (!r) {
      return null;
    }
    return r;
  }, [selectedWallet?.id, getReferralCodeWalletInfo]);

  const { navigationToMessageConfirmAsync } = useSignatureConfirm({
    accountId: walletInfo?.accountId ?? '',
    networkId: walletInfo?.networkId ?? '',
  });

  const handleConfirm = useCallback(
    async ({ preventClose }: { preventClose?: () => void }) => {
      try {
        const isValidForm = await form.trigger();
        if (!isValidForm) {
          preventClose?.();
          return;
        }
        await confirmBindReferralCode({
          referralCode: form.getValues().referralCode,
          preventClose,
          walletInfo,
          navigationToMessageConfirmAsync,
          onSuccess,
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
      }
    },
    [
      form,
      walletInfo,
      confirmBindReferralCode,
      navigationToMessageConfirmAsync,
      onSuccess,
    ],
  );

  // Loading state - show spinner until all data is ready
  if (!isDataReady) {
    return (
      <>
        <XStack h="$20" ai="center" jc="center">
          <Spinner size="small" />
        </XStack>
        <Dialog.Footer showConfirmButton={false} showCancelButton={false} />
      </>
    );
  }

  // No wallet state
  if (hasNoWallets) {
    return <NoWalletEmpty />;
  }

  // All wallets bound state
  if (allWalletsBound) {
    return <AllWalletsBoundEmpty />;
  }

  // Normal state with wallet selector and form
  return (
    <YStack mt="$-3">
      <YStack pb="$5" gap="$1">
        <SizableText size="$bodyMd" color="$textSubdued">
          {intl.formatMessage({
            id: ETranslations.referral_wallet_code_wallet,
          })}
        </SizableText>
        <Select
          title={intl.formatMessage({
            id: ETranslations.referral_select_wallet,
          })}
          items={walletItems}
          value={selectedWalletId}
          onChange={(walletId) => {
            if (typeof walletId === 'string') {
              setSelectedWalletId(walletId);
            }
          }}
          renderTrigger={() => (
            <XStack
              gap="$2"
              ai="center"
              py="$2"
              px="$3"
              bg="$bgSubdued"
              borderRadius="$2"
              borderWidth={StyleSheet.hairlineWidth}
              borderColor="$borderSubdued"
              jc="space-between"
            >
              <XStack gap="$2" ai="center">
                <WalletAvatar wallet={selectedWallet} size="$6" />
                <SizableText size="$bodyLg">{selectedWallet?.name}</SizableText>
              </XStack>
              <Icon name="ChevronDownSmallOutline" color="$iconSubdued" />
            </XStack>
          )}
        />
        {isSelectedWalletBound ? (
          <SizableText size="$bodySm" color="$textCritical" mt="$1">
            {intl.formatMessage({
              id: ETranslations.referral_already_bound,
            })}
          </SizableText>
        ) : null}
      </YStack>
      <YStack gap="$1">
        <SizableText size="$bodyMd" color="$textSubdued">
          {intl.formatMessage({
            id: ETranslations.referral_apply_referral_code_code,
          })}
        </SizableText>
        <Form form={form}>
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
              placeholder={intl.formatMessage({
                id: ETranslations.referral_wallet_code_placeholder,
              })}
              maxLength={30}
            />
          </Form.Field>
        </Form>
      </YStack>
      <SizableText mt="$3" size="$bodyMd" color="$textSubdued">
        {intl.formatMessage({
          id: ETranslations.referral_wallet_code_desc,
        })}
      </SizableText>
      <Dialog.Footer
        showCancelButton={false}
        onConfirm={handleConfirm}
        onConfirmText={intl.formatMessage({
          id: ETranslations.global_apply,
        })}
        confirmButtonProps={{
          disabled: isSelectedWalletBound || !selectedWallet,
        }}
      />
    </YStack>
  );
}
