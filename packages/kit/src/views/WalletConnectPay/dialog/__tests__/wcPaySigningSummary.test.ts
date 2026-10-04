import { createIntl } from 'react-intl';

import enUS from '@onekeyhq/shared/src/locale/json/en_US.json';

import {
  describeWcPaySigningHeadline,
  describeWcPaySigningSummary,
} from '../wcPaySigningSummary';

import type { IWcPayInlineSigningSummary } from '../../hooks/wcPayInlineUtils';

// The real en_US catalog, so every expectation below is the copy a user
// sees — a key typo or a placeholder drift fails here, not on device.
const intl = createIntl({
  locale: 'en-US',
  messages: enUS as Record<string, string>,
});

const NOW_MS = 1_700_000_000_000;
const NOW_SEC = NOW_MS / 1000;
const SPENDER = '0x1234567890abcdef1234567890abcdef12345678';

function typedData(
  overrides?: Partial<{ spender: string; deadlineSec: number }>,
): IWcPayInlineSigningSummary {
  return {
    kind: 'typedData',
    summary: {
      amountRaw: '20000000',
      tokenAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      spender: SPENDER,
      deadlineSec: NOW_SEC + 30 * 60,
      chainReference: '8453',
      ...overrides,
    },
  };
}

function solana(
  overrides?: Partial<{
    priorityFeeLamports: string;
    sponsoredFee: boolean;
    fundsRecipientAta: boolean;
  }>,
): IWcPayInlineSigningSummary {
  return {
    kind: 'solana',
    summary: {
      amountRaw: '20000000',
      kind: 'native',
      priorityFeeLamports: '0',
      sponsoredFee: false,
      fundsRecipientAta: false,
      ...overrides,
    },
  };
}

describe('describeWcPaySigningHeadline', () => {
  it('calls a permit an authorization', () => {
    expect(describeWcPaySigningHeadline(typedData(), '20 USDC', intl)).toBe(
      'Authorize 20 USDC for this payment',
    );
  });

  it('calls a solana signature a payment, not an allowance', () => {
    expect(describeWcPaySigningHeadline(solana(), '20 USDC', intl)).toBe(
      'Sign this 20 USDC payment',
    );
  });
});

describe('describeWcPaySigningSummary — typed data', () => {
  it('names the spender and the remaining validity', () => {
    expect(describeWcPaySigningSummary(typedData(), intl, NOW_MS)).toBe(
      'Spender 0x1234...5678 · Expires in 30 min',
    );
  });

  it('shortens an address only just past the threshold', () => {
    expect(
      describeWcPaySigningSummary(
        typedData({ spender: '0123456789abc' }),
        intl,
        NOW_MS,
      ),
    ).toBe('Spender 012345...9abc · Expires in 30 min');
  });

  it('floors the minutes so validity is never overstated', () => {
    expect(
      describeWcPaySigningSummary(
        typedData({ deadlineSec: NOW_SEC + 30 * 60 + 59 }),
        intl,
        NOW_MS,
      ),
    ).toBe('Spender 0x1234...5678 · Expires in 30 min');
  });

  it('reports a whole minute as one minute', () => {
    expect(
      describeWcPaySigningSummary(
        typedData({ deadlineSec: NOW_SEC + 60 }),
        intl,
        NOW_MS,
      ),
    ).toBe('Spender 0x1234...5678 · Expires in 1 min');
  });

  it('reports sub-minute validity without a minute count', () => {
    expect(
      describeWcPaySigningSummary(
        typedData({ deadlineSec: NOW_SEC + 59 }),
        intl,
        NOW_MS,
      ),
    ).toBe('Spender 0x1234...5678 · Expires in under a minute');
  });

  it('reports a whole hour as one hour', () => {
    expect(
      describeWcPaySigningSummary(
        typedData({ deadlineSec: NOW_SEC + 60 * 60 }),
        intl,
        NOW_MS,
      ),
    ).toBe('Spender 0x1234...5678 · Expires in 1 h');
  });

  it('reports hours once past an hour', () => {
    expect(
      describeWcPaySigningSummary(
        typedData({ deadlineSec: NOW_SEC + 2 * 60 * 60 + 59 * 60 }),
        intl,
        NOW_MS,
      ),
    ).toBe('Spender 0x1234...5678 · Expires in 2 h');
  });

  it('reports the validator ceiling as a whole day', () => {
    expect(
      describeWcPaySigningSummary(
        typedData({ deadlineSec: NOW_SEC + 24 * 60 * 60 }),
        intl,
        NOW_MS,
      ),
    ).toBe('Spender 0x1234...5678 · Expires in 1 d');
  });

  it('reports a deadline reached exactly now as expired', () => {
    expect(
      describeWcPaySigningSummary(
        typedData({ deadlineSec: NOW_SEC }),
        intl,
        NOW_MS,
      ),
    ).toBe('Spender 0x1234...5678 · Expired');
  });

  it('reports an elapsed deadline as expired', () => {
    expect(
      describeWcPaySigningSummary(
        typedData({ deadlineSec: NOW_SEC - 1 }),
        intl,
        NOW_MS,
      ),
    ).toBe('Spender 0x1234...5678 · Expired');
  });

  it('drops the expiry when the deadline is unreadable', () => {
    expect(
      describeWcPaySigningSummary(
        typedData({ deadlineSec: Number.NaN }),
        intl,
        NOW_MS,
      ),
    ).toBe('Spender 0x1234...5678');
  });

  describe('without an explicit clock', () => {
    beforeEach(() => {
      jest.useFakeTimers().setSystemTime(NOW_MS);
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('measures the deadline against the current time', () => {
      expect(describeWcPaySigningSummary(typedData(), intl)).toBe(
        'Spender 0x1234...5678 · Expires in 30 min',
      );
    });
  });
});

describe('describeWcPaySigningSummary — solana', () => {
  it('falls back to a generic line when nothing costs extra', () => {
    expect(describeWcPaySigningSummary(solana(), intl, NOW_MS)).toBe(
      'Signs the payment transaction',
    );
  });

  it('names the priority fee bound in SOL', () => {
    expect(
      describeWcPaySigningSummary(
        solana({ priorityFeeLamports: '10000000' }),
        intl,
        NOW_MS,
      ),
    ).toBe('Network priority fee up to 0.01 SOL');
  });

  it('renders a one-lamport fee without exponential notation', () => {
    expect(
      describeWcPaySigningSummary(
        solana({ priorityFeeLamports: '1' }),
        intl,
        NOW_MS,
      ),
    ).toBe('Network priority fee up to 0.000000001 SOL');
  });

  it('names the recipient token account rent', () => {
    expect(
      describeWcPaySigningSummary(
        solana({ fundsRecipientAta: true }),
        intl,
        NOW_MS,
      ),
    ).toBe('Creates the recipient token account (rent varies by token)');
  });

  it('joins both costs', () => {
    expect(
      describeWcPaySigningSummary(
        solana({ priorityFeeLamports: '10000000', fundsRecipientAta: true }),
        intl,
        NOW_MS,
      ),
    ).toBe(
      'Network priority fee up to 0.01 SOL · Creates the recipient token account (rent varies by token)',
    );
  });

  it('treats an unreadable priority fee as zero', () => {
    expect(
      describeWcPaySigningSummary(
        solana({ priorityFeeLamports: 'not-a-number' }),
        intl,
        NOW_MS,
      ),
    ).toBe('Signs the payment transaction');
  });

  it('never renders an unbounded priority fee', () => {
    expect(
      describeWcPaySigningSummary(
        solana({ priorityFeeLamports: 'Infinity' }),
        intl,
        NOW_MS,
      ),
    ).toBe('Signs the payment transaction');
  });
});

describe('personalSign summaries', () => {
  const personalSign = (text: string) =>
    ({ kind: 'personalSign', summary: { text } }) as const;

  it('uses a message headline that does not name the amount', () => {
    expect(
      describeWcPaySigningHeadline(personalSign('hi'), '10 USDC', intl),
    ).toBe('Sign this message for the merchant');
  });

  it('renders the message text verbatim as the summary', () => {
    const text = 'Pay order #123\nMerchant: Example';
    expect(describeWcPaySigningSummary(personalSign(text), intl)).toBe(text);
  });
});

describe('approve summaries', () => {
  const approve = (unlimited: boolean) =>
    ({ kind: 'approve', summary: { symbol: 'USDT', unlimited } }) as const;

  it('names the token being allowed', () => {
    expect(describeWcPaySigningHeadline(approve(false), '10 USDT', intl)).toBe(
      'Allow Permit2 to use your USDT',
    );
  });

  it('describes the one-time setup, flagging an unlimited allowance', () => {
    expect(describeWcPaySigningSummary(approve(false), intl)).toBe(
      'One-time setup for this payment',
    );
    expect(describeWcPaySigningSummary(approve(true), intl)).toBe(
      'One-time setup for this payment · Unlimited allowance',
    );
  });
});

describe('review-hardening: expiry days unit and symbol sanitizing', () => {
  it('renders multi-week permit deadlines in days, floored', () => {
    expect(
      describeWcPaySigningSummary(
        typedData({ deadlineSec: NOW_SEC + 27 * 24 * 3600 + 3600 }),
        intl,
        NOW_MS,
      ),
    ).toContain('Expires in 27 d');
  });

  it('keeps sub-day deadlines in hours', () => {
    expect(
      describeWcPaySigningSummary(
        typedData({ deadlineSec: NOW_SEC + 23 * 3600 + 60 }),
        intl,
        NOW_MS,
      ),
    ).toContain('Expires in 23 h');
  });

  it('sanitizes a hostile token symbol in the approve headline', () => {
    const poisoned = `USD${String.fromCharCode(0x20_2e)}C — refund to 0xabc`;
    expect(
      describeWcPaySigningHeadline(
        { kind: 'approve', summary: { symbol: poisoned, unlimited: false } },
        '10 USDT',
        intl,
      ),
    ).toBe('Allow Permit2 to use your USDC — refun…');
  });
});

describe('sponsored-fee disclosure', () => {
  it('replaces the priority-fee line when the merchant sponsors the fee', () => {
    expect(
      describeWcPaySigningSummary(
        solana({ priorityFeeLamports: '10000000', sponsoredFee: true }),
        intl,
        NOW_MS,
      ),
    ).toBe('Network fee covered by the merchant');
  });

  it('still names a user-funded ATA rent beside the sponsored-fee line', () => {
    expect(
      describeWcPaySigningSummary(
        solana({ sponsoredFee: true, fundsRecipientAta: true }),
        intl,
        NOW_MS,
      ),
    ).toBe(
      'Network fee covered by the merchant · Creates the recipient token account (rent varies by token)',
    );
  });
});
