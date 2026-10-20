/*
yarn jest packages/kit/src/views/SignatureConfirm/constants/gasAccountErrorCodes.test.ts

OK-64746 backend contract (2026-10-15): 90205 / 90219 / 90200 on a Gas
Account send mean "execute or transport failed, the tx may already be
broadcast". They must never auto-resend as self-paid, swap quotes or reset the
locked nonce — only hint the user to check activity. An unclassified Prime
400 (Wallet fills messageId=error__common_unknown) is treated the same way.
*/
import { ETranslations } from '@onekeyhq/shared/src/locale';

import {
  EGasAccountErrorStrategy,
  getGasAccountErrorEntry,
  getGasAccountErrorEntryForError,
} from './gasAccountErrorCodes';

const maybeSubmittedKey =
  ETranslations.wallet_transaction_maybe_already_submitted_check_activity__msg;

describe('gas account result-unknown submit codes', () => {
  it.each([90_205, 90_219, 90_200])(
    '%s is a hint that the tx may already be submitted',
    (code) => {
      const entry = getGasAccountErrorEntry(code);
      expect(entry?.strategy).toBe(EGasAccountErrorStrategy.Hint);
      expect(entry?.messageKey).toBe(maybeSubmittedKey);
    },
  );

  it.each([90_205, 90_219, 90_200])(
    '%s keeps the switched-to-network-fee copy when hit at estimate time',
    (code) => {
      expect(getGasAccountErrorEntry(code)?.estimateMessageKey).toBe(
        ETranslations.wallet_gas_sponsor_unavailable_switched_to_network_fee__msg,
      );
    },
  );
});

describe('getGasAccountErrorEntryForError', () => {
  it('resolves a numeric code through the table', () => {
    expect(getGasAccountErrorEntryForError({ code: 40_202 })).toBe(
      getGasAccountErrorEntry(40_202),
    );
  });

  it('treats an unclassified Prime 400 as result-unknown', () => {
    const entry = getGasAccountErrorEntryForError({
      code: 400,
      data: { code: 400, messageId: 'error__common_unknown' },
    });
    expect(entry?.strategy).toBe(EGasAccountErrorStrategy.Hint);
    expect(entry?.messageKey).toBe(maybeSubmittedKey);
  });

  it('leaves other 400 responses unmapped', () => {
    expect(
      getGasAccountErrorEntryForError({
        code: 400,
        data: { code: 400, messageId: 'error__some_validation' },
      }),
    ).toBeUndefined();
    expect(
      getGasAccountErrorEntryForError({ code: 400, data: { code: 400 } }),
    ).toBeUndefined();
  });

  it('returns undefined for unknown numeric codes', () => {
    expect(getGasAccountErrorEntryForError({ code: 90_999 })).toBeUndefined();
  });
});
