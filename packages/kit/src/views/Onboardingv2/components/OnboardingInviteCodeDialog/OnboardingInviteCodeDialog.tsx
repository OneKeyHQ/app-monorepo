import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  AnimatePresence,
  Button,
  DialogContainer,
  EInPageDialogType,
  Form,
  Icon,
  Illustration,
  Input,
  Keyboard,
  SizableText,
  Spinner,
  Stack,
  Theme,
  Toast,
  XStack,
  YStack,
  useDialogInstance,
  useForm,
  useInPageDialog,
} from '@onekeyhq/components';
import { ANIMATE_ONLY_OPACITY_TRANSFORM } from '@onekeyhq/components/src/utils/animationConstants';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useSignatureConfirm } from '@onekeyhq/kit/src/hooks/useSignatureConfirm';
import { useGetReferralCodeWalletInfo } from '@onekeyhq/kit/src/views/ReferFriends/hooks/useWalletBoundReferralCode/useGetReferralCodeWalletInfo';
import { useWalletBoundReferralCode } from '@onekeyhq/kit/src/views/ReferFriends/hooks/useWalletBoundReferralCode/useWalletBoundReferralCode';
import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';
import type { OneKeyError } from '@onekeyhq/shared/src/errors';
import { EOneKeyErrorClassNames } from '@onekeyhq/shared/src/errors/types/errorTypes';
import { ETranslations } from '@onekeyhq/shared/src/locale/enum/translations';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

type IOnboardingInviteCodeDialogFormValues = {
  referralCode: string;
};

// Idle → submitting (loading spinner) → success (accent button + check icon) → close.
// On error: reverts to idle so the user can retry.
type IBindStatus = 'idle' | 'submitting' | 'success';

// How long the success state stays visible before the dialog auto-closes.
// Long enough that the user has time to register the check icon as a
// distinct stage (not just a flash before close).
const SUCCESS_HOLD_MS = 900;
// Threshold-based loading pattern (Linear / Stripe / GitHub style):
// If the bind RPC settles within SHOW_SPINNER_AFTER_MS, skip the spinner
// entirely and go straight idle → success. 250ms is at the upper edge of
// the "feels instant" perception window — long enough to dodge unnecessary
// spinners on a fast network, short enough that the user isn't left
// wondering whether the tap registered.
const SHOW_SPINNER_AFTER_MS = 250;
// Minimum time the spinner must be on-screen from the moment we trigger
// `setBindStatus('submitting')` to the moment we trigger 'success'.
//
// AnimatePresence runs in `exitBeforeEnter`, so 'submitting' only becomes
// visible *after* the outgoing 'apply' label finishes exiting:
//
//   T=0     setBindStatus('submitting'); 'apply' starts exit (~200ms quick)
//   T=200   'apply' unmounts; 'submitting' starts enter (~200ms quick)
//   T=400   spinner fully visible
//   T=...   transition out to 'success' (another 200+200ms)
//
// To get ~200ms of stable, readable spinner we need MIN_HOLD ≈ 200 + 200 +
// 200 ≈ 600ms. Anything shorter and the spinner is mid-enter when we yank
// it back out — which was causing the "sometimes the spinner doesn't show
// up" reports.
const SPINNER_MIN_HOLD_AFTER_SHOWN_MS = 600;

// Direction matches the reference (Sonner / Linear "slot-machine" pattern):
// the new label slides down from above; the old label slides down off the
// bottom. Both elements travel in the same direction, which reads as
// continuous motion rather than a swap.
const APPLY_ENTER_STYLE = {
  y: -8,
  opacity: 0,
} as const;
const APPLY_EXIT_STYLE = {
  y: 8,
  opacity: 0,
} as const;

const REFERRAL_CODE_PATTERN = /^[a-zA-Z0-9]+$/;

// Shared transition props for the three Apply-button label variants
// (idle text, submitting spinner, success check). Keeps the three
// <AnimatePresence> branches structurally identical so the only
// difference between them is the child element.
const APPLY_LABEL_MOTION_PROPS = {
  animation: 'quick',
  animateOnly: ANIMATE_ONLY_OPACITY_TRANSFORM,
  enterStyle: APPLY_ENTER_STYLE,
  exitStyle: APPLY_EXIT_STYLE,
} as const;

function OnboardingInviteCodeDialogContent({
  wallet,
  onDone,
}: {
  wallet: IDBWallet;
  onDone: () => void;
}) {
  const intl = useIntl();
  const dialogInstance = useDialogInstance();
  // `bindStatus` drives what the Apply button *renders* (Apply text /
  // spinner / check icon). `isPending` is a separate signal that the bind
  // RPC is in flight — used to disable buttons immediately, even before
  // the spinner is shown (during the SHOW_SPINNER_AFTER_MS grace window).
  const [bindStatus, setBindStatus] = useState<IBindStatus>('idle');
  const [isPending, setIsPending] = useState(false);
  // Timestamp (Date.now()) of when we flipped state to 'submitting'.
  // `> 0` doubles as "spinner has been shown" — we don't need a separate
  // boolean ref. Used to compute how much of SPINNER_MIN_HOLD_AFTER_SHOWN_MS
  // is left once the RPC resolves; when the RPC is already slower than the
  // hold the remaining wait collapses to 0.
  const spinnerShownAtRef = useRef(0);
  const isSuccess = bindStatus === 'success';

  // Guard for async work that might resolve after the component unmounts
  // (timer firing during the grace window, `await timerUtils.wait(...)`
  // continuations during min-hold or success-hold). Without this, the
  // dialog can run `setBindStatus`/`dialogInstance.close()` against a
  // stale instance if the user dismisses mid-flight.
  const isMountedRef = useRef(true);
  const pendingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      isMountedRef.current = false;
      if (pendingTimerRef.current) {
        clearTimeout(pendingTimerRef.current);
        pendingTimerRef.current = null;
      }
    },
    [],
  );

  // Intentionally NOT reading from / writing to the shared invite-code
  // cache (`serviceReferralCode.getCachedInviteCode`). The cache is
  // designed for the Settings InviteCodeDialog, which users open
  // repeatedly to recover an in-progress draft. Onboarding shows once
  // after a fresh wallet setup: pre-filling a stale code from a previous
  // wallet or from an abandoned Settings session would be misleading and
  // could nudge the user into Apply'ing a code that isn't theirs.
  const form = useForm<IOnboardingInviteCodeDialogFormValues>({
    defaultValues: { referralCode: '' },
    mode: 'onChange',
  });

  // Empty value bypasses `pattern` in react-hook-form, so `required` is the
  // only check that catches an empty Apply. Reuse the invalid-code message —
  // it reads sensibly for both empty and malformed input and avoids a new
  // i18n key. Length upper bound is enforced by `maxLength={30}` on Input.
  const codeRules = useMemo(() => {
    const message = intl.formatMessage({
      id: ETranslations.referral_invalid_code,
    });
    return {
      required: { value: true, message },
      pattern: { value: REFERRAL_CODE_PATTERN, message },
    };
  }, [intl]);

  const getReferralCodeWalletInfo = useGetReferralCodeWalletInfo();
  const { confirmBindReferralCode } = useWalletBoundReferralCode({
    entry: 'modal',
  });

  const { result: walletInfo } = usePromiseResult(async () => {
    const r = await getReferralCodeWalletInfo(wallet.id);
    return r ?? null;
  }, [wallet.id, getReferralCodeWalletInfo]);

  const { navigationToMessageConfirmAsync } = useSignatureConfirm({
    accountId: walletInfo?.accountId ?? '',
    networkId: walletInfo?.networkId ?? '',
  });

  const handleSkip = useCallback(async () => {
    if (isPending || isSuccess) return;
    defaultLogger.referral.page.onboardingDialogSkipped({
      walletId: wallet.id,
      walletType: wallet.type,
    });
    onDone();
    await dialogInstance.close();
  }, [isPending, isSuccess, onDone, dialogInstance, wallet.id, wallet.type]);

  const handleApply = useCallback(async () => {
    if (isPending || isSuccess) return;

    // Keep footer + inline error visible while the bind RPC is in flight.
    Keyboard.dismiss();

    const isValid = await form.trigger();
    if (!isValid) return;
    const referralCode = form.getValues().referralCode?.trim();
    if (!referralCode) return;

    defaultLogger.referral.page.onboardingDialogSubmitted({
      walletId: wallet.id,
      walletType: wallet.type,
      codeLength: referralCode.length,
    });

    setIsPending(true);
    spinnerShownAtRef.current = 0;

    // Reveal the spinner only after the grace window. If the RPC settles
    // before then, this timer is cancelled and the user never sees a
    // spinner — the button transitions straight from Apply → Check.
    const spinnerTimer = setTimeout(() => {
      if (!isMountedRef.current) return;
      spinnerShownAtRef.current = Date.now();
      setBindStatus('submitting');
    }, SHOW_SPINNER_AFTER_MS);
    pendingTimerRef.current = spinnerTimer;

    // Spinner must stay on screen for the remainder of
    // SPINNER_MIN_HOLD_AFTER_SHOWN_MS measured from when we *set*
    // 'submitting', not from now. When the RPC is genuinely slow the
    // spinner has already been visible long enough and the remainder
    // collapses to 0. Fast path (spinner never shown) skips entirely.
    const waitOutSpinnerMinHold = async () => {
      if (spinnerShownAtRef.current === 0) return;
      const elapsed = Date.now() - spinnerShownAtRef.current;
      const remaining = SPINNER_MIN_HOLD_AFTER_SHOWN_MS - elapsed;
      if (remaining > 0) {
        await timerUtils.wait(remaining);
      }
    };

    try {
      await confirmBindReferralCode({
        referralCode,
        walletInfo,
        navigationToMessageConfirmAsync,
        // Suppress both default Toasts — success is communicated by the
        // animated confirm button below, and error is surfaced inline via
        // form.setError(). Showing a Toast on top would be redundant.
        suppressSuccessToast: true,
        suppressErrorToast: true,
        source: 'onboarding_dialog',
      });
      clearTimeout(spinnerTimer);
      pendingTimerRef.current = null;
      await waitOutSpinnerMinHold();
      if (!isMountedRef.current) return;

      setBindStatus('success');
      await timerUtils.wait(SUCCESS_HOLD_MS);
      if (!isMountedRef.current) return;

      onDone();
      await dialogInstance.close();
    } catch (e) {
      clearTimeout(spinnerTimer);
      pendingTimerRef.current = null;
      await waitOutSpinnerMinHold();
      if (!isMountedRef.current) return;

      const err = e as OneKeyError<
        unknown,
        { message?: string; messageId?: string }
      >;
      defaultLogger.referral.page.onboardingDialogBindFailed({
        walletId: wallet.id,
        walletType: wallet.type,
        errorReason: err?.message || 'unknown',
      });

      // Surface server validation errors inline in the form (Form.Field
      // renders the error message slot automatically). Mirrors the pattern
      // used by the existing Settings InviteCodeDialog.
      const isServerApiError =
        err?.className === EOneKeyErrorClassNames.OneKeyServerApiError;
      if (isServerApiError && err?.message) {
        const isBindWindowExpired =
          err?.data?.messageId === 'exceeded_bind_window' ||
          err?.data?.message === 'exceeded_bind_window' ||
          err?.message === 'exceeded_bind_window';
        form.setError('referralCode', {
          message: isBindWindowExpired
            ? intl.formatMessage({
                id: ETranslations.referral_not_applicable_desc,
              })
            : err.message,
        });
      } else if (err?.message) {
        // Non-business errors (network failure, signature cancel, unknown)
        // surface as a Toast. `suppressErrorToast: true` above keeps the
        // business-error path inline-only; this branch matches the Settings
        // InviteCodeDialog UX where confirmBindReferralCode's default Toast
        // catches the same failures.
        Toast.error({ title: err.message });
      }

      setBindStatus('idle');
      setIsPending(false);
      spinnerShownAtRef.current = 0;
    }
  }, [
    isPending,
    isSuccess,
    form,
    wallet.id,
    wallet.type,
    confirmBindReferralCode,
    walletInfo,
    navigationToMessageConfirmAsync,
    onDone,
    dialogInstance,
    intl,
  ]);

  return (
    <Form form={form}>
      <Form.Field name="referralCode" rules={codeRules}>
        <Input
          size="large"
          $gtMd={{ size: 'medium' }}
          placeholder={intl.formatMessage({
            id: ETranslations.onboarding_invite_code_dialog_input_placeholder,
          })}
          maxLength={30}
          autoCapitalize="none"
          testID="onboarding-invite-code-input"
        />
      </Form.Field>
      {/* Custom footer: matches Dialog.Footer's layout but renders the Apply
          button with childrenAsText=false so we can swap its label in/out via
          AnimatePresence when the bind succeeds. */}
      <XStack gap="$2.5">
        <Button
          flexGrow={1}
          flexBasis={0}
          $md={{ size: 'large' }}
          disabled={isPending || isSuccess}
          // Override Button's built-in disabled fade. The disabled state here
          // is a logical "busy" lock (not an "unavailable" hint), so we want
          // the surface to look identical to the enabled state. Also: no
          // `animation` prop here so the surface itself stays static —
          // only the inner label animates.
          opacity={1}
          onPress={handleSkip}
          testID="onboarding-invite-code-skip"
        >
          {intl.formatMessage({ id: ETranslations.global_skip })}
        </Button>
        <Button
          flexGrow={1}
          flexBasis={0}
          $md={{ size: 'large' }}
          variant="primary"
          disabled={isPending || isSuccess}
          // Same rationale as Skip: keep the primary surface fully opaque
          // and free of transition through pending / success states; the
          // inner label animation is the only feedback we want.
          opacity={1}
          onPress={handleApply}
          childrenAsText={false}
          testID="onboarding-invite-code-apply"
        >
          {/* 3-state label: idle (Apply) → submitting (Spinner) → success
              (Check). Each state is wrapped in <Stack> so Tamagui animation
              props apply to an animated component (Icon and Spinner are
              react-native-svg based and would otherwise trigger
              "[Reanimated] passing animated style to non-animated component"
              on the native side). */}
          <AnimatePresence exitBeforeEnter>
            {(() => {
              if (isSuccess) {
                return (
                  <Stack key="success" {...APPLY_LABEL_MOTION_PROPS}>
                    <Icon
                      name="CheckRadioSolid"
                      size="$5"
                      color="$iconInverse"
                    />
                  </Stack>
                );
              }
              if (bindStatus === 'submitting') {
                return (
                  <Stack key="submitting" {...APPLY_LABEL_MOTION_PROPS}>
                    <Spinner size="small" color="$iconInverse" />
                  </Stack>
                );
              }
              return (
                <SizableText
                  key="apply"
                  {...APPLY_LABEL_MOTION_PROPS}
                  size="$bodyLgMedium"
                  color="$textInverse"
                >
                  {intl.formatMessage({ id: ETranslations.global_apply })}
                </SizableText>
              );
            })()}
          </AnimatePresence>
        </Button>
      </XStack>
    </Form>
  );
}

export type IShowOnboardingInviteCodeDialog = (opts: {
  wallet: IDBWallet;
  onDone: () => void;
}) => void;

// Anchor the dialog to the current modal page's portal (via useInPageDialog)
// instead of the global Dialog.show portal. The HW signature confirmation
// modal is pushed onto the same modal navigator, so an in-page-anchored
// dialog lets the signature page naturally layer on top of it. The global
// portal would otherwise occlude the signature page and block interaction.
// `Theme name="dark"` is kept as defense-in-depth — the modal navigator
// portal currently mounts inside the OnboardingV2 dark Theme wrapper
// (routes/Modal/Navigator.tsx), so this is redundant today but cheap.
export function useShowOnboardingInviteCodeDialog(): IShowOnboardingInviteCodeDialog {
  const intl = useIntl();
  const dialog = useInPageDialog(EInPageDialogType.inModalPage);

  return useCallback(
    ({ wallet, onDone }: { wallet: IDBWallet; onDone: () => void }) => {
      defaultLogger.referral.page.onboardingDialogShown({
        walletId: wallet.id,
        walletType: wallet.type,
      });

      let onDoneCalled = false;
      const callOnDoneOnce = () => {
        if (onDoneCalled) return;
        onDoneCalled = true;
        onDone();
      };

      dialog.show({
        dialogContainer: ({ ref }) => (
          <Theme name="dark">
            <DialogContainer
              ref={ref}
              showExitButton={false}
              showFooter={false}
              floatingPanelProps={{
                onOpenAutoFocus: (e) => e.preventDefault(),
              }}
              title={intl.formatMessage({
                id: ETranslations.onboarding_invite_code_dialog_title,
              })}
              description={intl.formatMessage({
                id: ETranslations.onboarding_invite_code_dialog_description,
              })}
              renderIcon={
                <YStack m={-13}>
                  <Illustration name="Referred" size={90} />
                </YStack>
              }
              renderContent={
                <OnboardingInviteCodeDialogContent
                  wallet={wallet}
                  onDone={callOnDoneOnce}
                />
              }
              onClose={async () => undefined}
            />
          </Theme>
        ),
        onClose: () => {
          // Safety net for system-level dismiss paths (overlay tap, Android
          // hardware back, Esc key). If onDone() already ran via Skip or
          // Apply this no-ops; otherwise we still need to let the caller
          // proceed (fire Skipped + onDone).
          if (!onDoneCalled) {
            defaultLogger.referral.page.onboardingDialogSkipped({
              walletId: wallet.id,
              walletType: wallet.type,
            });
            callOnDoneOnce();
          }
        },
      });
    },
    [dialog, intl],
  );
}
