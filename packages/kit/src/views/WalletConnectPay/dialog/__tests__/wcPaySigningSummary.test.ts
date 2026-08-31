import {
  describeWcPaySigningHeadline,
  describeWcPaySigningSummary,
} from '../wcPaySigningSummary';

import type { IWcPayInlineSigningSummary } from '../../hooks/wcPayInlineUtils';

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
    fundsRecipientAta: boolean;
  }>,
): IWcPayInlineSigningSummary {
  return {
    kind: 'solana',
    summary: {
      amountRaw: '20000000',
      kind: 'native',
      priorityFeeLamports: '0',
      fundsRecipientAta: false,
      ...overrides,
    },
  };
}

describe('describeWcPaySigningHeadline', () => {
  it('calls a permit an authorization', () => {
    expect(describeWcPaySigningHeadline(typedData(), '20 USDC')).toBe(
      'Authorize 20 USDC for this payment',
    );
  });

  it('calls a solana signature a payment, not an allowance', () => {
    expect(describeWcPaySigningHeadline(solana(), '20 USDC')).toBe(
      'Sign this 20 USDC payment',
    );
  });
});

describe('describeWcPaySigningSummary — typed data', () => {
  it('names the spender and the remaining validity', () => {
    expect(describeWcPaySigningSummary(typedData(), NOW_MS)).toBe(
      'Spender 0x1234...5678 · Expires in 30 min',
    );
  });

  it('shortens an address only just past the threshold', () => {
    expect(
      describeWcPaySigningSummary(
        typedData({ spender: '0123456789abc' }),
        NOW_MS,
      ),
    ).toBe('Spender 012345...9abc · Expires in 30 min');
  });

  it('floors the minutes so validity is never overstated', () => {
    expect(
      describeWcPaySigningSummary(
        typedData({ deadlineSec: NOW_SEC + 30 * 60 + 59 }),
        NOW_MS,
      ),
    ).toBe('Spender 0x1234...5678 · Expires in 30 min');
  });

  it('reports a whole minute as one minute', () => {
    expect(
      describeWcPaySigningSummary(
        typedData({ deadlineSec: NOW_SEC + 60 }),
        NOW_MS,
      ),
    ).toBe('Spender 0x1234...5678 · Expires in 1 min');
  });

  it('reports sub-minute validity without a minute count', () => {
    expect(
      describeWcPaySigningSummary(
        typedData({ deadlineSec: NOW_SEC + 59 }),
        NOW_MS,
      ),
    ).toBe('Spender 0x1234...5678 · Expires in under a minute');
  });

  it('reports a whole hour as one hour', () => {
    expect(
      describeWcPaySigningSummary(
        typedData({ deadlineSec: NOW_SEC + 60 * 60 }),
        NOW_MS,
      ),
    ).toBe('Spender 0x1234...5678 · Expires in 1 h');
  });

  it('reports hours once past an hour', () => {
    expect(
      describeWcPaySigningSummary(
        typedData({ deadlineSec: NOW_SEC + 2 * 60 * 60 + 59 * 60 }),
        NOW_MS,
      ),
    ).toBe('Spender 0x1234...5678 · Expires in 2 h');
  });

  it('reports the validator ceiling as a whole day', () => {
    expect(
      describeWcPaySigningSummary(
        typedData({ deadlineSec: NOW_SEC + 24 * 60 * 60 }),
        NOW_MS,
      ),
    ).toBe('Spender 0x1234...5678 · Expires in 24 h');
  });

  it('reports a deadline reached exactly now as expired', () => {
    expect(
      describeWcPaySigningSummary(typedData({ deadlineSec: NOW_SEC }), NOW_MS),
    ).toBe('Spender 0x1234...5678 · Expired');
  });

  it('reports an elapsed deadline as expired', () => {
    expect(
      describeWcPaySigningSummary(
        typedData({ deadlineSec: NOW_SEC - 1 }),
        NOW_MS,
      ),
    ).toBe('Spender 0x1234...5678 · Expired');
  });

  it('drops the expiry when the deadline is unreadable', () => {
    expect(
      describeWcPaySigningSummary(
        typedData({ deadlineSec: Number.NaN }),
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
      expect(describeWcPaySigningSummary(typedData())).toBe(
        'Spender 0x1234...5678 · Expires in 30 min',
      );
    });
  });
});

describe('describeWcPaySigningSummary — solana', () => {
  it('falls back to a generic line when nothing costs extra', () => {
    expect(describeWcPaySigningSummary(solana(), NOW_MS)).toBe(
      'Signs the payment transaction',
    );
  });

  it('names the priority fee bound in SOL', () => {
    expect(
      describeWcPaySigningSummary(
        solana({ priorityFeeLamports: '10000000' }),
        NOW_MS,
      ),
    ).toBe('Network priority fee up to 0.01 SOL');
  });

  it('renders a one-lamport fee without exponential notation', () => {
    expect(
      describeWcPaySigningSummary(solana({ priorityFeeLamports: '1' }), NOW_MS),
    ).toBe('Network priority fee up to 0.000000001 SOL');
  });

  it('names the recipient token account rent', () => {
    expect(
      describeWcPaySigningSummary(solana({ fundsRecipientAta: true }), NOW_MS),
    ).toBe('Creates the recipient token account (rent varies by token)');
  });

  it('joins both costs', () => {
    expect(
      describeWcPaySigningSummary(
        solana({ priorityFeeLamports: '10000000', fundsRecipientAta: true }),
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
        NOW_MS,
      ),
    ).toBe('Signs the payment transaction');
  });

  it('never renders an unbounded priority fee', () => {
    expect(
      describeWcPaySigningSummary(
        solana({ priorityFeeLamports: 'Infinity' }),
        NOW_MS,
      ),
    ).toBe('Signs the payment transaction');
  });
});
