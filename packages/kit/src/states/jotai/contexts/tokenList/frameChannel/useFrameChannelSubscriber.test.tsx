/** @jest-environment jsdom */

import { act, renderHook } from '@testing-library/react';

import { useFrameChannelSubscriber } from './useFrameChannelSubscriber';

jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => {
  const { EventEmitter } =
    jest.requireActual<typeof import('events')>('events');
  return { appEventBus: new EventEmitter() };
});

const { appEventBus: bus } = jest.requireMock<{
  appEventBus: import('events').EventEmitter;
}>('@onekeyhq/shared/src/eventBus/appEventBus');

interface IFrame {
  ownerKey: string;
  slotId: string;
  version: number;
  baseVersion?: number;
}

function frame(slotId: string, version: number): IFrame {
  return { ownerKey: 'owner', slotId, version };
}

function renderSubscriber(
  pull: (opts?: { forceFull?: boolean }) => Promise<IFrame>,
) {
  const apply = jest.fn();
  const onSlotChange = jest.fn();
  renderHook(() =>
    useFrameChannelSubscriber<'structure', IFrame>({
      ownerKey: 'owner',
      enabled: true,
      applyOrder: ['structure'],
      pull,
      getPullOwnerKey: (payload) => payload.ownerKey,
      getPullSlotId: (payload) => payload.slotId,
      onSlotChange,
      kinds: [
        {
          kind: 'structure',
          eventName: 'structure',
          getOwnerKey: (payload) => (payload as IFrame).ownerKey,
          getSlotId: (payload) => (payload as IFrame).slotId,
          getVersion: (payload) => (payload as IFrame).version,
          canApplyPush: (payload, lastVersion) => {
            const { baseVersion } = payload as IFrame;
            return baseVersion === undefined || baseVersion === lastVersion;
          },
          apply,
          fromPull: (payload) => payload,
        },
      ],
    }),
  );
  return { apply, onSlotChange };
}

describe('useFrameChannelSubscriber slot ordering', () => {
  it('accepts a lower version from a replacement slot and drops pushes from the retired slot', async () => {
    const first = frame('old', 8);
    const replacement = frame('new', 0);
    const { apply, onSlotChange } = renderSubscriber(() =>
      Promise.resolve(first),
    );
    await act(async () => {});

    bus.emit('structure', replacement);
    bus.emit('structure', frame('old', 9));
    bus.emit('structure', frame('new', 0));

    expect(apply.mock.calls).toEqual([[first], [replacement]]);
    expect(onSlotChange).toHaveBeenCalledTimes(1);
  });

  it('accepts a full pull from a replacement slot after missing a push', async () => {
    const first = frame('old', 8);
    const replacement = frame('new', 0);
    const pull = jest
      .fn()
      .mockResolvedValueOnce(first)
      .mockResolvedValueOnce(replacement);
    const { apply, onSlotChange } = renderSubscriber(pull);
    await act(async () => {});

    await act(async () => {
      bus.emit('structure', { ...frame('old', 10), baseVersion: 9 });
    });

    expect(pull.mock.calls).toEqual([
      [{ forceFull: false }],
      [{ forceFull: true }],
    ]);
    expect(apply.mock.calls).toEqual([[first], [replacement]]);
    expect(onSlotChange).toHaveBeenCalledTimes(1);
  });

  it('resyncs a replacement-slot delta and discards the in-flight response from the retired slot', async () => {
    let finishInitialPull!: (payload: IFrame) => void;
    const pendingPull = new Promise<IFrame>((resolve) => {
      finishInitialPull = resolve;
    });
    const first = frame('old', 8);
    const replacement = frame('new', 1);
    const pull = jest
      .fn()
      .mockReturnValueOnce(pendingPull)
      .mockResolvedValueOnce(replacement);
    const { apply, onSlotChange } = renderSubscriber(pull);

    bus.emit('structure', first);
    bus.emit('structure', { ...replacement, baseVersion: 0 });
    await act(async () => {
      finishInitialPull(frame('old', 9));
    });

    expect(pull.mock.calls).toEqual([
      [{ forceFull: false }],
      [{ forceFull: true }],
    ]);
    expect(apply.mock.calls).toEqual([[first], [replacement]]);
    expect(onSlotChange).toHaveBeenCalledTimes(1);
  });
});
