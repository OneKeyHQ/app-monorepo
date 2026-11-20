import { type ReactNode, useCallback, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import { Alert } from '@onekeyhq/components/src/actions/Alert';
import { Toast } from '@onekeyhq/components/src/actions/Toast';
import { Checkbox } from '@onekeyhq/components/src/forms/Checkbox';
import { type IInputRef, Input } from '@onekeyhq/components/src/forms/Input';
import { Anchor } from '@onekeyhq/components/src/primitives/Anchor';
import { Button } from '@onekeyhq/components/src/primitives/Button';
import { Icon } from '@onekeyhq/components/src/primitives/Icon';
import { SizableText } from '@onekeyhq/components/src/primitives/SizeableText';
import { Spinner } from '@onekeyhq/components/src/primitives/Spinner';
import { XStack, YStack } from '@onekeyhq/components/src/primitives/Stack';
import { OneKeyOAuthButton } from '@onekeyhq/kit/src/components/OneKeyAuth/OneKeyOAuthButton';
import { OnboardingIconBadge } from '@onekeyhq/kit/src/views/Onboardingv2/components/OnboardingIconBadge';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import {
  getOtpButtonState,
  useCountdown,
  useOtpInputFocus,
  useOtpResend,
} from './otpInputState';
import { KEYLESS_DELETION_SUPPORT_EMAIL } from './paths';
import { SignInErrorDialog } from './SignInErrorDialog';
import { useDeletionFlow } from './useDeletionFlow';

import type { IProvider, IResult, IWarningCode } from './protocol';
import type {
  IBusinessAuth,
  IFlowErrorCode,
  IResultHistory,
} from './useDeletionFlow';

type IFlow = ReturnType<typeof useDeletionFlow>;

const acknowledgementLabels: Record<IWarningCode, ETranslations> = {
  recovery_lost: ETranslations.keyless_deletion_ack_recovery__action,
  new_wallet_separate: ETranslations.keyless_deletion_ack_new_wallet__action,
};

const resultTitles: Record<
  Exclude<IResult['status'], 'processing' | 'completed'>,
  ETranslations
> = {
  not_submitted: ETranslations.keyless_deletion_not_submitted__title,
  manual_review_required: ETranslations.keyless_deletion_manual_review__title,
};

const resultScopes: Record<
  'processing' | 'manual_review_required',
  ETranslations
> = {
  processing: ETranslations.keyless_deletion_deleting__desc,
  manual_review_required: ETranslations.keyless_deletion_manual_review__desc,
};

const signInErrorTitles: Partial<Record<IFlowErrorCode, ETranslations>> = {
  IDENTITY_MISMATCH: ETranslations.keyless_deletion_account_mismatch__title,
  AUTH_EXPIRED: ETranslations.keyless_deletion_sign_in_expired__title,
  AUTH_INVALID: ETranslations.keyless_deletion_sign_in_expired__title,
};

const errorMessages: Partial<Record<IFlowErrorCode, ETranslations>> = {
  IDENTITY_MISMATCH: ETranslations.keyless_deletion_account_mismatch__desc,
  OTP_EXPIRED: ETranslations.keyless_deletion_code_expired__msg,
  OTP_SEND_UNCERTAIN: ETranslations.keyless_deletion_code_uncertain__msg,
  OTP_SEND_RATE_LIMITED: ETranslations.keyless_deletion_rate_limited__msg,
  RATE_LIMITED: ETranslations.keyless_deletion_rate_limited__msg,
  AUTH_EXPIRED: ETranslations.keyless_deletion_sign_in_expired__desc,
  AUTH_INVALID: ETranslations.keyless_deletion_sign_in_expired__desc,
  INVITATION_UNAVAILABLE:
    ETranslations.keyless_deletion_link_unavailable__title,
  SERVICE_UNAVAILABLE: ETranslations.keyless_deletion_service_unavailable__msg,
  UNSUPPORTED_CONFIRMATION:
    ETranslations.keyless_deletion_unsupported_warnings__msg,
  // The server message normally explains this; the fallback asks for a refresh.
  CONFIRMATION_CHANGED:
    ETranslations.keyless_deletion_unsupported_warnings__msg,
  CONFIRMATION_REQUIRED:
    ETranslations.keyless_deletion_confirmation_required__msg,
  DELETION_DISABLED: ETranslations.keyless_deletion_automatic_unavailable__msg,
  INVALID_REQUEST: ETranslations.keyless_deletion_invalid_request__msg,
  POPUP_BLOCKED: ETranslations.keyless_deletion_popup_blocked__msg,
};

function platformName(provider: IProvider) {
  return provider === 'google' ? 'Google' : 'Apple';
}

type IActionProps = {
  'data-testid'?: string;
  variant?: 'primary' | 'secondary' | 'destructive' | 'quiet';
  disabled?: boolean;
  loading?: boolean;
  onClick?: () => void;
  children: ReactNode;
};

function Action({
  'data-testid': testId,
  variant = 'primary',
  onClick,
  ...props
}: IActionProps) {
  return (
    <Button
      testID={testId}
      size={variant === 'quiet' ? 'small' : 'large'}
      variant={variant === 'quiet' ? 'tertiary' : variant}
      onPress={onClick}
      {...props}
    />
  );
}

function ScopeRow({
  icon,
  color,
  text,
}: {
  icon: 'XCircleSolid' | 'CheckRadioSolid';
  color: '$iconCritical' | '$iconSuccess';
  text: string;
}) {
  return (
    <XStack gap="$2.5" alignItems="flex-start">
      {/* Match the first text line's height so the icon centres on it. */}
      <XStack h={24} alignItems="center" aria-hidden>
        <Icon name={icon} color={color} size="$5" />
      </XStack>
      <SizableText size="$bodyLg" flex={1}>
        {text}
      </SizableText>
    </XStack>
  );
}

export function SupportContact({ centered }: { centered: boolean }) {
  const intl = useIntl();
  return (
    <SizableText
      size="$bodySm"
      color="$textSubdued"
      textAlign={centered ? 'center' : undefined}
      testID="support-contact"
    >
      {intl.formatMessage(
        { id: ETranslations.keyless_deletion_contact__desc },
        {
          email: (
            <Anchor
              key="email"
              href={`mailto:${KEYLESS_DELETION_SUPPORT_EMAIL}`}
              target="_self"
              showExternalIndicator={false}
              textDecorationLine="underline"
              color="$textInteractive"
              size="$bodySm"
            >
              {KEYLESS_DELETION_SUPPORT_EMAIL}
            </Anchor>
          ),
        },
      )}
    </SizableText>
  );
}

function useCopyText() {
  const intl = useIntl();
  return useCallback(
    async (text: string) => {
      try {
        // Write directly in the click handler so failures are reported, not
        // hidden behind an optimistic "copied" toast.
        await globalThis.navigator.clipboard.writeText(text);
        Toast.success({
          title: intl.formatMessage({ id: ETranslations.global_copied }),
        });
        return true;
      } catch {
        // Callers keep the text visible for manual copying instead.
        return false;
      }
    },
    [intl],
  );
}

function CopyPageLink() {
  const intl = useIntl();
  const copyText = useCopyText();
  const [manualLink, setManualLink] = useState<string>();
  return (
    <YStack gap="$2" alignItems="flex-start">
      <Button
        testID="copy-page-link"
        width="auto"
        size="small"
        variant="secondary"
        icon="Copy3Outline"
        onPress={() => {
          const link = globalThis.location.href;
          void copyText(link).then((copied) =>
            setManualLink(copied ? undefined : link),
          );
        }}
      >
        {intl.formatMessage({ id: ETranslations.browser_copy_link })}
      </Button>
      {manualLink ? (
        <SizableText
          size="$bodySm"
          className="keyless-result-reference"
          userSelect="all"
          testID="page-link-fallback"
        >
          {manualLink}
        </SizableText>
      ) : null}
    </YStack>
  );
}

function SendCode({ flow, onSend }: { flow: IFlow; onSend: () => void }) {
  const intl = useIntl();
  const { screen, busy } = flow;
  const visible =
    screen.step === 'email' ||
    (screen.step === 'confirm' && !screen.uncertainDeletion);
  const resend = useOtpResend({
    deadline: visible ? (screen.resendAt ?? 0) : 0,
    busy,
    visible,
  });
  if (!resend.visible) return null;
  const { seconds, disabled } = resend;

  let label = intl.formatMessage({ id: ETranslations.prime_code_resend });
  if (seconds > 0) {
    label = intl.formatMessage(
      { id: ETranslations.resend_code_countdown__action },
      { seconds },
    );
  } else if (busy && screen.step !== 'confirm') {
    label = intl.formatMessage({
      id: ETranslations.keyless_deletion_sending__msg,
    });
  }
  return (
    <XStack>
      <Button
        testID="send-code"
        width="auto"
        size="small"
        variant="tertiary"
        disabled={disabled}
        onPress={() => {
          onSend();
          flow.sendDeletionOtp();
        }}
      >
        {label}
      </Button>
    </XStack>
  );
}

function ConfirmStep({
  flow,
  otpError,
  sendError,
  submitError,
  onAction,
}: {
  flow: IFlow;
  otpError?: ReactNode;
  sendError?: ReactNode;
  submitError?: ReactNode;
  onAction: (action: 'send' | 'submit') => void;
}) {
  const intl = useIntl();
  const { screen, busy } = flow;
  const review = screen.step === 'confirm' ? screen : undefined;
  const cooldown = useCountdown(review?.deleteRetryAt ?? 0);
  const outcomeCooldown = useCountdown(review?.outcomeCheckAfter ?? 0);
  const challenge = review?.challenge;
  const challengeId = challenge?.challengeId;
  const [codeInputState, setCodeInputState] = useState({
    challengeId,
    value: '',
  });
  const confirmationVersion =
    screen.step === 'email' || screen.step === 'confirm'
      ? screen.info.confirmationVersion
      : undefined;
  const confirmationReset = review?.confirmationReset;
  const [consent, setConsent] = useState({
    challengeId,
    confirmationVersion,
    confirmationReset,
    codes: [] as IWarningCode[],
  });
  const challengeTime = useCountdown(review?.challengeExpiresAt ?? 0);
  const codeInputRef = useRef<IInputRef>(null);
  useOtpInputFocus(codeInputRef, {
    enabled: !!challengeId && !busy,
    focusKey: challengeId,
  });
  if (screen.step !== 'email' && screen.step !== 'confirm') {
    return null;
  }
  const { info } = screen;
  const enteredCode =
    codeInputState.challengeId === challengeId ? codeInputState.value : '';
  const acknowledgedCodes =
    consent.challengeId === challengeId &&
    consent.confirmationVersion === confirmationVersion &&
    consent.confirmationReset === confirmationReset
      ? consent.codes
      : [];
  const acknowledged = info.warningCodes.every((code) =>
    acknowledgedCodes.includes(code),
  );
  const expired = !!challenge && challengeTime === 0;
  const submitButton = getOtpButtonState({
    busy,
    ready:
      !!challenge &&
      !review?.outcomeNeedsSignIn &&
      !expired &&
      acknowledged &&
      enteredCode.length > 0 &&
      cooldown === 0,
  });
  function submit() {
    if (submitButton.disabled) {
      return;
    }
    onAction('submit');
    flow.submit(enteredCode, acknowledgedCodes);
  }

  const consentDescription = { 'aria-describedby': 'deletion-warnings' };
  const codeInput = (
    <Input
      ref={codeInputRef}
      nativeID="deletion-code-input"
      testID="deletion-code"
      aria-label={intl.formatMessage({
        id: ETranslations.prime_verification_code,
      })}
      aria-describedby={otpError ? 'deletion-code-server-error' : undefined}
      aria-invalid={otpError ? true : undefined}
      error={!!otpError}
      placeholder={intl.formatMessage({
        id: ETranslations.prime_enter_verification_code,
      })}
      autoComplete="one-time-code"
      inputMode="numeric"
      value={enteredCode}
      disabled={busy || !challenge}
      onChangeText={(text) => {
        setCodeInputState({
          challengeId,
          value: text,
        });
        flow.editCode();
      }}
      onSubmitEditing={submit}
    />
  );
  // Remaining validity, not the original lifetime; omitted once expired.
  const minutes = challengeTime > 0 ? Math.ceil(challengeTime / 60) : 0;
  const delivery = challenge ? (
    <SizableText
      color="$textSubdued"
      size="$bodySm"
      aria-live="polite"
      testID="otp-delivery-status"
    >
      {minutes
        ? intl.formatMessage(
            { id: ETranslations.keyless_deletion_code_sent__desc },
            { email: challenge.maskedEmail, minutes },
          )
        : intl.formatMessage(
            { id: ETranslations.prime_sent_to },
            { email: challenge.maskedEmail },
          )}
    </SizableText>
  ) : null;
  // The two core consequences are the consent checkboxes, so the box only
  // covers scope, what is kept and the pre-check.
  const warningItems = [
    ETranslations.keyless_deletion_irreversible__desc,
    ...(info.recreationPolicy === 'blocked'
      ? [ETranslations.keyless_deletion_recreation_blocked__desc]
      : []),
    ETranslations.keyless_deletion_retained__desc,
    ETranslations.keyless_deletion_precheck__desc,
  ];
  const warnings = (
    <Alert
      type="warning"
      icon="ErrorOutline"
      alignItems="flex-start"
      id="deletion-warnings"
      title={intl.formatMessage({
        id: ETranslations.keyless_deletion_scope__title,
      })}
      descriptionComponent={
        <YStack gap="$2" testID="deletion-warning-items">
          {warningItems.map((id) => (
            <XStack key={id} gap="$2">
              <SizableText color="$textCautionStrong" aria-hidden>
                •
              </SizableText>
              <SizableText color="$textCautionStrong" flex={1}>
                {intl.formatMessage({ id })}
              </SizableText>
            </XStack>
          ))}
        </YStack>
      }
    />
  );
  return (
    <YStack gap="$4" testID="deletion-otp-form">
      {screen.confirmationUpdated ? (
        <div role="status" data-testid="confirmation-updated">
          <SizableText color="$textCautionStrong">
            {intl.formatMessage({
              id: ETranslations.keyless_deletion_warnings_updated__msg,
            })}
          </SizableText>
        </div>
      ) : null}
      <YStack gap="$2">
        {delivery}
        {challenge ? (
          <SizableText
            color="$textSubdued"
            size="$bodySm"
            testID="otp-delivery-hint"
          >
            {intl.formatMessage({
              id: ETranslations.keyless_deletion_email_hint__desc,
            })}
          </SizableText>
        ) : null}
        {codeInput}
        {otpError}
        {expired && !otpError ? (
          <SizableText color="$textCritical" role="alert">
            {intl.formatMessage({
              id: ETranslations.keyless_deletion_code_expired__msg,
            })}
          </SizableText>
        ) : null}
        {sendError}
        <SendCode flow={flow} onSend={() => onAction('send')} />
      </YStack>
      {warnings}
      <YStack gap="$1">
        {info.warningCodes.map((warning) => {
          const checked = acknowledgedCodes.includes(warning);
          return (
            <Checkbox
              key={warning}
              testID={
                warning === 'new_wallet_separate'
                  ? 'acknowledge-new-wallet'
                  : 'acknowledge'
              }
              aria-hidden
              label={intl.formatMessage({
                id: acknowledgementLabels[warning],
              })}
              labelProps={{ variant: '$bodyMd' }}
              value={checked}
              disabled={busy || !challenge}
              onChange={(value) => {
                const nextChecked = value === true;
                const codes = info.warningCodes.filter((code) =>
                  code === warning
                    ? nextChecked
                    : acknowledgedCodes.includes(code),
                );
                setConsent({
                  challengeId,
                  confirmationVersion,
                  confirmationReset,
                  codes,
                });
              }}
              containerProps={{
                render: 'button',
                role: 'checkbox',
                'aria-checked': checked,
                ...consentDescription,
                'aria-disabled': busy || !challenge,
                bg: '$transparent',
                borderWidth: 0,
                width: '100%',
                className: 'keyless-consent',
                focusVisibleStyle: {
                  outlineWidth: 2,
                  outlineStyle: 'solid',
                  outlineColor: '$focusRing',
                },
              }}
            />
          );
        })}
      </YStack>
      {submitError}
      <Action
        data-testid="submit-deletion"
        variant="destructive"
        disabled={submitButton.disabled}
        loading={flow.submittingDelete}
        onClick={submit}
      >
        {intl.formatMessage({
          id: ETranslations.keyless_deletion_delete__action,
        })}
      </Action>
      {review?.uncertainDeletion ? (
        <YStack gap="$2" testID="uncertain-deletion">
          <SizableText color="$textSubdued" role="status">
            {intl.formatMessage({
              id:
                review.uncertainDeletion === 'not_found'
                  ? ETranslations.keyless_deletion_status_unknown__desc
                  : ETranslations.keyless_deletion_unknown__desc,
            })}
          </SizableText>
          <Action
            data-testid="check-delete-outcome"
            variant="secondary"
            disabled={busy || outcomeCooldown > 0}
            onClick={flow.checkDeleteOutcome}
          >
            {outcomeCooldown > 0
              ? intl.formatMessage(
                  {
                    id: ETranslations.keyless_deletion_check_countdown__action,
                  },
                  { seconds: outcomeCooldown },
                )
              : intl.formatMessage({
                  id: ETranslations.keyless_deletion_check_result__title,
                })}
          </Action>
        </YStack>
      ) : null}
    </YStack>
  );
}

function ReferenceNumber({
  reference,
  showHint,
}: {
  reference: string;
  showHint: boolean;
}) {
  const intl = useIntl();
  const copyText = useCopyText();
  return (
    <YStack
      w="100%"
      borderTopWidth="$px"
      borderColor="$borderSubdued"
      pt="$4"
      gap="$1"
      alignItems="center"
    >
      <SizableText size="$bodySm" color="$textSubdued" textAlign="center">
        {intl.formatMessage({
          id: ETranslations.keyless_deletion_reference__title,
        })}
      </SizableText>
      <XStack gap="$2" alignItems="center" justifyContent="center">
        <SizableText
          size="$bodySmMedium"
          textAlign="center"
          className="keyless-result-reference"
          testID="support-reference"
        >
          {reference}
        </SizableText>
        <Button
          testID="copy-support-reference"
          size="small"
          variant="tertiary"
          icon="Copy3Outline"
          aria-label={intl.formatMessage({ id: ETranslations.global_copy })}
          onPress={() => {
            void copyText(reference);
          }}
        />
      </XStack>
      {showHint ? (
        <SizableText size="$bodySm" color="$textSubdued" textAlign="center">
          {intl.formatMessage({
            id: ETranslations.keyless_deletion_reference_hint__desc,
          })}
        </SizableText>
      ) : null}
    </YStack>
  );
}

function ResultStep({ flow }: { flow: IFlow }) {
  const intl = useIntl();
  const { locale } = intl;
  const { screen, busy, resultCheckAfter } = flow;
  const cooldown = useCountdown(resultCheckAfter);
  if (screen.step !== 'result') {
    return null;
  }
  const { result, accepted, proof, resultCheckFailed } = screen;
  const needsSignIn = !proof;
  const known = result && result.status !== 'not_submitted' ? result : accepted;
  const shareStatus =
    result?.status === 'completed' ? result.currentShareStatus : undefined;
  const deleted = shareStatus === 'absent';
  let resultDetail = resultCheckFailed
    ? ETranslations.keyless_deletion_status_unknown__desc
    : ETranslations.keyless_deletion_unknown__desc;
  if (!resultCheckFailed && result?.status === 'not_submitted') {
    resultDetail = ETranslations.keyless_deletion_not_submitted__title;
  }
  let scopeDetail: ETranslations | undefined;
  if (known?.status === 'completed') {
    if (deleted) scopeDetail = ETranslations.keyless_deletion_deleted__desc;
    else if (shareStatus === 'present')
      scopeDetail = ETranslations.keyless_deletion_new_data__desc;
    else
      scopeDetail = busy
        ? ETranslations.keyless_deletion_checking__msg
        : ETranslations.keyless_deletion_status_unknown__desc;
  } else if (known) {
    scopeDetail = resultScopes[known.status];
  }
  const checkLabel =
    cooldown > 0
      ? intl.formatMessage(
          { id: ETranslations.keyless_deletion_check_countdown__action },
          { seconds: cooldown },
        )
      : undefined;
  return (
    <>
      {known ? (
        <YStack gap="$4" alignItems="center">
          <YStack gap="$2">
            <SizableText
              size="$bodyLg"
              textAlign="center"
              testID="deletion-result-detail"
            >
              {scopeDetail ? intl.formatMessage({ id: scopeDetail }) : null}
            </SizableText>
            {resultCheckFailed && known.status !== 'completed' ? (
              <SizableText color="$textSubdued" textAlign="center">
                {intl.formatMessage({
                  id: ETranslations.keyless_deletion_status_unknown__desc,
                })}
              </SizableText>
            ) : null}
            {known.status === 'completed' ? (
              <SizableText color="$textSubdued" textAlign="center">
                {intl.formatMessage(
                  {
                    id: ETranslations.keyless_deletion_completed_at__desc,
                  },
                  {
                    time: new Intl.DateTimeFormat(locale, {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    }).format(new Date(known.completedAt)),
                  },
                )}
              </SizableText>
            ) : null}
          </YStack>
          {known.supportReference ? (
            <ReferenceNumber
              reference={known.supportReference}
              showHint={known.status !== 'manual_review_required'}
            />
          ) : null}
          {deleted ? (
            <SizableText
              color="$textSubdued"
              textAlign="center"
              testID="keep-wallet-hint"
            >
              {intl.formatMessage({
                id: ETranslations.keyless_deletion_keep_wallet__desc,
              })}
            </SizableText>
          ) : null}
        </YStack>
      ) : (
        (resultCheckFailed || result?.status !== 'not_submitted') && (
          <SizableText color="$textSubdued">
            {intl.formatMessage({ id: resultDetail })}
          </SizableText>
        )
      )}
      {needsSignIn ? (
        <Action
          data-testid="reauthenticate"
          disabled={busy || cooldown > 0}
          onClick={flow.reauthenticate}
        >
          {checkLabel ??
            intl.formatMessage({
              id: ETranslations.keyless_deletion_sign_in_again__action,
            })}
        </Action>
      ) : null}
      {!needsSignIn && !deleted && shareStatus !== 'present' ? (
        <Action
          data-testid="check-status"
          disabled={busy || cooldown > 0}
          onClick={flow.checkStatus}
        >
          {checkLabel ??
            intl.formatMessage({
              id: ETranslations.keyless_deletion_check_status__action,
            })}
        </Action>
      ) : null}
    </>
  );
}

function Flow({
  token,
  history,
  business,
}: {
  token: string;
  history: IResultHistory;
  business: IBusinessAuth;
}) {
  const intl = useIntl();
  const flow = useDeletionFlow(token, business, history);
  const { screen, busy, error } = flow;
  const [dismissedError, setDismissedError] = useState<IFlow['error']>();
  const [selectedProvider, setSelectedProvider] = useState<IProvider>();
  const [lastAction, setLastAction] = useState<'send' | 'submit'>();

  const signInCooldown = useCountdown(
    screen.step === 'identity' ? (error?.retryAt ?? 0) : 0,
  );
  const verifying = screen.step === 'email' || screen.step === 'confirm';
  let errorMessage = error?.userMessage;
  if (error && !errorMessage) {
    const errorKey = errorMessages[error.code];
    let fallbackKey = ETranslations.global_unknown_error_retry_message;
    if (errorKey) fallbackKey = errorKey;
    else if (error.code === 'OTP_INVALID')
      fallbackKey = ETranslations.prime_invalid_verification_code;
    errorMessage = intl.formatMessage({ id: fallbackKey });
  }
  const dialogKey = error && signInErrorTitles[error.code];
  const dialogTitle = dialogKey
    ? intl.formatMessage({ id: dialogKey })
    : undefined;
  const errorReference = error?.supportReference ? (
    <SizableText color="$textSubdued" size="$bodySm">
      {intl.formatMessage({
        id: ETranslations.keyless_deletion_reference__title,
      })}{' '}
      <code>{error.supportReference}</code>
    </SizableText>
  ) : null;
  const inlineOtpError =
    verifying &&
    (error?.code === 'OTP_INVALID' || error?.code === 'OTP_EXPIRED');
  const popupError = error?.code === 'POPUP_BLOCKED';
  const identityPopupError = popupError && screen.step === 'identity';
  // Before a code exists every error comes from sending it; afterwards the
  // last action tells a failed resend apart from a failed submission.
  const sendErrorCode =
    screen.step === 'email' ||
    lastAction === 'send' ||
    error?.code === 'OTP_SEND_UNCERTAIN' ||
    error?.code === 'OTP_SEND_RATE_LIMITED';
  const flowError =
    error &&
    !dialogTitle &&
    !error.usesSharedToast &&
    (errorMessage || errorReference) ? (
      <div
        id={inlineOtpError ? 'deletion-code-server-error' : undefined}
        role="alert"
        data-testid="flow-error"
        data-error-code={error.code}
      >
        <YStack gap="$2">
          {errorMessage ? (
            <SizableText color="$textCritical" size="$bodyMd">
              {errorMessage}
            </SizableText>
          ) : null}
          {error.code === 'OTP_SEND_UNCERTAIN' && error.userMessage ? (
            <SizableText color="$textSubdued">{error.userMessage}</SizableText>
          ) : null}
          {errorReference}
          {error.code === 'POPUP_BLOCKED' ? <CopyPageLink /> : null}
        </YStack>
      </div>
    ) : null;

  let heading: string | undefined;
  let body;
  let showContact = true;
  switch (screen.step) {
    case 'loading':
      heading = error
        ? intl.formatMessage({
            id: ETranslations.keyless_deletion_link_load_failed__title,
          })
        : undefined;
      showContact = !!error;
      body = error ? (
        <Action onClick={() => flow.open()}>
          {intl.formatMessage({ id: ETranslations.global_retry })}
        </Action>
      ) : (
        <YStack
          alignItems="center"
          role="status"
          aria-label={intl.formatMessage({
            id: ETranslations.tray_loading_title,
          })}
          testID="invitation-loading"
        >
          <Spinner size="large" aria-hidden />
        </YStack>
      );
      break;
    case 'identity': {
      const used = screen.info.status === 'used';
      const { allowedProvider } = screen.info;
      const platform = platformName(allowedProvider);
      heading = intl.formatMessage({
        id: used
          ? ETranslations.keyless_deletion_check_result__title
          : ETranslations.keyless_deletion__title,
      });
      const checking = busy && selectedProvider === allowedProvider;
      body = (
        <>
          <YStack gap="$4" testID="sign-in-intro">
            {used ? null : (
              <YStack gap="$3" testID="sign-in-scope">
                <ScopeRow
                  icon="XCircleSolid"
                  color="$iconCritical"
                  text={intl.formatMessage({
                    id: ETranslations.keyless_deletion_will_delete__desc,
                  })}
                />
                <ScopeRow
                  icon="CheckRadioSolid"
                  color="$iconSuccess"
                  text={intl.formatMessage({
                    id: ETranslations.keyless_deletion_not_affected__desc,
                  })}
                />
              </YStack>
            )}
            <SizableText color="$textSubdued">
              {intl.formatMessage(
                {
                  id: used
                    ? ETranslations.keyless_deletion_check_result__desc
                    : ETranslations.keyless_deletion_sign_in__desc,
                },
                { platform },
              )}
            </SizableText>
          </YStack>
          <OneKeyOAuthButton
            provider={allowedProvider}
            testID={`sign-in-${allowedProvider}`}
            label={
              checking
                ? intl.formatMessage({
                    id: ETranslations.keyless_deletion_verifying__msg,
                  })
                : intl.formatMessage(
                    { id: ETranslations.continue_with_social_platform },
                    { platform },
                  )
            }
            disabled={busy || signInCooldown > 0}
            loading={checking}
            onPress={() => {
              setSelectedProvider(allowedProvider);
              flow.signIn(allowedProvider);
            }}
          />
          {identityPopupError ? flowError : null}
        </>
      );
      break;
    }
    case 'email':
    case 'confirm':
      heading = intl.formatMessage({
        id: ETranslations.keyless_deletion_confirm__title,
      });
      body = (
        <ConfirmStep
          flow={flow}
          otpError={inlineOtpError ? flowError : undefined}
          sendError={sendErrorCode ? flowError : undefined}
          submitError={inlineOtpError || sendErrorCode ? undefined : flowError}
          onAction={setLastAction}
        />
      );
      break;
    case 'result': {
      const status = screen.result?.status ?? screen.accepted?.status;
      let headingKey = ETranslations.keyless_deletion_result_pending__title;
      if (status === 'completed') {
        headingKey =
          screen.result?.status === 'completed' &&
          screen.result.currentShareStatus === 'absent'
            ? ETranslations.keyless_deletion_complete__title
            : ETranslations.keyless_deletion_original_completed__title;
      } else if (status === 'processing') {
        headingKey = ETranslations.global_processing;
      } else if (status) {
        headingKey = resultTitles[status];
      }
      heading = intl.formatMessage({ id: headingKey });
      body = <ResultStep flow={flow} />;
      break;
    }
    case 'unavailable':
      heading = intl.formatMessage({
        id: ETranslations.keyless_deletion_link_unavailable__title,
      });
      body = (
        <SizableText color="$textSubdued">
          {intl.formatMessage({
            id: ETranslations.keyless_deletion_link_unavailable__desc,
          })}
        </SizableText>
      );
      break;
    case 'target-changed':
      heading = intl.formatMessage({
        id: ETranslations.keyless_deletion_wallet_changed__title,
      });
      body = (
        <SizableText color="$textSubdued">
          {intl.formatMessage({
            id: ETranslations.keyless_deletion_wallet_changed__desc,
          })}
        </SizableText>
      );
      break;
    case 'policy-pending':
    case 'rejected':
      heading = intl.formatMessage({
        id: ETranslations.keyless_deletion_cannot_continue__title,
      });
      body = (
        <SizableText color="$textSubdued">
          {intl.formatMessage({
            id: ETranslations.keyless_deletion_cannot_continue__desc,
          })}
        </SizableText>
      );
      break;
  }
  const result = screen.step === 'result' ? screen.result : undefined;
  const isAppComplete =
    result?.status === 'completed' && result.currentShareStatus === 'absent';
  const largeHeading = isAppComplete;
  const centerHeading =
    screen.step === 'result' &&
    ((result && result.status !== 'not_submitted') || !!screen.accepted);
  return (
    <section
      aria-labelledby={heading ? 'flow-heading' : undefined}
      data-testid="flow"
      data-step={screen.step}
      data-status={
        screen.step === 'result'
          ? (result?.status ?? screen.accepted?.status ?? 'unknown')
          : undefined
      }
      data-current-share-status={
        result?.status === 'completed'
          ? (result.currentShareStatus ?? 'unknown')
          : undefined
      }
      data-result-id={
        result && 'resultId' in result ? result.resultId : undefined
      }
    >
      <YStack gap="$4">
        {isAppComplete ? (
          <OnboardingIconBadge
            icon="CheckmarkSolid"
            iconColor="$iconOnColor"
            bg="$bgSuccessStrong"
            p="$5"
            alignSelf="center"
            mb="$0"
            aria-hidden
          />
        ) : null}
        {heading ? (
          <SizableText
            render="h1"
            id="flow-heading"
            aria-live="polite"
            size={largeHeading ? '$heading2xl' : '$headingXl'}
            textAlign={centerHeading ? 'center' : undefined}
            m="$0"
          >
            {heading}
          </SizableText>
        ) : null}
        {verifying || identityPopupError ? null : flowError}
        {error?.usesSharedToast ? errorReference : null}
        {error && dialogTitle && error !== dismissedError ? (
          <SignInErrorDialog
            title={dialogTitle}
            description={errorMessage}
            references={errorReference}
            onDismiss={() => setDismissedError(error)}
          />
        ) : null}
        {body}
        {showContact ? <SupportContact centered={centerHeading} /> : null}
      </YStack>
    </section>
  );
}

export function DeletionPage({
  business,
  invitationToken,
}: {
  business: IBusinessAuth;
  invitationToken: string;
}) {
  const [history] = useState<IResultHistory>(() => new Map());
  return (
    <YStack render="main" minWidth={0}>
      <Flow token={invitationToken} history={history} business={business} />
    </YStack>
  );
}
