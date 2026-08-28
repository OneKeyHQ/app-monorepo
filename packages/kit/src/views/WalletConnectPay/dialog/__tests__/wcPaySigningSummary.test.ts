import {
  describeWcPaySigningSummary,
  shortenWcPayAddress,
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

describe('shortenWcPayAddress', () => {
  it('shortens a long address', () => {
    expect(shortenWcPayAddress(SPENDER)).toBe('0x1234…5678');
  });

  it('returns a short string unchanged', () => {
    expect(shortenWcPayAddress('0x1234')).toBe('0x1234');
    expect(shortenWcPayAddress('123456789012')).toBe('123456789012');
  });

  it('returns an empty string for a missing address', () => {
    expect(shortenWcPayAddress('')).toBe('');
  });
});

describe('describeWcPaySigningSummary — typed data', () => {
  it('names the spender and the remaining validity', () => {
    expect(describeWcPaySigningSummary(typedData(), NOW_MS)).toBe(
      'Spender 0x1234…5678 · Expires in 30 min',
    );
  });

  it('floors the minutes so validity is never overstated', () => {
    expect(
      describeWcPaySigningSummary(
        typedData({ deadlineSec: NOW_SEC + 30 * 60 + 59 }),
        NOW_MS,
      ),
    ).toBe('Spender 0x1234…5678 · Expires in 30 min');
  });

  it('reports sub-minute validity without a minute count', () => {
    expect(
      describeWcPaySigningSummary(
        typedData({ deadlineSec: NOW_SEC + 59 }),
        NOW_MS,
      ),
    ).toBe('Spender 0x1234…5678 · Expires in under a minute');
  });

  it('reports hours once past an hour', () => {
    expect(
      describeWcPaySigningSummary(
        typedData({ deadlineSec: NOW_SEC + 2 * 60 * 60 + 59 * 60 }),
        NOW_MS,
      ),
    ).toBe('Spender 0x1234…5678 · Expires in 2 h');
  });

  it('reports an elapsed deadline as expired', () => {
    expect(
      describeWcPaySigningSummary(
        typedData({ deadlineSec: NOW_SEC - 1 }),
        NOW_MS,
      ),
    ).toBe('Spender 0x1234…5678 · Expired');
  });

  it('drops the expiry when the deadline is unreadable', () => {
    expect(
      describeWcPaySigningSummary(
        typedData({ deadlineSec: Number.NaN }),
        NOW_MS,
      ),
    ).toBe('Spender 0x1234…5678');
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
    ).toBe('Creates the recipient token account (small SOL rent)');
  });

  it('joins both costs', () => {
    expect(
      describeWcPaySigningSummary(
        solana({ priorityFeeLamports: '10000000', fundsRecipientAta: true }),
        NOW_MS,
      ),
    ).toBe(
      'Network priority fee up to 0.01 SOL · Creates the recipient token account (small SOL rent)',
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
});
