import {
  HOME_CONTAINER_SLOT_CONTRACT_REVISION,
  type IHomeContainerSlotBundle,
  type IHomeContainerSlots,
} from './HomeContainer.types';
import { resolveHomeContainerSlots } from './HomeContainerSlotPresentation';

const owner = { scopeKey: 'scope-1', sessionId: 'session-1' };

function buildBundle(
  slots: IHomeContainerSlots,
  slotContractRevision = HOME_CONTAINER_SLOT_CONTRACT_REVISION,
): IHomeContainerSlotBundle {
  return {
    owner,
    phase: 'stable',
    semanticRevision: 7,
    slotContractRevision,
    slots,
  };
}

describe('HomeContainer slot presentation', () => {
  it('exposes the current slot bundle immediately', () => {
    const slots: IHomeContainerSlots = {
      balance: {
        content: 'current-balance',
        contentRevision: 'current-balance',
        height: 58,
      },
    };

    expect(
      resolveHomeContainerSlots({
        currentBundle: buildBundle(slots),
        legacySlots: undefined,
      }),
    ).toBe(slots);
  });

  it('prefers the current bundle over legacy slots', () => {
    const currentSlots: IHomeContainerSlots = {
      balance: {
        content: 'current-balance',
        contentRevision: 'current-balance',
        height: 58,
      },
    };
    const legacySlots: IHomeContainerSlots = {
      balance: {
        content: 'legacy-balance',
        contentRevision: 'legacy-balance',
        height: 58,
      },
    };

    expect(
      resolveHomeContainerSlots({
        currentBundle: buildBundle(currentSlots),
        legacySlots,
      }),
    ).toBe(currentSlots);
  });

  it('reserves geometry when the slot contract is unsupported', () => {
    const resolved = resolveHomeContainerSlots({
      currentBundle: buildBundle(
        {
          contentStates: {
            portfolio: {
              content: 'unsupported-content',
              contentRevision: 'unsupported-content',
              height: 320,
              interaction: 'tap',
            },
          },
        },
        HOME_CONTAINER_SLOT_CONTRACT_REVISION + 1,
      ),
      legacySlots: undefined,
    });

    expect(resolved?.contentStates?.portfolio).toEqual({
      content: null,
      contentRevision: 'unsupported-content',
      height: 320,
      interaction: 'none',
    });
  });

  it('filters slots that have neither content nor reserved geometry', () => {
    const visible = {
      content: null,
      contentRevision: 'visible',
      height: 58,
    };
    const resolved = resolveHomeContainerSlots({
      currentBundle: buildBundle({
        accountRow: { content: null, contentRevision: 'account' },
        balance: visible,
        contentStates: {
          portfolio: {
            content: undefined,
            contentRevision: 'portfolio',
          },
          history: { content: 'history', contentRevision: 'history' },
        },
      }),
      legacySlots: undefined,
    });

    expect(resolved?.accountRow).toBeUndefined();
    expect(resolved?.balance).toBe(visible);
    expect(resolved?.contentStates?.portfolio).toBeUndefined();
    expect(resolved?.contentStates?.history).toEqual({
      content: 'history',
      contentRevision: 'history',
    });
  });

  it('uses filtered legacy slots when no bundle exists', () => {
    const resolved = resolveHomeContainerSlots({
      currentBundle: undefined,
      legacySlots: {
        balance: { content: 'legacy', contentRevision: 'legacy' },
        accountRow: { content: null, contentRevision: 'account' },
      },
    });

    expect(resolved).toEqual({
      balance: { content: 'legacy', contentRevision: 'legacy' },
      accountRow: undefined,
    });
  });
});
