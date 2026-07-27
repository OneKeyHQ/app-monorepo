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
    semanticRevision: 7,
    slotContractRevision,
    slots,
  };
}

describe('HomeContainer slot presentation', () => {
  it('exposes the current slot bundle immediately', () => {
    const slots: IHomeContainerSlots = {
      balance: { content: 'current-balance', height: 58 },
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
      balance: { content: 'current-balance', height: 58 },
    };
    const legacySlots: IHomeContainerSlots = {
      balance: { content: 'legacy-balance', height: 58 },
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
      height: 320,
      interaction: 'none',
    });
  });

  it('filters slots that have neither content nor reserved geometry', () => {
    const visible = { content: null, height: 58 };
    const resolved = resolveHomeContainerSlots({
      currentBundle: buildBundle({
        accountRow: { content: null },
        balance: visible,
        contentStates: {
          portfolio: { content: undefined },
          history: { content: 'history' },
        },
      }),
      legacySlots: undefined,
    });

    expect(resolved?.accountRow).toBeUndefined();
    expect(resolved?.balance).toBe(visible);
    expect(resolved?.contentStates?.portfolio).toBeUndefined();
    expect(resolved?.contentStates?.history).toEqual({ content: 'history' });
  });

  it('uses filtered legacy slots when no bundle exists', () => {
    const resolved = resolveHomeContainerSlots({
      currentBundle: undefined,
      legacySlots: {
        balance: { content: 'legacy' },
        accountRow: { content: null },
      },
    });

    expect(resolved).toEqual({
      balance: { content: 'legacy' },
      accountRow: undefined,
    });
  });
});
