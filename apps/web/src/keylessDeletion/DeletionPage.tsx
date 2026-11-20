import { type ReactNode, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import { Alert } from '@onekeyhq/components/src/actions/Alert';
import { Checkbox } from '@onekeyhq/components/src/forms/Checkbox';
import { type IInputRef, Input } from '@onekeyhq/components/src/forms/Input';
import { Button } from '@onekeyhq/components/src/primitives/Button';
import { SizableText } from '@onekeyhq/components/src/primitives/SizeableText';
import { Spinner } from '@onekeyhq/components/src/primitives/Spinner';
import { XStack, YStack } from '@onekeyhq/components/src/primitives/Stack';
import { OneKeyOAuthButton } from '@onekeyhq/kit/src/components/OneKeyAuth/OneKeyOAuthButton';
import { OnboardingIconBadge } from '@onekeyhq/kit/src/views/Onboardingv2/components/OnboardingIconBadge';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { messages } from './messages';
import {
  getOtpButtonState,
  useCountdown,
  useOtpInputFocus,
  useOtpResend,
} from './otpInputState';
import { UPDATED_CONFIRMATION_VERSION, WARNING_CODES } from './protocol';
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
  Exclude<IResult['status'], 'processing' | 'completed'>,
  ITextKey
> = {
  not_submitted: 'notSubmitted',
  manual_review_required: 'manualReview',
};

const resultScopes = {
  processing: 'pendingShare',
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
  OTP_SEND_RATE_LIMITED: 'rateLimited',
  RATE_LIMITED: 'rateLimited',
  AUTH_EXPIRED: 'reverify',
  AUTH_INVALID: 'reverify',
  INVITATION_UNAVAILABLE: 'expired',
  SERVICE_UNAVAILABLE: 'serviceUnavailable',
  UNSUPPORTED_CONFIRMATION: 'unsupportedConfirmation',
  CONFIRMATION_REQUIRED: 'confirmationRequired',
  CONFIRMATION_CHANGED: 'confirmationChanged',
  DELETION_DISABLED: 'deletionDisabled',
  INVALID_REQUEST: 'invalidRequest',
};

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

function SendCode({ flow }: { flow: IFlow }) {
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
      <Action
        data-testid="submit-deletion"
        variant="destructive"
        disabled={submitButton.disabled}
        loading={flow.submittingDelete}
        onClick={submit}
      >
        {messages.delete}
      </Action>
      {review?.uncertainDeletion ? (
        <YStack gap="$2" testID="uncertain-deletion">
          <SizableText color="$textSubdued" role="status">
            {review.uncertainDeletion === 'not_found'
              ? messages.deleteOutcomeNotFound
              : messages.deleteOutcomeUnknown}
          </SizableText>
          <Action
            data-testid="check-delete-outcome"
            variant="secondary"
            disabled={busy || outcomeCooldown > 0}
            onClick={flow.checkDeleteOutcome}
          >
            {outcomeCooldown > 0
              ? messages.statusCountdown(outcomeCooldown)
              : messages.checkDeleteOutcome}
          </Action>
        </YStack>
      ) : null}
      {warnings}
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
  let resultDetail = resultCheckFailed
    ? messages.resultCheckFailed
    : messages.unknownDetail;
  if (!resultCheckFailed && result?.status === 'not_submitted') {
    resultDetail = messages.notSubmitted;
  }
  let scopeDetail: string | undefined;
  if (known?.status === 'completed') {
    if (shareStatus === 'absent') scopeDetail = messages.deletedShare;
    else if (shareStatus === 'present')
      scopeDetail = messages.currentSharePresent;
    else if (busy) scopeDetail = messages.checkingShare;
    else
      scopeDetail = resultCheckFailed
        ? messages.resultCheckFailed
        : messages.currentShareUnknown;
  } else if (known) {
    scopeDetail = messages[resultScopes[known.status]];
  }
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
              {scopeDetail}
            </SizableText>
            {resultCheckFailed && known.status !== 'completed' ? (
              <SizableText color="$textSubdued" textAlign="center">
                {messages.resultCheckFailed}
              </SizableText>
            ) : null}
            {shareStatus === 'absent' ? (
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
        (resultCheckFailed || result?.status !== 'not_submitted') && (
          <SizableText color="$textSubdued">{resultDetail}</SizableText>
        )
      )}
      {needsSignIn ? (
        <Action
          data-testid="reauthenticate"
          disabled={busy || cooldown > 0}
          onClick={flow.reauthenticate}
        >
          {cooldown > 0
            ? messages.statusCountdown(cooldown)
            : messages.reauthenticate}
        </Action>
      ) : null}
      {!needsSignIn && shareStatus !== 'absent' && shareStatus !== 'present' ? (
        <Action
          data-testid="check-status"
          disabled={busy || cooldown > 0}
          onClick={flow.checkStatus}
        >
          {cooldown > 0
            ? messages.statusCountdown(cooldown)
            : intl.formatMessage({ id: ETranslations.global_refresh })}
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
    screen.step === 'identity' ? (error?.retryAt ?? 0) : 0,
  );
  const verifying = screen.step === 'email' || screen.step === 'confirm';
  let errorMessage = error?.userMessage;
  if (error && !errorMessage) {
    const errorKey = errorMessages[error.code];
    errorMessage = errorKey
      ? messages[errorKey]
      : intl.formatMessage({
          id:
            error.code === 'OTP_INVALID'
              ? ETranslations.prime_invalid_verification_code
              : ETranslations.global_unknown_error_retry_message,
        });
  }
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
        {errorMessage ? (
          <SizableText color="$textCritical" size="$bodyMd">
            {errorMessage}
          </SizableText>
        ) : null}
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
      if (status === 'completed') {
        heading =
          screen.result?.status === 'completed' &&
          screen.result.currentShareStatus === 'absent'
            ? messages.complete
            : messages.originalCompleted;
      } else if (status === 'processing') {
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
        <SizableText color="$textSubdued">{messages.requestNew}</SizableText>
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
  const isAppComplete =
    result?.status === 'completed' && result.currentShareStatus === 'absent';
  const largeHeading = screen.step === 'identity' || isAppComplete;
  const centerHeading = largeHeading || result?.status === 'completed';
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
            className={verifying ? 'keyless-visually-hidden' : undefined}
            aria-live="polite"
            size={largeHeading ? '$heading2xl' : '$headingMd'}
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
    <YStack render="main" minWidth={0}>
      <Flow token={invitationToken} history={history} business={business} />
    </YStack>
  );
}
