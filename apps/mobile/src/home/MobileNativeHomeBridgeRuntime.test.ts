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

describe('MobileNativeHomeBridgeRuntime owner replacement', () => {
  it('keeps one controller without reauthorizing old-owner slot content', async () => {
    const initialOwner = owner('owner-a', 'session-a');
    const nextOwner = owner('owner-b', 'session-b');
    const runtime = new MobileNativeHomeBridgeRuntime(
      initialOwner,
      () => 7,
      theme,
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
      },
      backgroundColor: '#ffffff',
    });
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
      semanticRevision: 7,
      slots: {},
    });
    expect(runtime.getSlotBundle().slots.accountRow).toBeUndefined();
    expect(listener).not.toHaveBeenCalled();

    runtime.updateSlots('header', {
      accountRow: {
        authority: runtime.authority('header.account-row', 4),
        content: 'new-account-slot',
      },
    });
    await Promise.resolve();

    expect(runtime.getSlotBundle()).toMatchObject({
      owner: nextOwner,
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
});
