import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type {
  ITermsConsentPrompt,
  ITermsConsentRound,
  ITermsConsentState,
} from '@onekeyhq/shared/types/setting';

// Server setting whose value is the terms version users must agree to; a
// missing or empty value switches the prompt off.
export const TERMS_CONSENT_SETTING_KEY = 'TERMS_CONSENT_VERSION';
export const TERMS_CONSENT_ACCEPT_PATH = '/utility/v1/terms-consent';

// Each install gets its own window, counted from the first time it shows the
// prompt, so people who rarely open the app are not locked out on arrival.
export const TERMS_CONSENT_DECISION_MS = timerUtils.getTimeDurationMs({
  day: 30,
});
export const TERMS_CONSENT_SNOOZE_MS = timerUtils.getTimeDurationMs({ day: 7 });

// The dialog shows the deadline as a date, so it lasts to the end of that
// local day instead of ending at the time of day of the first prompt.
function getDeadlineAt(firstPromptAt: number) {
  const deadline = new Date(firstPromptAt + TERMS_CONSENT_DECISION_MS);
  deadline.setHours(23, 59, 59, 999);
  return deadline.getTime();
}

export function resolveTermsConsentPrompt({
  requiredVersion,
  state,
  now,
}: {
  requiredVersion: string;
  state: ITermsConsentState;
  now: number;
}): { prompt?: ITermsConsentPrompt; round?: ITermsConsentRound } {
  if (state.acceptedVersion === requiredVersion) {
    return {};
  }
  // A new version starts a new round: a fresh window and no snooze.
  const round =
    state.round?.version === requiredVersion
      ? state.round
      : { version: requiredVersion, firstPromptAt: now };
  const deadlineAt = getDeadlineAt(round.firstPromptAt);
  if (now >= deadlineAt) {
    return {
      round,
      prompt: { version: requiredVersion, deadlineAt, deadlinePassed: true },
    };
  }
  if (
    round.notNowAt !== undefined &&
    now < round.notNowAt + TERMS_CONSENT_SNOOZE_MS
  ) {
    return { round };
  }
  return {
    round,
    prompt: { version: requiredVersion, deadlineAt, deadlinePassed: false },
  };
}

// How long until a put-off prompt is due again: the end of the snooze or the
// deadline, whichever comes first. 0 once that has passed, e.g. when the Not
// now reaches the UI runtime only after the deadline.
export function getTermsConsentRecheckDelay(
  { acceptedVersion, round }: ITermsConsentState,
  now: number,
) {
  if (
    !round ||
    round.notNowAt === undefined ||
    acceptedVersion === round.version
  ) {
    return undefined;
  }
  const recheckAt = Math.min(
    round.notNowAt + TERMS_CONSENT_SNOOZE_MS,
    getDeadlineAt(round.firstPromptAt),
  );
  return Math.max(0, recheckAt - now);
}
