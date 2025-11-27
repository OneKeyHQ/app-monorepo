import { useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  Dialog,
  EInPageDialogType,
  Form,
  Icon,
  Input,
  Select,
  SizableText,
  Toast,
  XStack,
  YStack,
  useForm,
  useInPageDialog,
} from '@onekeyhq/components';
import { autoFixPersonalSignMessage } from '@onekeyhq/core/src/chains/evm/sdkEvm/signMessage';
import type { IUnsignedMessage } from '@onekeyhq/core/src/types';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import {
  FIRST_BTC_TAPROOT_ADDRESS_PATH,
  FIRST_EVM_ADDRESS_PATH,
} from '@onekeyhq/shared/src/engine/engineConsts';
import type { OneKeyError } from '@onekeyhq/shared/src/errors';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import errorToastUtils from '@onekeyhq/shared/src/errors/utils/errorToastUtils';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { EMnemonicType } from '@onekeyhq/shared/src/utils/secret';
import {
  EMessageTypesBtc,
  EMessageTypesEth,
} from '@onekeyhq/shared/types/message';

import { WalletAvatar } from '../../../components/WalletAvatar/WalletAvatar';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { useSignatureConfirm } from '../../../hooks/useSignatureConfirm';

import type { INavigationToMessageConfirmParams } from '../../../hooks/useSignatureConfirm';

type IReferralCodeWalletInfo = {
  address: string;
  networkId: string;
  pubkey?: string;
  isBtcOnlyWallet: boolean;
  accountId: string;
  walletId: string;
  wallet: IDBWallet;
};

export function useGetReferralCodeWalletInfo() {
  return useCallback(async (queryWalletId: string | undefined) => {
    if (!queryWalletId) {
      return null;
    }

    const walletId = queryWalletId;
    let wallet: IDBWallet | undefined;

    if (
      !accountUtils.isHdWallet({ walletId }) &&
      !accountUtils.isHwWallet({ walletId })
    ) {
      return null;
    }

    try {
      wallet = await backgroundApiProxy.serviceAccount.getWallet({
        walletId,
      });
      if (accountUtils.isHwHiddenWallet({ wallet })) {
        return null;
      }
    } catch {
      return null;
    }

    const isBtcOnlyWallet =
      await backgroundApiProxy.serviceHardware.isBtcOnlyWallet({ walletId });

    if (isBtcOnlyWallet) {
      const firstBtcTaprootAccountId = `${walletId}--${FIRST_BTC_TAPROOT_ADDRESS_PATH}`;
      try {
        const networkId = getNetworkIdsMap().btc;
        const account = await backgroundApiProxy.serviceAccount.getAccount({
          accountId: firstBtcTaprootAccountId,
          networkId,
        });
        if (!account) {
          return null;
        }
        return {
          wallet,
          walletId,
          networkId,
          accountId: firstBtcTaprootAccountId,
          address: account.address,
          pubkey: account.pub,
          isBtcOnlyWallet,
        };
      } catch {
        return null;
      }
    }

    // get first evm account, if btc only firmware, get first btc taproot account
    const firstEvmAccountId = `${walletId}--${FIRST_EVM_ADDRESS_PATH}`;
    try {
      const networkId = getNetworkIdsMap().eth;
      const account = await backgroundApiProxy.serviceAccount.getAccount({
        accountId: firstEvmAccountId,
        networkId,
      });
      if (!account) {
        return null;
      }
      return {
        wallet,
        walletId,
        networkId,
        accountId: firstEvmAccountId,
        address: account.address,
        pubkey: account.pub,
        isBtcOnlyWallet,
      };
    } catch {
      return null;
    }
  }, []);
}

function InviteCode({
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

  // Fetch all wallets with bound status
  const { result: walletsWithStatus } = usePromiseResult(async () => {
    const { wallets } = await backgroundApiProxy.serviceAccount.getWallets({
      nestedHiddenWallets: false,
    });

    // Filter valid wallets (HD and hardware wallets)
    const validWallets = wallets.filter(
      (w) =>
        (accountUtils.isHdWallet({ walletId: w.id }) ||
          accountUtils.isHwWallet({ walletId: w.id })) &&
        !accountUtils.isHwHiddenWallet({ wallet: w }),
    );

    // Get bound status for each wallet
    const walletsWithBoundStatus = await Promise.all(
      validWallets.map(async (w) => {
        const referralCodeInfo =
          await backgroundApiProxy.serviceReferralCode.getWalletReferralCode({
            walletId: w.id,
          });
        return {
          wallet: w,
          isBound: referralCodeInfo?.isBound ?? false,
        };
      }),
    );

    return walletsWithBoundStatus;
  }, []);

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
      />
    </YStack>
  );
}

export function useWalletBoundReferralCode({
  entry,
  mnemonicType,
}: {
  entry?: 'tab' | 'modal';
  mnemonicType?: EMnemonicType;
} = {}) {
  const intl = useIntl();
  const [shouldBondReferralCode, setShouldBondReferralCode] = useState<
    boolean | undefined
  >(undefined);
  const getReferralCodeWalletInfo = useGetReferralCodeWalletInfo();

  const getReferralCodeBondStatus = useCallback(
    async ({
      walletId,
      skipIfTimeout = false,
    }: {
      walletId: string | undefined;
      skipIfTimeout?: boolean;
    }) => {
      if (mnemonicType === EMnemonicType.TON) {
        return false;
      }

      const walletInfo = await getReferralCodeWalletInfo(walletId);
      if (!walletInfo) {
        return false;
      }
      const { address, networkId } = walletInfo;

      let alreadyBound = false;
      let isTimeout = false;

      try {
        if (skipIfTimeout) {
          const timeoutMs = 3000;
          let timeoutId: ReturnType<typeof setTimeout> | undefined;
          const timeoutPromise = new Promise<never>((_, reject) => {
            timeoutId = setTimeout(() => {
              isTimeout = true;
              reject(new Error('Request timeout'));
            }, timeoutMs);
          });

          try {
            // Race between the API call and timeout
            alreadyBound = await Promise.race([
              backgroundApiProxy.serviceReferralCode.checkWalletIsBoundReferralCode(
                {
                  address,
                  networkId,
                },
              ),
              timeoutPromise,
            ]);
          } finally {
            if (timeoutId) {
              clearTimeout(timeoutId);
            }
          }
        } else {
          // No timeout, just make the request
          alreadyBound =
            await backgroundApiProxy.serviceReferralCode.checkWalletIsBoundReferralCode(
              {
                address,
                networkId,
              },
            );
        }
      } catch (error) {
        console.log(
          '===>>> getReferralCodeBondStatus error, treating as not bound:',
          error,
        );
        alreadyBound = false;
      }

      // Always execute setWalletReferralCode regardless of timeout
      try {
        await backgroundApiProxy.serviceReferralCode.setWalletReferralCode({
          walletId: walletInfo.walletId,
          referralCodeInfo: {
            walletId: walletInfo.walletId,
            address: walletInfo.address,
            networkId: walletInfo.networkId,
            pubkey: walletInfo.pubkey ?? '',
            isBound: alreadyBound,
          },
        });
      } catch (error) {
        console.log('===>>> setWalletReferralCode error:', error);
      }

      if (isTimeout && skipIfTimeout) {
        return false;
      }

      if (alreadyBound) {
        return false;
      }
      setShouldBondReferralCode(true);
      return true;
    },
    [mnemonicType, getReferralCodeWalletInfo],
  );

  const confirmBindReferralCode = useCallback(
    async ({
      referralCode,
      preventClose,
      walletInfo,
      navigationToMessageConfirmAsync,
      onSuccess,
    }: {
      referralCode: string;
      walletInfo: IReferralCodeWalletInfo | null | undefined;
      navigationToMessageConfirmAsync: (
        params: INavigationToMessageConfirmParams,
      ) => Promise<string>;
      preventClose?: () => void;
      onSuccess?: () => void;
    }) => {
      try {
        if (!walletInfo) {
          throw new OneKeyLocalError('Invalid Wallet');
        }
        let unsignedMessage: string | undefined;

        unsignedMessage =
          await backgroundApiProxy.serviceReferralCode.getBoundReferralCodeUnsignedMessage(
            {
              address: walletInfo.address,
              networkId: walletInfo.networkId,
              inviteCode: referralCode,
            },
          );
        console.log('===>>> unsignedMessage: ', unsignedMessage);

        if (walletInfo.networkId === getNetworkIdsMap().eth) {
          unsignedMessage = autoFixPersonalSignMessage({
            message: unsignedMessage,
          });
        }

        const isBtcOnlyWallet =
          walletInfo.isBtcOnlyWallet &&
          networkUtils.isBTCNetwork(walletInfo.networkId);

        const finalUnsignedMessage: IUnsignedMessage = isBtcOnlyWallet
          ? {
              type: EMessageTypesBtc.ECDSA,
              message: unsignedMessage,
              sigOptions: {
                noScriptType: true,
              },
              payload: {
                isFromDApp: false,
              },
            }
          : {
              type: EMessageTypesEth.PERSONAL_SIGN,
              message: unsignedMessage,
              payload: [unsignedMessage, walletInfo.address],
            };

        let signedMessage: string | null;

        signedMessage =
          await backgroundApiProxy.serviceReferralCode.autoSignBoundReferralCodeMessageByHDWallet(
            {
              unsignedMessage: finalUnsignedMessage,
              networkId: walletInfo.networkId,
              accountId: walletInfo.accountId,
            },
          );

        if (!signedMessage) {
          signedMessage = await navigationToMessageConfirmAsync({
            accountId: walletInfo.accountId,
            networkId: walletInfo.networkId,
            unsignedMessage: finalUnsignedMessage,
            walletInternalSign: true,
            sameModal: false,
            skipBackupCheck: true,
          });
        }

        if (!signedMessage) {
          throw new OneKeyLocalError('Failed to sign message');
        }

        const bindResult =
          await backgroundApiProxy.serviceReferralCode.boundReferralCodeWithSignedMessage(
            {
              address: walletInfo.address,
              networkId: walletInfo.networkId,
              pubkey: walletInfo.pubkey || undefined,
              referralCode,
              signature: isBtcOnlyWallet
                ? Buffer.from(signedMessage, 'hex').toString('base64')
                : signedMessage,
            },
          );
        console.log('===>>> signedMessage: ', signedMessage);
        if (bindResult) {
          await backgroundApiProxy.serviceReferralCode.setWalletReferralCode({
            walletId: walletInfo.walletId,
            referralCodeInfo: {
              walletId: walletInfo.walletId,
              address: walletInfo.address,
              networkId: walletInfo.networkId,
              pubkey: walletInfo.pubkey ?? '',
              isBound: true,
            },
          });
          Toast.success({
            title: intl.formatMessage({
              id: ETranslations.global_success,
            }),
          });
          onSuccess?.();
        }
      } catch (e) {
        // Disable auto toast for this error to show custom toast without requestId
        errorToastUtils.toastIfErrorDisable(e);

        // Show custom error toast without requestId
        const err = e as OneKeyError;
        if (err?.message) {
          Toast.error({
            title: err.message,
          });
        }

        preventClose?.();
        throw e;
      }
    },
    [intl],
  );

  const dialog = useInPageDialog(
    entry === 'modal'
      ? EInPageDialogType.inModalPage
      : EInPageDialogType.inTabPages,
  );
  const bindWalletInviteCode = useCallback(
    ({
      wallet,
      onSuccess,
      defaultReferralCode,
    }: {
      wallet?: IDBWallet;
      onSuccess?: () => void;
      defaultReferralCode?: string;
    }) => {
      dialog.show({
        showExitButton: true,
        icon: 'GiftOutline',
        tone: 'success',
        title: intl.formatMessage({
          id: ETranslations.referral_wallet_code_title,
        }),
        renderContent: (
          <InviteCode
            wallet={wallet}
            onSuccess={onSuccess}
            confirmBindReferralCode={confirmBindReferralCode}
            defaultReferralCode={defaultReferralCode}
          />
        ),
      });
    },
    [dialog, intl, confirmBindReferralCode],
  );

  return {
    getReferralCodeBondStatus,
    shouldBondReferralCode,
    bindWalletInviteCode,
    confirmBindReferralCode,
  };
}
