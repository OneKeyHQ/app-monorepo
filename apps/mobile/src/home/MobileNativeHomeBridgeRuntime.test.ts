import type {
  IHomeContainerOwner,
  IHomeContainerTheme,
} from '@onekeyhq/native-components';

import { MobileNativeHomeBridgeRuntime } from './MobileNativeHomeBridgeRuntime';

const theme: IHomeContainerTheme = {
  accentColor: '#000001',
  activeColor: '#000002',
  backgroundColor: '#000003',
  cardColor: '#000004',
  dividerColor: '#000005',
  hoverColor: '#000006',
  infoBackgroundColor: '#000007',
  infoTextColor: '#000008',
  negativeColor: '#000009',
  positiveColor: '#00000a',
  primaryTextColor: '#00000b',
  secondaryTextColor: '#00000c',
  strongColor: '#00000d',
  subduedIconColor: '#00000e',
};

function owner(scopeKey: string, sessionId: string): IHomeContainerOwner {
  return { scopeKey, sessionId };
}

function createManualFrameScheduler() {
  const frames: Array<() => void> = [];
  return {
    flush: () => {
      frames.splice(0).forEach((frame) => frame());
    },
    schedule: (frame: () => void) => {
      frames.push(frame);
    },
  };
}

describe('MobileNativeHomeBridgeRuntime owner replacement', () => {
  it('keeps one controller without reauthorizing old-owner slot content', async () => {
    const initialOwner = owner('owner-a', 'session-a');
    const nextOwner = owner('owner-b', 'session-b');
    const frameScheduler = createManualFrameScheduler();
    const runtime = new MobileNativeHomeBridgeRuntime(
      initialOwner,
      () => 7,
      theme,
      frameScheduler.schedule,
    );
    const controller = runtime.controller;
    const accountContent = 'account-slot';
    const listener = jest.fn();
    runtime.subscribeSlots(listener);
    expect(runtime.controller.getSnapshot().header.actionRowHeight).toBe(62);

    runtime.updateSlots('header', {
      accountRow: {
        authority: runtime.authority('header.account-row', 3),
        content: accountContent,
        contentRevision: 'account-3',
      },
      backgroundColor: '#ffffff',
    });
    await Promise.resolve();
    expect(runtime.getSlotBundle()).toMatchObject({
      owner: initialOwner,
      phase: 'stable',
      slots: {
        accountRow: {
          content: accountContent,
          contentRevision: 'account-3',
        },
      },
    });
    listener.mockClear();
    expect(runtime.authority('header.balance', 1, nextOwner)).toMatchObject({
      owner: nextOwner,
      producedByStoreCommitId: 7,
    });
    runtime.replaceOwner(nextOwner, theme);
    await Promise.resolve();

    expect(runtime.controller).toBe(controller);
    expect(runtime.controller.getOwner()).toEqual(nextOwner);
    expect(runtime.controller.getSnapshot().header.actionRowHeight).toBe(62);
    expect(runtime.getSlotBundle()).toMatchObject({
      owner: nextOwner,
      phase: 'owner-transition',
      semanticRevision: 7,
      slots: {
        accountRow: {
          authority: {
            owner: initialOwner,
          },
          content: accountContent,
          contentRevision: 'account-3',
        },
      },
    });
    expect(listener).not.toHaveBeenCalled();

    runtime.updateSlots('header', {
      accountRow: {
        authority: runtime.authority('header.account-row', 4),
        content: 'new-account-slot',
        contentRevision: 'account-4',
      },
    });
    await Promise.resolve();
    expect(listener).not.toHaveBeenCalled();
    frameScheduler.flush();

    expect(runtime.getSlotBundle()).toMatchObject({
      owner: nextOwner,
      phase: 'stable',
      semanticRevision: 7,
      slots: {
        accountRow: {
          authority: {
            owner: nextOwner,
            producedByStoreCommitId: 7,
            slotId: 'header.account-row',
            slotRevision: 4,
          },
          content: 'new-account-slot',
        },
      },
    });
    expect(runtime.getSlotBundle().slots.accountRow?.content).not.toBe(
      accountContent,
    );
    expect(listener).toHaveBeenCalledTimes(1);
    expect(runtime.authority('header.balance', 1)).toMatchObject({
      owner: nextOwner,
      producedByStoreCommitId: 7,
    });
    expect(runtime.storeAuthority('content.header.portfolio')).toMatchObject({
      owner: nextOwner,
      producedByStoreCommitId: 7,
      slotRevision: 7,
    });
    runtime.dispose();
  });

  it('publishes one complete slot bundle for the initial owner frame', async () => {
    const frameScheduler = createManualFrameScheduler();
    const runtime = new MobileNativeHomeBridgeRuntime(
      owner('owner-a', 'session-a'),
      () => 9,
      theme,
      frameScheduler.schedule,
    );
    const listener = jest.fn();
    runtime.subscribeSlots(listener);
    runtime.replaceOwner(owner('owner-b', 'session-b'), theme);

    runtime.updateSlots('account', {
      accountRow: {
        authority: runtime.authority('header.account-row', 1),
        content: 'Account B',
        contentRevision: 'account-b',
      },
    });
    runtime.updateSlots('balance', {
      balance: {
        authority: runtime.authority('header.balance', 1),
        content: '$2',
        contentRevision: 'balance-b',
      },
    });
    runtime.updateSlots('support', {
      contentFooters: {
        portfolio: {
          support: {
            authority: runtime.authority('content.footer.portfolio.support', 1),
            content: 'Support',
            contentRevision: 'support-v1',
          },
        },
      },
    });
    await Promise.resolve();

    expect(listener).not.toHaveBeenCalled();
    frameScheduler.flush();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(runtime.getSlotBundle()).toMatchObject({
      owner: owner('owner-b', 'session-b'),
      phase: 'stable',
      slots: {
        accountRow: { content: 'Account B' },
        balance: { content: '$2' },
        contentFooters: {
          portfolio: {
            support: { content: 'Support' },
          },
        },
      },
    });

    runtime.updateSlots('balance', {
      balance: {
        authority: runtime.authority('header.balance', 2),
        content: '$3',
        contentRevision: 'balance-b-2',
      },
    });
    await Promise.resolve();

    expect(listener).toHaveBeenCalledTimes(2);
    expect(runtime.getSlotBundle().slots.balance?.content).toBe('$3');
    runtime.dispose();
  });

  it('keeps unactivated tabs on native loading rows until their bridge publishes', () => {
    const runtime = new MobileNativeHomeBridgeRuntime(
      owner('owner-a', 'session-a'),
      () => 3,
      theme,
    );
    runtime.updateNavigation({
      bodyPresentationKind: 'portfolio',
      destinations: {},
      selectedTabId: 'portfolio',
      tabApplicabilityRevision: 1,
      tabTitles: {
        portfolio: 'Spot',
        perps: 'Perps',
        defi: 'DeFi',
        nft: 'NFT',
        history: 'History',
      },
      visibleTabs: ['portfolio', 'perps', 'defi', 'nft', 'history'],
    });

    expect(
      runtime.controller.getSnapshot().tabs.find((tab) => tab.id === 'defi')
        ?.sections,
    ).toEqual([
      {
        id: 'defi-activation-loading',
        items: Array.from({ length: 5 }, (_, index) => ({
          id: `defi-activation-loading-${index}`,
          displayHeight: 68,
          renderer: 'loading',
          title: '',
        })),
      },
    ]);

    runtime.updateSection({
      commandRevision: 2,
      sectionId: 'defi',
      sections: [
        {
          id: 'defi-live',
          items: [{ id: 'position', renderer: 'defi', title: 'Position' }],
        },
      ],
    });

    expect(
      runtime.controller.getSnapshot().tabs.find((tab) => tab.id === 'defi')
        ?.sections,
    ).toEqual([
      {
        id: 'defi-live',
        items: [{ id: 'position', renderer: 'defi', title: 'Position' }],
      },
    ]);
    runtime.dispose();
  });
});
