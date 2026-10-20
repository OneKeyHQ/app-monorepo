/*
yarn jest packages/kit/src/views/SignatureConfirm/constants/gasAccountErrorCodes.test.ts

OK-64746 backend contract (2026-10-15): 90205 / 90219 / 90200 on a Gas
Account send mean "execute or transport failed, the tx may already be
broadcast". They must never auto-resend as self-paid, swap quotes or reset the
locked nonce — only hint the user to check activity. An unclassified Prime
400 (Wallet fills messageId=error__common_unknown) is treated the same way,
but only once send-transaction was issued: at estimate time nothing was sent.
*/
import {
  EGasAccountRequestStage,
  getGasAccountRequestStage,
  markGasAccountRequestStage,
} from '@onekeyhq/shared/src/errors/utils/gasAccountErrorUtils';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import {
  EGasAccountErrorStrategy,
  GAS_ACCOUNT_ERROR_TABLE,
  type IGasAccountErrorEntry,
  getGasAccountErrorEntry,
  getGasAccountErrorEntryForError,
  getGasAccountErrorMessageKey,
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

const unclassified400 = {
  code: 400,
  data: { code: 400, messageId: 'error__common_unknown' },
};

describe('getGasAccountErrorEntryForError', () => {
  it.each([
    EGasAccountRequestStage.Estimate,
    EGasAccountRequestStage.Send,
    undefined,
  ])('resolves a numeric code through the table (stage %s)', (stage) => {
    expect(getGasAccountErrorEntryForError({ code: 40_202 }, stage)).toBe(
      getGasAccountErrorEntry(40_202),
    );
  });

  it('treats an unclassified Prime 400 as result-unknown after a send', () => {
    const entry = getGasAccountErrorEntryForError(
      unclassified400,
      EGasAccountRequestStage.Send,
    );
    expect(entry?.strategy).toBe(EGasAccountErrorStrategy.Hint);
    expect(entry?.messageKey).toBe(maybeSubmittedKey);
  });

  it.each([EGasAccountRequestStage.Estimate, undefined])(
    'leaves an unclassified 400 unmapped when nothing was sent (stage %s)',
    (stage) => {
      // estimate-fee, balance checks and approval builds also surface this
      // generic 400; they must keep their ordinary error handling instead of
      // a "may already be submitted" hint.
      expect(
        getGasAccountErrorEntryForError(unclassified400, stage),
      ).toBeUndefined();
    },
  );

  it('leaves other 400 responses unmapped', () => {
    expect(
      getGasAccountErrorEntryForError(
        {
          code: 400,
          data: { code: 400, messageId: 'error__some_validation' },
        },
        EGasAccountRequestStage.Send,
      ),
    ).toBeUndefined();
    expect(
      getGasAccountErrorEntryForError(
        { code: 400, data: { code: 400 } },
        EGasAccountRequestStage.Send,
      ),
    ).toBeUndefined();
  });

  it('returns undefined for unknown numeric codes', () => {
    expect(
      getGasAccountErrorEntryForError(
        { code: 90_999 },
        EGasAccountRequestStage.Send,
      ),
    ).toBeUndefined();
  });
});

describe('getGasAccountErrorMessageKey', () => {
  const resultUnknown = getGasAccountErrorEntry(
    90_205,
  ) as IGasAccountErrorEntry;

  it('has the result-unknown entry under test', () => {
    expect(resultUnknown).toBeDefined();
  });

  it('uses the estimate copy for an estimate-stage failure', () => {
    expect(
      getGasAccountErrorMessageKey(
        resultUnknown,
        EGasAccountRequestStage.Estimate,
      ),
    ).toBe(
      ETranslations.wallet_gas_sponsor_unavailable_switched_to_network_fee__msg,
    );
  });

  it.each([EGasAccountRequestStage.Send, undefined])(
    'keeps the submit copy for stage %s',
    (stage) => {
      expect(getGasAccountErrorMessageKey(resultUnknown, stage)).toBe(
        maybeSubmittedKey,
      );
    },
  );

  it('falls back to messageKey when the entry has no estimate copy', () => {
    const entry = getGasAccountErrorEntry(40_215) as IGasAccountErrorEntry;
    expect(entry).toBeDefined();
    expect(entry.estimateMessageKey).toBeUndefined();
    expect(
      getGasAccountErrorMessageKey(entry, EGasAccountRequestStage.Estimate),
    ).toBe(entry.messageKey);
  });
});

describe('request stage marker', () => {
  it('round-trips the stage on the same error object', () => {
    const error = new Error('boom');
    expect(getGasAccountRequestStage(error)).toBeUndefined();
    expect(
      markGasAccountRequestStage(error, EGasAccountRequestStage.Estimate),
    ).toBe(error);
    expect(getGasAccountRequestStage(error)).toBe(
      EGasAccountRequestStage.Estimate,
    );
  });

  it('keeps the innermost tag', () => {
    const error = markGasAccountRequestStage(
      { code: 90_200 },
      EGasAccountRequestStage.Send,
    );
    markGasAccountRequestStage(error, EGasAccountRequestStage.Estimate);
    expect(getGasAccountRequestStage(error)).toBe(EGasAccountRequestStage.Send);
  });

  it('passes non-object throwables through', () => {
    expect(
      markGasAccountRequestStage('oops', EGasAccountRequestStage.Send),
    ).toBe('oops');
    expect(getGasAccountRequestStage('oops')).toBeUndefined();
    expect(getGasAccountRequestStage(null)).toBeUndefined();
  });
});

describe('result-unknown marker', () => {
  // Entries that mean "the tx may already be on chain". The confirm page
  // latches on them so a later estimate round or a second confirm tap can
  // never move on to a new nonce / quote and send a second tx.
  it.each([90_200, 90_205, 90_219, 40_203])(
    '%s flags the attempt as result unknown',
    (code) => {
      expect(getGasAccountErrorEntry(code)?.resultUnknown).toBe(true);
    },
  );

  it('flags the unclassified Prime 400 after a send', () => {
    expect(
      getGasAccountErrorEntryForError(
        unclassified400,
        EGasAccountRequestStage.Send,
      )?.resultUnknown,
    ).toBe(true);
  });

  it.each([40_214, 40_215, 40_217, 40_227, 90_207, 90_209])(
    '%s is a hint that sent nothing and is not flagged',
    (code) => {
      const entry = getGasAccountErrorEntry(code);
      expect(entry?.strategy).toBe(EGasAccountErrorStrategy.Hint);
      expect(entry?.resultUnknown).toBeUndefined();
    },
  );

  it('never flags a Refresh or Fallback entry', () => {
    const flagged = Object.entries(GAS_ACCOUNT_ERROR_TABLE).filter(
      ([, entry]) =>
        entry.strategy !== EGasAccountErrorStrategy.Hint && entry.resultUnknown,
    );
    expect(flagged).toEqual([]);
  });
});
