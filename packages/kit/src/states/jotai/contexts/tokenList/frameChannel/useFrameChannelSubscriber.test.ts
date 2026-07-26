/**
 * @jest-environment jsdom
 */
import { act, renderHook, waitFor } from '@testing-library/react';

import { useFrameChannelSubscriber } from './useFrameChannelSubscriber';

type ITestPull = {
  ownerKey: string;
  value: string;
  version: number;
};

describe('useFrameChannelSubscriber', () => {
  it('re-pulls newer BG frames on demand without reapplying a version', async () => {
    let pulled: ITestPull = {
      ownerKey: 'owner-a',
      value: 'initial',
      version: 0,
    };
    const pull = jest.fn(async () => pulled);
    const apply = jest.fn();
    const { result } = renderHook(() =>
      useFrameChannelSubscriber<'value', ITestPull>({
        ownerKey: 'owner-a',
        enabled: true,
        applyOrder: ['value'],
        pull,
        getPullOwnerKey: (frame) => frame.ownerKey,
        kinds: [
          {
            kind: 'value',
            eventName: 'test-frame',
            getOwnerKey: (frame) => (frame as ITestPull).ownerKey,
            getVersion: (frame) => (frame as ITestPull).version,
            apply,
            fromPull: (frame) => frame,
          },
        ],
      }),
    );

    await waitFor(() => expect(apply).toHaveBeenCalledTimes(1));
    expect(apply).toHaveBeenLastCalledWith(pulled);

    pulled = { ownerKey: 'owner-a', value: 'updated', version: 1 };
    await act(async () => result.current());
    expect(apply).toHaveBeenCalledTimes(2);
    expect(apply).toHaveBeenLastCalledWith(pulled);

    await act(async () => result.current());
    expect(apply).toHaveBeenCalledTimes(2);
  });
});
