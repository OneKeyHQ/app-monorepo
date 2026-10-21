import type { IDecodedTxExtraStarknet } from '@onekeyhq/core/src/chains/starknet/types';
import { ETranslationsMock } from '@onekeyhq/shared/src/locale';
import { mapStrk20Error } from '@onekeyhq/shared/src/utils/strk20ErrorUtils';
import {
  EStrk20ErrorRetry,
  EStrk20SetupRequirement,
} from '@onekeyhq/shared/types/starknetPrivacy';

import {
  formatStrk20Countdown,
  getStrk20RecipientRequirementCopy,
  readStarknetPrivacyBlock,
} from './starknetPrivacyUtils';

describe('formatStrk20Countdown', () => {
  it('collapses non-positive and non-finite input to zero', () => {
    expect(formatStrk20Countdown(0)).toBe('0s');
    expect(formatStrk20Countdown(-5)).toBe('0s');
    expect(formatStrk20Countdown(Number.NaN)).toBe('0s');
    expect(formatStrk20Countdown(Number.POSITIVE_INFINITY)).toBe('0s');
  });

  it('rounds up to whole seconds below a minute', () => {
    expect(formatStrk20Countdown(1)).toBe('1s');
    expect(formatStrk20Countdown(30.2)).toBe('31s');
    expect(formatStrk20Countdown(59)).toBe('59s');
  });

  it('renders minutes, dropping a zero seconds remainder', () => {
    expect(formatStrk20Countdown(60)).toBe('1m');
    expect(formatStrk20Countdown(90)).toBe('1m 30s');
    expect(formatStrk20Countdown(300)).toBe('5m');
    expect(formatStrk20Countdown(3599)).toBe('59m 59s');
  });

  it('renders hours, dropping a zero minutes remainder', () => {
    expect(formatStrk20Countdown(3600)).toBe('1h');
    expect(formatStrk20Countdown(3660)).toBe('1h 1m');
    expect(formatStrk20Countdown(7380)).toBe('2h 3m');
  });
});

describe('getStrk20RecipientRequirementCopy', () => {
  it('blocks only when the recipient has never registered', () => {
    expect(
      getStrk20RecipientRequirementCopy(EStrk20SetupRequirement.Register),
    ).toEqual({
      blocking: true,
      messageKey:
        ETranslationsMock.starknet_privacy_error_recipient_not_registered,
    });
  });

  it('notes, without blocking, that setup actions ride along', () => {
    for (const requirement of [
      EStrk20SetupRequirement.SetupChannel,
      EStrk20SetupRequirement.SetupToken,
    ]) {
      expect(getStrk20RecipientRequirementCopy(requirement)).toEqual({
        blocking: false,
        messageKey: ETranslationsMock.starknet_privacy_recipient_setup_note,
      });
    }
  });

  it('says nothing for a ready recipient or an unknown requirement', () => {
    expect(
      getStrk20RecipientRequirementCopy(EStrk20SetupRequirement.Ready),
    ).toEqual({ blocking: false });
    expect(getStrk20RecipientRequirementCopy(undefined)).toEqual({
      blocking: false,
    });
  });
});

describe('mapStrk20Error (kit-bg import wiring)', () => {
  // Built by shape, not by importing the SDK's classes, matching
  // strk20Errors.test.ts's own contract for this function.
  function namedError(name: string) {
    const error = new Error('boom');
    Object.defineProperty(error, 'name', { value: name });
    return error;
  }

  it('maps a ScreeningRejected-shaped error to non-retryable copy', () => {
    expect(mapStrk20Error(namedError('ScreeningRejected'))).toEqual({
      translationKey:
        ETranslationsMock.starknet_privacy_error_screening_rejected,
      retryable: EStrk20ErrorRetry.No,
    });
  });

  it('falls back to the unknown, non-retryable copy for anything else', () => {
    expect(mapStrk20Error(namedError('boom'))).toEqual({
      translationKey: ETranslationsMock.starknet_privacy_error_unknown,
      retryable: EStrk20ErrorRetry.No,
    });
    expect(mapStrk20Error(undefined)).toEqual({
      translationKey: ETranslationsMock.starknet_privacy_error_unknown,
      retryable: EStrk20ErrorRetry.No,
    });
  });
});

describe('readStarknetPrivacyBlock', () => {
  it('returns undefined when extraInfo is absent or carries no block', () => {
    expect(readStarknetPrivacyBlock(undefined)).toBeUndefined();
    expect(readStarknetPrivacyBlock(null)).toBeUndefined();
    const extraInfo: IDecodedTxExtraStarknet = {};
    expect(readStarknetPrivacyBlock(extraInfo)).toBeUndefined();
  });

  it('returns the privacy block as-is when extraInfo carries one', () => {
    const extraInfo: IDecodedTxExtraStarknet = {
      privacy: {
        kind: 'withdraw',
        poolAddress: '0x1',
        amount: '100',
      },
    };
    expect(readStarknetPrivacyBlock(extraInfo)).toEqual(extraInfo.privacy);
  });
});
