import { HOME_CONTAINER_SLOT_CONTRACT_REVISION } from './HomeContainer.types';
import { resolveHomeContainerSlots } from './HomeContainerSlotPresentation';

const owner = { scopeKey: 'scope-1', sessionId: 'session-1' };

describe('HomeContainer slot presentation', () => {
  it('renders the acknowledged transaction slots while the parent revision commit lags', () => {
    const acknowledgedSlots = {
      balance: { content: 'acknowledged', height: 58 },
    };
    const parentSlots = {
      balance: { content: 'parent-lagging', height: 58 },
    };

    expect(
      resolveHomeContainerSlots({
        acknowledgedBundle: {
          owner,
          semanticRevision: 8,
          slotContractRevision: HOME_CONTAINER_SLOT_CONTRACT_REVISION,
          slots: acknowledgedSlots,
        },
        currentBundle: {
          owner,
          semanticRevision: 7,
          slotContractRevision: HOME_CONTAINER_SLOT_CONTRACT_REVISION,
          slots: parentSlots,
        },
        legacySlots: undefined,
      }),
    ).toBe(acknowledgedSlots);
  });

  it('does not expose a future same-owner parent bundle before acknowledgement', () => {
    const acknowledgedSlots = {
      balance: { content: 'acknowledged', height: 58 },
    };

    expect(
      resolveHomeContainerSlots({
        acknowledgedBundle: {
          owner,
          semanticRevision: 8,
          slotContractRevision: HOME_CONTAINER_SLOT_CONTRACT_REVISION,
          slots: acknowledgedSlots,
        },
        currentBundle: {
          owner,
          semanticRevision: 9,
          slotContractRevision: HOME_CONTAINER_SLOT_CONTRACT_REVISION,
          slots: {
            balance: { content: 'future', height: 58 },
          },
        },
        legacySlots: undefined,
      }),
    ).toBe(acknowledgedSlots);
  });

  it('reserves current geometry instead of retaining old-owner content', () => {
    const currentSlots = {
      balance: { content: 'current-owner', height: 58 },
      headerActionRow: {
        content: 'current-owner-actions',
        height: 62,
        interaction: 'tap' as const,
      },
    };
    const resolved = resolveHomeContainerSlots({
      acknowledgedBundle: {
        owner,
        semanticRevision: 8,
        slotContractRevision: HOME_CONTAINER_SLOT_CONTRACT_REVISION,
        slots: {
          balance: { content: 'old-owner', height: 58 },
        },
      },
      currentBundle: {
        owner: { scopeKey: 'scope-2', sessionId: 'session-2' },
        semanticRevision: -1,
        slotContractRevision: HOME_CONTAINER_SLOT_CONTRACT_REVISION,
        slots: currentSlots,
      },
      legacySlots: undefined,
    });

    expect(resolved?.balance).toEqual({
      content: null,
      height: 58,
      interaction: 'none',
    });
    expect(resolved?.headerActionRow).toEqual({
      content: null,
      height: 62,
      interaction: 'none',
    });
  });

  it('reserves slots after resync clears the acknowledged bundle', () => {
    const resolved = resolveHomeContainerSlots({
      acknowledgedBundle: undefined,
      currentBundle: {
        owner,
        semanticRevision: -1,
        slotContractRevision: HOME_CONTAINER_SLOT_CONTRACT_REVISION,
        slots: {
          balance: { content: 'unacknowledged', height: 58 },
        },
      },
      legacySlots: undefined,
    });

    expect(resolved?.balance?.content).toBeNull();
  });

  it('keeps the submitted current-owner loading fallback when initial and resync acknowledgements are both lost', () => {
    const submittedLoadingSlots = {
      contentStates: {
        portfolio: { content: 'loading-skeleton', height: 320 },
      },
    };
    const currentTerminalSlots = {
      contentHeaders: {
        portfolio: { content: 'Tokens', height: 56 },
      },
    };
    const resolved = resolveHomeContainerSlots({
      acknowledgedBundle: undefined,
      currentBundle: {
        owner,
        semanticRevision: 6,
        slotContractRevision: HOME_CONTAINER_SLOT_CONTRACT_REVISION,
        slots: currentTerminalSlots,
      },
      legacySlots: undefined,
      safeFallbackBundle: {
        owner,
        semanticRevision: 5,
        slotContractRevision: HOME_CONTAINER_SLOT_CONTRACT_REVISION,
        slots: submittedLoadingSlots,
      },
    });

    expect(resolved).toBe(submittedLoadingSlots);
    expect(resolved?.contentStates?.portfolio?.content).toBe(
      'loading-skeleton',
    );
  });

  it('never exposes a submitted fallback from an old owner', () => {
    const currentOwner = { scopeKey: 'scope-2', sessionId: 'session-2' };
    const resolved = resolveHomeContainerSlots({
      acknowledgedBundle: undefined,
      currentBundle: {
        owner: currentOwner,
        semanticRevision: 6,
        slotContractRevision: HOME_CONTAINER_SLOT_CONTRACT_REVISION,
        slots: {
          contentStates: {
            portfolio: { content: 'new-owner-loading', height: 320 },
          },
        },
      },
      legacySlots: undefined,
      safeFallbackBundle: {
        owner,
        semanticRevision: 5,
        slotContractRevision: HOME_CONTAINER_SLOT_CONTRACT_REVISION,
        slots: {
          contentStates: {
            portfolio: { content: 'old-owner-content', height: 320 },
          },
        },
      },
    });

    expect(resolved?.contentStates?.portfolio).toEqual({
      content: null,
      height: 320,
      interaction: 'none',
    });
  });

  it('filters slots that have neither content nor reserved geometry', () => {
    const resolved = resolveHomeContainerSlots({
      acknowledgedBundle: {
        owner,
        semanticRevision: 8,
        slotContractRevision: HOME_CONTAINER_SLOT_CONTRACT_REVISION,
        slots: {
          contentStates: {
            portfolio: {
              content: undefined,
              height: undefined,
              interaction: 'none',
            },
            history: {
              content: undefined,
              height: 320,
              interaction: 'none',
            },
          },
        },
      },
      currentBundle: {
        owner,
        semanticRevision: 8,
        slotContractRevision: HOME_CONTAINER_SLOT_CONTRACT_REVISION,
        slots: {
          contentStates: {
            portfolio: {
              content: undefined,
              height: undefined,
              interaction: 'none',
            },
            history: {
              content: undefined,
              height: 320,
              interaction: 'none',
            },
          },
        },
      },
      legacySlots: undefined,
    });

    expect(resolved?.contentStates).not.toHaveProperty('portfolio');
    expect(resolved?.contentStates?.history).toEqual({
      content: undefined,
      height: 320,
      interaction: 'none',
    });
  });
});
