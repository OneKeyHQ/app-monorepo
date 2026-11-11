import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import {
  TERMS_CONSENT_DECISION_MS,
  TERMS_CONSENT_SNOOZE_MS,
  getTermsConsentRecheckDelay,
  hasTermsConsentDialogAsked,
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

describe('getTermsConsentRecheckDelay', () => {
  it('has nothing to wait for until Not now is chosen', () => {
    expect(getTermsConsentRecheckDelay({}, START)).toBeUndefined();
    expect(
      getTermsConsentRecheckDelay(
        { round: { version: '2026.10', firstPromptAt: START } },
        START,
      ),
    ).toBeUndefined();
  });

  it('waits for the snooze to end', () => {
    const notNowAt = START + DAY_MS;
    expect(
      getTermsConsentRecheckDelay(
        { round: { version: '2026.10', firstPromptAt: START, notNowAt } },
        notNowAt,
      ),
    ).toBe(TERMS_CONSENT_SNOOZE_MS);
  });

  it('waits for the deadline when it comes first', () => {
    const notNowAt = endOfLocalDay(START + TERMS_CONSENT_DECISION_MS) - DAY_MS;
    expect(
      getTermsConsentRecheckDelay(
        { round: { version: '2026.10', firstPromptAt: START, notNowAt } },
        notNowAt,
      ),
    ).toBe(DAY_MS);
  });

  it('checks at once when the Not now arrives after the deadline', () => {
    const deadlineAt = endOfLocalDay(START + TERMS_CONSENT_DECISION_MS);
    expect(
      getTermsConsentRecheckDelay(
        {
          round: {
            version: '2026.10',
            firstPromptAt: START,
            notNowAt: deadlineAt - 1,
          },
        },
        deadlineAt + 50,
      ),
    ).toBe(0);
  });

  it('stops once the version was accepted', () => {
    expect(
      getTermsConsentRecheckDelay(
        {
          acceptedVersion: '2026.10',
          round: { version: '2026.10', firstPromptAt: START, notNowAt: START },
        },
        START,
      ),
    ).toBeUndefined();
  });
});

describe('hasTermsConsentDialogAsked', () => {
  it('leaves the notices in charge until the dialog has appeared', () => {
    expect(hasTermsConsentDialogAsked({}, '2026.10')).toBe(false);
    // A check stored the round, but a lock or a backup detour dropped it
    // before the dialog showed.
    const round = { version: '2026.10', firstPromptAt: START };
    expect(hasTermsConsentDialogAsked({ round }, '2026.10')).toBe(false);
    expect(
      hasTermsConsentDialogAsked(
        { round: { ...round, shownAt: START } },
        '2026.10',
      ),
    ).toBe(true);
  });

  it('keeps the answer with the dialog after Not now and past the deadline', () => {
    const round = {
      version: '2026.10',
      firstPromptAt: START,
      shownAt: START,
      notNowAt: START + DAY_MS,
    };
    const expired = resolveTermsConsentPrompt({
      requiredVersion: '2026.10',
      state: { round },
      now: endOfLocalDay(START + TERMS_CONSENT_DECISION_MS),
    });
    expect(expired.prompt?.deadlinePassed).toBe(true);
    expect(
      hasTermsConsentDialogAsked({ round: expired.round }, '2026.10'),
    ).toBe(true);
  });

  it('lets the notices record a newer version the dialog has not asked about', () => {
    expect(
      hasTermsConsentDialogAsked(
        {
          acceptedVersion: '2026.10',
          round: { version: '2026.10', firstPromptAt: START, shownAt: START },
        },
        '2027.01',
      ),
    ).toBe(false);
  });
});
