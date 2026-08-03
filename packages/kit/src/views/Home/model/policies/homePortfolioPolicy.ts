import type {
  IHomeConfirmedFact,
  IHomeFacts,
  IHomePortfolioFactData,
} from '../facts/homeFacts';
import type { IHomePortfolioPresentation } from '../semantic/homeSemanticTypes';

const fundedActions = ['send', 'receive', 'buySell', 'swap'] as const;
const zeroActions = ['addMoney', 'receive', 'more'] as const;

function parseAmount(value: string): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

function fromConfirmed(
  confirmed: IHomeConfirmedFact | undefined,
): IHomePortfolioPresentation | undefined {
  const data = confirmed?.data as IHomePortfolioFactData | undefined;
  if (!data || !('amount' in data)) {
    return undefined;
  }
  const amount = parseAmount(data.amount);
  if (amount === undefined) {
    return undefined;
  }
  if (amount === 0) {
    return {
      kind: 'zero',
      header: {
        kind: 'zero',
        balance: { amount: data.amount, currency: data.currency },
      },
      actions: { kind: 'zero', items: zeroActions },
      banner: { kind: 'none' },
    };
  }
  return {
    kind: 'funded',
    header: {
      kind: 'funded',
      balance: { amount: data.amount, currency: data.currency },
      authority: 'confirmedCache',
    },
    actions: { kind: 'funded', items: fundedActions },
    banner: data.bannerAvailable ? { kind: 'positive' } : { kind: 'none' },
  };
}

export function projectHomePortfolioPresentation(
  facts: IHomeFacts,
): IHomePortfolioPresentation {
  const exactConfirmed = fromConfirmed(facts.confirmed.portfolio);
  const source = facts.sources.portfolio;
  if (facts.runtime.connection !== 'ready') {
    return (
      exactConfirmed ?? {
        kind: 'loading',
        header: { kind: 'loading' },
        actions: { kind: 'loading', items: [] },
        banner: { kind: 'none' },
      }
    );
  }
  if (source.kind === 'idle' || source.kind === 'loading') {
    return (
      exactConfirmed ?? {
        kind: 'loading',
        header: { kind: 'loading' },
        actions: { kind: 'loading', items: [] },
        banner: { kind: 'none' },
      }
    );
  }
  if (source.kind === 'partial') {
    if (source.data.positiveEvidence) {
      return {
        kind: 'fundedPendingTotal',
        header: { kind: 'loading' },
        actions: { kind: 'funded', items: fundedActions },
        banner: source.data.bannerAvailable
          ? { kind: 'positive' }
          : { kind: 'none' },
      };
    }
    return (
      exactConfirmed ?? {
        kind: 'loading',
        header: { kind: 'loading' },
        actions: { kind: 'loading', items: [] },
        banner: { kind: 'none' },
      }
    );
  }
  if (source.kind === 'error') {
    return (
      exactConfirmed ?? {
        kind: 'unavailable',
        header: {
          kind: 'unavailable',
          reason:
            source.errorKind === 'runtimeUnavailable'
              ? 'runtimeUnavailable'
              : 'sourceError',
        },
        actions: { kind: 'loading', items: [] },
        banner: { kind: 'none' },
      }
    );
  }
  if (source.result.kind === 'empty') {
    return {
      kind: 'zero',
      header: {
        kind: 'zero',
        balance: {
          amount: '0',
          currency: facts.environment.currency ?? 'unknown',
        },
      },
      actions: { kind: 'zero', items: zeroActions },
      banner: { kind: 'none' },
    };
  }
  const data = source.result.data;
  const amount = parseAmount(data.amount);
  if (amount === undefined) {
    return {
      kind: 'unavailable',
      header: { kind: 'unavailable', reason: 'invalidAmount' },
      actions: { kind: 'loading', items: [] },
      banner: { kind: 'none' },
    };
  }
  if (amount === 0) {
    return {
      kind: 'zero',
      header: {
        kind: 'zero',
        balance: { amount: data.amount, currency: data.currency },
      },
      actions: { kind: 'zero', items: zeroActions },
      banner: { kind: 'none' },
    };
  }
  return {
    kind: 'funded',
    header: {
      kind: 'funded',
      balance: { amount: data.amount, currency: data.currency },
      authority: 'live',
    },
    actions: { kind: 'funded', items: fundedActions },
    banner: data.bannerAvailable ? { kind: 'positive' } : { kind: 'none' },
  };
}
