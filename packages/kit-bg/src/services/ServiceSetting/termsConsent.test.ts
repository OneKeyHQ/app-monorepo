import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import {
  TERMS_CONSENT_DECISION_MS,
  TERMS_CONSENT_SNOOZE_MS,
  resolveTermsConsentPrompt,
} from './termsConsent';

const DAY_MS = timerUtils.getTimeDurationMs({ day: 1 });
const START = Date.UTC(2026, 10, 1);
const endOfLocalDay = (time: number) =>
  new Date(time).setHours(23, 59, 59, 999);

describe('resolveTermsConsentPrompt', () => {
  it('stays off once the required version was accepted', () => {
    expect(
      resolveTermsConsentPrompt({
        requiredVersion: '2026.10',
        state: { acceptedVersion: '2026.10' },
        now: START,
      }),
    ).toEqual({});
  });

  it('starts a 30-day round on the first prompt', () => {
    expect(
      resolveTermsConsentPrompt({
        requiredVersion: '2026.10',
        state: {},
        now: START,
      }),
    ).toEqual({
      round: { version: '2026.10', firstPromptAt: START },
      prompt: {
        version: '2026.10',
        deadlineAt: endOfLocalDay(START + TERMS_CONSENT_DECISION_MS),
        deadlinePassed: false,
      },
    });
  });

  it('keeps the original deadline on later prompts of the same version', () => {
    const round = { version: '2026.10', firstPromptAt: START };
    const result = resolveTermsConsentPrompt({
      requiredVersion: '2026.10',
      state: { round },
      now: START + 10 * DAY_MS,
    });
    expect(result.round).toBe(round);
    expect(result.prompt?.deadlineAt).toBe(
      endOfLocalDay(START + TERMS_CONSENT_DECISION_MS),
    );
  });

  it('keeps Not now through the whole day shown as the deadline', () => {
    const round = {
      version: '2026.10',
      firstPromptAt: new Date(2026, 10, 2, 18).getTime(),
    };
    expect(
      resolveTermsConsentPrompt({
        requiredVersion: '2026.10',
        state: { round },
        now: new Date(2026, 11, 2, 19).getTime(),
      }).prompt?.deadlinePassed,
    ).toBe(false);
  });

  it('hides the prompt for 7 days after Not now', () => {
    const round = {
      version: '2026.10',
      firstPromptAt: START,
      notNowAt: START + DAY_MS,
    };
    expect(
      resolveTermsConsentPrompt({
        requiredVersion: '2026.10',
        state: { round },
        now: round.notNowAt + TERMS_CONSENT_SNOOZE_MS - 1,
      }).prompt,
    ).toBeUndefined();
    expect(
      resolveTermsConsentPrompt({
        requiredVersion: '2026.10',
        state: { round },
        now: round.notNowAt + TERMS_CONSENT_SNOOZE_MS,
      }).prompt?.deadlinePassed,
    ).toBe(false);
  });

  it('ignores the snooze once the deadline has passed', () => {
    const deadlineAt = endOfLocalDay(START + TERMS_CONSENT_DECISION_MS);
    expect(
      resolveTermsConsentPrompt({
        requiredVersion: '2026.10',
        state: {
          round: {
            version: '2026.10',
            firstPromptAt: START,
            notNowAt: deadlineAt - DAY_MS,
          },
        },
        now: deadlineAt,
      }).prompt,
    ).toEqual({ version: '2026.10', deadlineAt, deadlinePassed: true });
  });

  it('starts a new round without the snooze for a new version', () => {
    const now = START + 40 * DAY_MS;
    expect(
      resolveTermsConsentPrompt({
        requiredVersion: '2027.01',
        state: {
          acceptedVersion: '2026.10',
          round: { version: '2026.10', firstPromptAt: START, notNowAt: now },
        },
        now,
      }),
    ).toEqual({
      round: { version: '2027.01', firstPromptAt: now },
      prompt: {
        version: '2027.01',
        deadlineAt: endOfLocalDay(now + TERMS_CONSENT_DECISION_MS),
        deadlinePassed: false,
      },
    });
  });
});
