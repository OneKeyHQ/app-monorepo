import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';
import { useDebouncedCallback } from 'use-debounce';

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
} from '@onekeyhq/components';
import { useForm } from '@onekeyhq/components/src/hooks/useForm';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { WalletAvatar } from '@onekeyhq/kit/src/components/WalletAvatar/WalletAvatar';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useSignatureConfirm } from '@onekeyhq/kit/src/hooks/useSignatureConfirm';
import type { INavigationToMessageConfirmParams } from '@onekeyhq/kit/src/hooks/useSignatureConfirm';
import { useInvitePostConfig } from '@onekeyhq/kit/src/views/ReferFriends/hooks/useInvitePostConfig';
import {
  DEFAULT_INVITEE_DISCOUNT_TEXT,
  formatInviteeDiscountFromConfig,
  isInviteeDiscountDeclined,
} from '@onekeyhq/kit/src/views/ReferFriends/utils';
import { readInstallReferralAutoFillCode } from '@onekeyhq/kit/src/views/ReferFriends/utils/installReferralAutoFill';
import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';
import type { OneKeyError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

import { ReferFriendsTestIDs } from '../../testIDs';

import {
  AllWalletsBoundEmpty,
  AllWalletsUnavailableEmpty,
} from './AllWalletsBoundEmpty';
import { NoWalletEmpty } from './NoWalletEmpty';
import { useFetchWalletsWithBoundStatus } from './useFetchWalletsWithBoundStatus';
import { useGetReferralCodeWalletInfo } from './useGetReferralCodeWalletInfo';

import type { IReferralCodeWalletInfo } from './types';

// Upper bound on holding the invite hint back for the configured rebate. A
// cached config answers at once; a fresh install has to fetch, and past this
// the hint commits to the default rebate rather than keep waiting.
const INVITEE_DISCOUNT_WAIT_MS = 1500;

// Upper bound on waiting for a startup install-referrer capture still in
// flight when the dialog opens.
const INSTALL_REFERRAL_CAPTURE_WAIT_MS = 10_000;

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

  // Fetch cached invite code on mount
  const { result: cachedCode, isLoading: isCachedCodeLoading } =
    usePromiseResult(
      async () => {
        const code =
          await backgroundApiProxy.serviceReferralCode.getCachedInviteCode();
        return code;
      },
      [],
      // `watchLoading` is what makes `isLoading` update at all — without it
      // the draft gate below would never open. `undefinedResultIfError` keeps
      // a failed read from surfacing as an unhandled rejection.
      { watchLoading: true, undefinedResultIfError: true },
    );

  // Until the saved draft has been read, an empty field does not yet mean
  // "nothing to restore", so the install-referrer suggestion stays hidden —
  // otherwise a quick Apply could bind it over a draft about to appear. Keyed
  // off the read settling rather than off its value, so a failed read still
  // opens the gate instead of hiding the invite for the whole dialog session.
  //
  // Opened only after the restore effect below has run, not merely once the
  // read settles: the read result and the field value land in different
  // renders, and the render in between would flash the hint over the draft.
  const [isDraftSettled, setIsDraftSettled] = useState(false);

  // Update form default value when cachedCode loads
  useEffect(() => {
    if (isCachedCodeLoading !== false) {
      return;
    }
    if (cachedCode && !form.getValues('referralCode')) {
      form.setValue('referralCode', cachedCode);
    }
    setIsDraftSettled(true);
  }, [cachedCode, isCachedCodeLoading, form]);

  // Save to cache when input changes (debounced)
  const handleCodeChange = useDebouncedCallback((value: string) => {
    void backgroundApiProxy.serviceReferralCode.setCachedInviteCode(value);
  }, 500);

  // Watch form changes
  useEffect(() => {
    const subscription = form.watch((value) => {
      if (value.referralCode !== undefined) {
        handleCodeChange(value.referralCode);
      }
    });
    return () => subscription.unsubscribe();
  }, [form, handleCodeChange]);

  // Invite code recovered from the store install referrer. Offered as a hint
  // rather than pre-filled: it came from the download link, not from this
  // user, and binding is irreversible, so accepting it stays a deliberate tap.
  // Anything already in the field — a deeplink code or a saved draft — wins.
  //
  // Settings, Perps and Swap can open this before the startup capture has
  // landed on a fresh install, so wait it out like the onboarding dialog does.
  // A late hint only appears under an empty field, so this can wait longer.
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);
  const { result: suggestedCode } = usePromiseResult(
    async () =>
      readInstallReferralAutoFillCode({
        timeoutMs: INSTALL_REFERRAL_CAPTURE_WAIT_MS,
        isActive: () => isMountedRef.current,
      }),
    [],
    { undefinedResultIfError: true },
  );

  const { postConfig, isSettled: isPostConfigSettled } = useInvitePostConfig({
    enabled: Boolean(suggestedCode),
  });

  // The rebate line is decided once per dialog — when the config settles or
  // when the wait runs out, whichever comes first — and the hint stays hidden
  // until then. It therefore never shows one rate and swaps to another under a
  // user about to make an irreversible bind. Only a timeout or a failed read
  // falls back to the default; `null` means the server declined a rebate, so
  // none is shown. The one change allowed afterwards is below: withdrawing the
  // promise when a refreshed config declines it.
  const [inviteeDiscount, setInviteeDiscount] = useState<
    string | null | undefined
  >(undefined);
  useEffect(() => {
    if (!suggestedCode || inviteeDiscount !== undefined) {
      return undefined;
    }
    if (isPostConfigSettled) {
      const discount = postConfig?.inviteeDiscount;
      setInviteeDiscount(
        isInviteeDiscountDeclined(discount)
          ? null
          : formatInviteeDiscountFromConfig(discount),
      );
      return undefined;
    }
    const timer = setTimeout(() => {
      setInviteeDiscount(DEFAULT_INVITEE_DISCOUNT_TEXT);
    }, INVITEE_DISCOUNT_WAIT_MS);
    return () => clearTimeout(timer);
  }, [suggestedCode, inviteeDiscount, isPostConfigSettled, postConfig]);

  // One-way: the first answer can be a cached config, and a refresh that says
  // the rebate is paused must not leave a rate promised above the bind. Only
  // "rate → no rate" is allowed; a different positive rate never swaps in.
  useEffect(() => {
    if (
      typeof inviteeDiscount === 'string' &&
      isInviteeDiscountDeclined(postConfig?.inviteeDiscount)
    ) {
      setInviteeDiscount(null);
    }
  }, [inviteeDiscount, postConfig]);

  const currentCode = form.watch('referralCode');
  const isSuggestionVisible =
    isDraftSettled &&
    Boolean(suggestedCode) &&
    inviteeDiscount !== undefined &&
    !currentCode?.trim();

  // Once per mount: the hint's visibility flips on every keystroke that
  // empties or fills the field, and that is not a new impression.
  const isOfferLoggedRef = useRef(false);
  useEffect(() => {
    if (!isSuggestionVisible || isOfferLoggedRef.current) {
      return;
    }
    isOfferLoggedRef.current = true;
    defaultLogger.referral.page.installReferralOffered({
      surface: 'bind_dialog',
    });
  }, [isSuggestionVisible]);

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

    return walletsWithStatus.map((item) => {
      let description: string | undefined;
      const isDisabled =
        item.status === 'bound' ||
        item.status === 'expired' ||
        item.status === 'unknown';
      if (item.status === 'bound') {
        description = intl.formatMessage({
          id: ETranslations.referral_wallet_bind_code_finish,
        });
      } else if (item.status === 'expired') {
        description = intl.formatMessage({
          id: ETranslations.referral_not_applicable,
        });
      } else if (item.status === 'unknown') {
        description = intl.formatMessage({
          id: ETranslations.global_unknown,
        });
      }
      return {
        label: item.wallet.name,
        value: item.wallet.id,
        leading: <WalletAvatar wallet={item.wallet} size="$6" />,
        description,
        disabled: isDisabled,
      };
    });
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

  // Check if all wallets are unavailable (bound, window expired, or unknown)
  const allWalletsUnavailable = useMemo(() => {
    if (!walletsWithStatus || walletsWithStatus.length === 0) return false;
    return walletsWithStatus.every(
      (w) =>
        w.status === 'bound' ||
        w.status === 'expired' ||
        w.status === 'unknown',
    );
  }, [walletsWithStatus]);

  // Check if the selected wallet is already bound
  const isSelectedWalletBound = useMemo(() => {
    if (!walletsWithStatus || !selectedWalletId) return false;
    const found = walletsWithStatus.find(
      (w) => w.wallet.id === selectedWalletId,
    );
    return found?.isBound ?? false;
  }, [walletsWithStatus, selectedWalletId]);

  // Check if the selected wallet is not bindable (window expired)
  const isSelectedWalletNotBindable = useMemo(() => {
    if (!walletsWithStatus || !selectedWalletId) return false;
    const found = walletsWithStatus.find(
      (w) => w.wallet.id === selectedWalletId,
    );
    return found?.status === 'expired';
  }, [walletsWithStatus, selectedWalletId]);

  const isSelectedWalletStatusUnknown = useMemo(() => {
    if (!walletsWithStatus || !selectedWalletId) return false;
    const found = walletsWithStatus.find(
      (w) => w.wallet.id === selectedWalletId,
    );
    return found?.status === 'unknown';
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
        // An empty field while the hint is showing means "accept the
        // invite" — Apply is the only affordance the hint offers.
        const typedCode = form.getValues().referralCode?.trim();
        const referralCode =
          typedCode || (isSuggestionVisible ? suggestedCode : undefined);
        if (!referralCode) {
          preventClose?.();
          return;
        }
        await confirmBindReferralCode({
          referralCode,
          preventClose,
          walletInfo,
          navigationToMessageConfirmAsync,
          onSuccess,
        });
        // Retire the attribution if this was the inviter's code, however it
        // got into the field — accepted from the hint or typed by hand.
        try {
          const isInviterCode =
            await backgroundApiProxy.serviceReferralCode.consumeInstallReferralIfBound(
              { referralCode },
            );
          // Consume however the code got into the field, but only count an
          // acceptance when this dialog actually showed the invite.
          if (isInviterCode && isOfferLoggedRef.current) {
            defaultLogger.referral.page.installReferralAccepted({
              surface: 'bind_dialog',
            });
          }
        } catch {
          // Worst case the invite is offered once more, and the server
          // rejects the duplicate bind.
        }
      } catch (e) {
        const err = e as OneKeyError<
          unknown,
          {
            message?: string;
            messageId?: string;
          }
        >;
        if (err.className === 'OneKeyServerApiError' && err.message) {
          const isBindWindowExpired =
            err.data?.messageId === 'exceeded_bind_window' ||
            err.data?.message === 'exceeded_bind_window' ||
            err.message === 'exceeded_bind_window';
          form.setError('referralCode', {
            message: isBindWindowExpired
              ? intl.formatMessage({
                  id: ETranslations.referral_not_applicable_desc,
                })
              : err.message,
          });
        }
        throw e;
      }
    },
    [
      form,
      suggestedCode,
      isSuggestionVisible,
      walletInfo,
      confirmBindReferralCode,
      navigationToMessageConfirmAsync,
      onSuccess,
      intl,
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

  // All wallets unavailable state
  if (allWalletsUnavailable) {
    return <AllWalletsUnavailableEmpty />;
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
          testID="refer-friends-select"
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
        {(() => {
          if (isSelectedWalletBound) {
            return (
              <SizableText size="$bodySm" color="$textCritical" mt="$1">
                {intl.formatMessage({
                  id: ETranslations.referral_already_bound,
                })}
              </SizableText>
            );
          }
          if (isSelectedWalletNotBindable) {
            return (
              <SizableText size="$bodySm" color="$textSubdued" mt="$1">
                {intl.formatMessage({
                  id: ETranslations.referral_not_applicable_desc,
                })}
              </SizableText>
            );
          }
          if (isSelectedWalletStatusUnknown) {
            return (
              <SizableText size="$bodySm" color="$textSubdued" mt="$1">
                {intl.formatMessage({
                  id: ETranslations.global_unknown,
                })}
              </SizableText>
            );
          }
          return null;
        })()}
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
              // A visible suggestion supplies the value on submit, so an
              // empty field is legitimate. Empty values bypass `pattern` in
              // react-hook-form, making `required` the only check that would
              // otherwise reject them.
              required: !isSuggestionVisible,
              pattern: {
                value: /^[a-zA-Z0-9]{1,30}$/,
                message: intl.formatMessage({
                  id: ETranslations.referral_invalid_code,
                }),
              },
            }}
          >
            <Input
              testID={ReferFriendsTestIDs.referralCodeInput}
              placeholder={intl.formatMessage({
                id: ETranslations.referral_wallet_code_placeholder,
              })}
              maxLength={30}
            />
          </Form.Field>
        </Form>
        {isSuggestionVisible ? (
          // Sits below the input rather than in its placeholder: the field
          // stays visibly empty, so Apply reads as accepting the invite
          // instead of submitting something the user typed.
          <SizableText size="$bodySm" color="$textSubdued">
            {inviteeDiscount
              ? intl.formatMessage(
                  { id: ETranslations.referral_invited_by_code__desc },
                  { code: suggestedCode, amount: inviteeDiscount },
                )
              : // The server declined a rebate: name the invite, promise none.
                intl.formatMessage(
                  { id: ETranslations.referral_modal_been_invited_title_code },
                  { ABCDEF: suggestedCode },
                )}
          </SizableText>
        ) : null}
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
          disabled:
            isSelectedWalletBound ||
            isSelectedWalletNotBindable ||
            isSelectedWalletStatusUnknown ||
            !selectedWallet,
        }}
      />
    </YStack>
  );
}
