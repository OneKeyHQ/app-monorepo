import { type ReactNode, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import { Alert } from '@onekeyhq/components/src/actions/Alert';
import { Checkbox } from '@onekeyhq/components/src/forms/Checkbox';
import { type IInputRef, Input } from '@onekeyhq/components/src/forms/Input';
import {
  getOtpButtonState,
  useCountdown,
  useOtpInputFocus,
  useOtpResend,
} from '@onekeyhq/components/src/hooks/otpInputState';
import { Button } from '@onekeyhq/components/src/primitives/Button';
import { SizableText } from '@onekeyhq/components/src/primitives/SizeableText';
import { Spinner } from '@onekeyhq/components/src/primitives/Spinner';
import { XStack, YStack } from '@onekeyhq/components/src/primitives/Stack';
import { OneKeyOAuthButton } from '@onekeyhq/kit/src/components/OneKeyAuth/OneKeyOAuthButton';
import { OnboardingIconBadge } from '@onekeyhq/kit/src/views/Onboardingv2/components/OnboardingIconBadge';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { messages } from './messages';
import {
  PROVIDERS,
  UPDATED_CONFIRMATION_VERSION,
  WARNING_CODES,
} from './protocol';
import { SignInErrorDialog } from './SignInErrorDialog';
import { useDeletionFlow } from './useDeletionFlow';

import type { IProvider, IResult, IWarningCode } from './protocol';
import type {
  IBusinessAuth,
  IFlowErrorCode,
  IResultHistory,
} from './useDeletionFlow';

type IFlow = ReturnType<typeof useDeletionFlow>;
type ICopy = typeof messages;

type ITextKey = {
  [Key in keyof ICopy]: ICopy[Key] extends string ? Key : never;
}[keyof ICopy];

const warningMessages: Record<IWarningCode, ITextKey> = {
  recovery_lost: 'recoveryLost',
  new_wallet_separate: 'newWalletSeparate',
};

const resultTitles: Record<
  Exclude<IResult['status'], 'processing'>,
  ITextKey
> = {
  not_submitted: 'notSubmitted',
  completed: 'complete',
  manual_review_required: 'manualReview',
};

const resultScopes = {
  processing: 'pendingShare',
  completed: 'deletedShare',
  manual_review_required: 'unknownShare',
} as const;

const signInErrorTitles: Partial<Record<IFlowErrorCode, ITextKey>> = {
  IDENTITY_MISMATCH: 'accountMismatchTitle',
  AUTH_EXPIRED: 'signInExpiredTitle',
  AUTH_INVALID: 'signInExpiredTitle',
};

const errorMessages: Partial<Record<IFlowErrorCode, ITextKey>> = {
  IDENTITY_MISMATCH: 'wrongAccount',
  OTP_EXPIRED: 'expiredCode',
  OTP_SEND_UNCERTAIN: 'uncertainCode',
  RATE_LIMITED: 'rateLimited',
  AUTH_EXPIRED: 'reverify',
  AUTH_INVALID: 'reverify',
  INVITATION_UNAVAILABLE: 'expired',
  SERVICE_UNAVAILABLE: 'serviceUnavailable',
  UNSUPPORTED_CONFIRMATION: 'unsupportedConfirmation',
  CONFIRMATION_REQUIRED: 'confirmationRequired',
  DELETION_DISABLED: 'deletionDisabled',
  INVALID_REQUEST: 'invalidRequest',
};

type IActionProps = {
  'data-testid'?: string;
  variant?: 'primary' | 'secondary' | 'destructive' | 'quiet';
  disabled?: boolean;
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

function SendCode({ flow }: { flow: IFlow }) {
  const intl = useIntl();
  const { screen, busy, error } = flow;
  const resendAt = screen.step === 'confirm' ? screen.resendAt : 0;
  const { seconds, disabled, visible } = useOtpResend({
    deadline: Math.max(resendAt, error?.retryAt ?? 0),
    busy,
    visible: screen.step === 'email' || screen.step === 'confirm',
  });
  if (!visible) return null;

  let label = intl.formatMessage({ id: ETranslations.prime_code_resend });
  if (seconds > 0) {
    label = intl.formatMessage(
      { id: ETranslations.resend_code_countdown__action },
      { seconds },
    );
  } else if (busy && screen.step !== 'confirm') {
    label = messages.sending;
  }
  return (
    <XStack>
      <Button
        testID="send-code"
        width="auto"
        size="small"
        variant="tertiary"
        disabled={disabled}
        onPress={flow.sendDeletionOtp}
      >
        {label}
      </Button>
    </XStack>
  );
}

function ConfirmStep({
  flow,
  otpError,
}: {
  flow: IFlow;
  otpError?: ReactNode;
}) {
  const intl = useIntl();
  const { screen, busy, error } = flow;
  const cooldown = useCountdown(error?.retryAt ?? 0);
  const review = screen.step === 'confirm' ? screen : undefined;
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
      !expired &&
      acknowledged &&
      enteredCode.length > 0 &&
      error?.code !== 'OTP_EXPIRED' &&
      cooldown === 0,
  });
  function submit() {
    if (submitButton.disabled) {
      return;
    }
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
  const delivery = challenge ? (
    <SizableText
      color="$textSubdued"
      size="$bodySm"
      aria-live="polite"
      testID="otp-delivery-status"
    >
      {intl.formatMessage(
        { id: ETranslations.prime_sent_to },
        { email: challenge.maskedEmail },
      )}
    </SizableText>
  ) : null;
  const warnings = (
    <Alert
      type="caution"
      id="deletion-warnings"
      title={messages.share}
      descriptionComponent={
        <YStack gap="$2">
          <SizableText color="$textCautionStrong">
            {messages.keepsLocalWallet} {messages.irreversible}
          </SizableText>
          {WARNING_CODES.map((code) => {
            let warning = messages[warningMessages[code]];
            if (
              code === 'new_wallet_separate' &&
              info.recreationPolicy === 'blocked'
            ) {
              warning = messages.recreationBlocked;
            }
            if (
              code === 'recovery_lost' &&
              info.confirmationVersion === UPDATED_CONFIRMATION_VERSION
            ) {
              warning = messages.updatedRecoveryLost;
            }
            return (
              <SizableText key={code} color="$textCautionStrong">
                {warning}
              </SizableText>
            );
          })}
        </YStack>
      }
    />
  );
  return (
    <YStack gap="$3" testID="deletion-otp-form">
      {screen.confirmationUpdated ? (
        <div role="status" data-testid="confirmation-updated">
          <SizableText color="$textCautionStrong">
            {messages.confirmationUpdated}
          </SizableText>
        </div>
      ) : null}
      <YStack gap="$2">
        {delivery}
        {challenge ? (
          <Alert
            testID="otp-delivery-hint"
            type="info"
            icon="InfoCircleOutline"
            borderWidth={0}
            alignItems="flex-start"
            description={messages.emailHint}
          />
        ) : null}
        <SendCode flow={flow} />
        {codeInput}
        {otpError}
        {expired && !otpError ? (
          <SizableText color="$textCritical" role="alert">
            {messages.expiredCode}
          </SizableText>
        ) : null}
      </YStack>
      {info.warningCodes.map((warning) => {
        const checked = acknowledgedCodes.includes(warning);
        const label =
          warning === 'recovery_lost'
            ? messages.acknowledgeRecovery
            : messages.acknowledgeNewWallet;
        return (
          <Checkbox
            key={warning}
            testID={
              warning === 'new_wallet_separate'
                ? 'acknowledge-new-wallet'
                : 'acknowledge'
            }
            aria-hidden
            label={label}
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
              tag: 'button',
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
      <Action
        data-testid="submit-deletion"
        variant="destructive"
        disabled={submitButton.disabled}
        onClick={submit}
      >
        {messages.delete}
      </Action>
      {warnings}
    </YStack>
  );
}

function ResultStep({ flow }: { flow: IFlow }) {
  const { locale } = useIntl();
  const { screen, busy, error } = flow;
  const checkAfter = screen.step === 'result' ? screen.checkAfter : undefined;
  const cooldown = useCountdown(Math.max(checkAfter ?? 0, error?.retryAt ?? 0));
  if (screen.step !== 'result') {
    return null;
  }
  const { result, accepted, needsSignIn, canRetry } = screen;
  const known = result && result.status !== 'not_submitted' ? result : accepted;
  const resultUnavailable = error?.code === 'INVITATION_UNAVAILABLE';
  let resultDetail = resultUnavailable
    ? messages.recoveryUnavailable
    : messages.unknownDetail;
  if (canRetry) {
    resultDetail = messages.retryDetail;
  } else if (result?.status === 'not_submitted') {
    resultDetail = messages.notSubmitted;
  }
  return (
    <>
      {known ? (
        <YStack gap="$4" alignItems="center">
          <YStack gap="$2">
            <SizableText size="$bodyLg" textAlign="center">
              {messages[resultScopes[known.status]]}
            </SizableText>
            {known.status === 'completed' ? (
              <SizableText color="$textSubdued" textAlign="center">
                {messages.retain}: {messages.retained}
              </SizableText>
            ) : null}
            {known.status === 'completed' ? (
              <SizableText color="$textSubdued" textAlign="center">
                {messages.completedAt(
                  new Intl.DateTimeFormat(locale, {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  }).format(new Date(known.completedAt)),
                )}
              </SizableText>
            ) : null}
          </YStack>
          {known.supportReference ? (
            <YStack
              w="100%"
              borderTopWidth="$px"
              borderColor="$borderSubdued"
              pt="$4"
              gap="$1"
            >
              <SizableText
                size="$bodySm"
                color="$textSubdued"
                textAlign="center"
              >
                {messages.supportReference}
              </SizableText>
              <SizableText
                size="$bodySmMedium"
                textAlign="center"
                className="keyless-result-reference"
                testID="support-reference"
              >
                {known.supportReference}
              </SizableText>
            </YStack>
          ) : null}
        </YStack>
      ) : (
        result?.status !== 'not_submitted' && (
          <SizableText color="$textSubdued">{resultDetail}</SizableText>
        )
      )}
      {needsSignIn ? (
        <Action
          data-testid="reauthenticate"
          disabled={busy}
          onClick={flow.reauthenticate}
        >
          {messages.reauthenticate}
        </Action>
      ) : null}
      {!needsSignIn && result?.status !== 'completed' ? (
        <Action
          data-testid="check-status"
          disabled={busy || cooldown > 0}
          onClick={flow.checkStatus}
        >
          {cooldown > 0
            ? messages.statusCountdown(cooldown)
            : messages.checkStatus}
        </Action>
      ) : null}
      {canRetry && !needsSignIn ? (
        <Action
          data-testid="retry-original"
          variant="secondary"
          disabled={busy}
          onClick={flow.retrySubmit}
        >
          {messages.retryOriginal}
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

  const signInCooldown = useCountdown(
    screen.step === 'identity' || screen.step === 'recovery-identity'
      ? (error?.retryAt ?? 0)
      : 0,
  );
  const verifying = screen.step === 'email' || screen.step === 'confirm';
  const errorKey = error && errorMessages[error.code];
  const errorMessage =
    error &&
    (error.userMessage ??
      (errorKey
        ? messages[errorKey]
        : intl.formatMessage({
            id:
              error.code === 'OTP_INVALID'
                ? ETranslations.prime_invalid_verification_code
                : ETranslations.global_unknown_error_retry_message,
          })));
  const providerLabel = (provider: IProvider) =>
    intl.formatMessage(
      { id: ETranslations.continue_with_social_platform },
      {
        platform: provider === 'google' ? 'Google' : 'Apple',
      },
    );
  const dialogKey = error && signInErrorTitles[error.code];
  const dialogTitle = dialogKey ? messages[dialogKey] : undefined;
  const errorReference = error?.supportReference ? (
    <SizableText color="$textSubdued" size="$bodySm">
      {messages.supportReference} <code>{error.supportReference}</code>
    </SizableText>
  ) : null;
  const inlineOtpError =
    verifying &&
    (error?.code === 'OTP_INVALID' || error?.code === 'OTP_EXPIRED');
  const flowError =
    error && !dialogTitle && !error.usesSharedToast ? (
      <div
        id={inlineOtpError ? 'deletion-code-server-error' : undefined}
        role="alert"
        data-testid="flow-error"
        data-error-code={error.code}
      >
        <SizableText color="$textCritical" size="$bodyMd">
          {errorMessage}
        </SizableText>
        {error.code === 'OTP_SEND_UNCERTAIN' && error.userMessage ? (
          <SizableText color="$textSubdued">{error.userMessage}</SizableText>
        ) : null}
        {errorReference}
      </div>
    ) : null;

  let heading: string | undefined;
  let body;
  switch (screen.step) {
    case 'loading':
      heading = error ? messages.linkLoadFailed : undefined;
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
      heading = messages.appSignInTitle;
      const { allowedProvider } = screen.info;
      const checking = busy && selectedProvider === allowedProvider;
      body = (
        <OneKeyOAuthButton
          provider={allowedProvider}
          testID={`sign-in-${allowedProvider}`}
          label={
            checking
              ? messages.checkingIdentity
              : providerLabel(allowedProvider)
          }
          disabled={busy || signInCooldown > 0}
          loading={checking}
          onPress={() => {
            setSelectedProvider(allowedProvider);
            flow.signIn(allowedProvider);
          }}
        />
      );
      break;
    }
    case 'email':
    case 'confirm':
      heading = messages.email;
      body = (
        <ConfirmStep
          flow={flow}
          otpError={inlineOtpError ? flowError : undefined}
        />
      );
      break;
    case 'result': {
      const status = screen.result?.status ?? screen.accepted?.status;
      if (status === 'processing') {
        heading = intl.formatMessage({ id: ETranslations.global_processing });
      } else {
        heading = status
          ? messages[resultTitles[status]]
          : messages.pendingResult;
      }
      body = <ResultStep flow={flow} />;
      break;
    }
    case 'unavailable':
      heading = messages.expired;
      body = (
        <>
          <SizableText color="$textSubdued">{messages.requestNew}</SizableText>
          <Action
            data-testid="open-recovery"
            variant="secondary"
            onClick={flow.openRecovery}
          >
            {messages.openRecovery}
          </Action>
        </>
      );
      break;
    case 'recovery-identity':
      heading = messages.openRecovery;
      body = (
        <>
          <SizableText color="$textSubdued">{messages.resume}</SizableText>
          {PROVIDERS.map((provider) => (
            <Action
              key={provider}
              data-testid={`recover-${provider}`}
              disabled={busy || signInCooldown > 0}
              onClick={() => flow.recoverResult(provider)}
            >
              {signInCooldown > 0
                ? messages.statusCountdown(signInCooldown)
                : providerLabel(provider)}
            </Action>
          ))}
        </>
      );
      break;
    case 'policy-pending':
      heading = messages.policyPending;
      body = (
        <SizableText color="$textSubdued">
          {messages.policyPendingDetail}
        </SizableText>
      );
      break;
    case 'target-changed':
      heading = messages.changed;
      body = (
        <SizableText color="$textSubdued">{messages.changedDetail}</SizableText>
      );
      break;
    case 'rejected':
      heading = messages.rejected;
      body = (
        <SizableText color="$textSubdued">
          {messages.rejectedDetail}
        </SizableText>
      );
      break;
  }
  const result = screen.step === 'result' ? screen.result : undefined;
  const isAppComplete = result?.status === 'completed';
  const centerHeading = screen.step === 'identity' || isAppComplete;
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
            tag="h1"
            id="flow-heading"
            className={verifying ? 'keyless-visually-hidden' : undefined}
            aria-live="polite"
            size={centerHeading ? '$heading2xl' : '$headingMd'}
            textAlign={centerHeading ? 'center' : undefined}
            m="$0"
          >
            {heading}
          </SizableText>
        ) : null}
        {inlineOtpError ? null : flowError}
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
    <main className="keyless-app-main">
      <Flow token={invitationToken} history={history} business={business} />
    </main>
  );
}
