import { act, create } from 'react-test-renderer';

import { Video } from './index.native';

import type { IVideoProps } from './type';

// jest-expo supplies a React Native mock; StyleSheet.flatten lives on RNW.
jest.unmock('react-native');

type IMockListener = (...args: unknown[]) => void;
const mockListeners = new Map<string, Set<IMockListener>>();
const mockPlayer = {
  status: 'idle' as string,
  play() {},
  pause() {},
  seekTo() {},
  addEventListener(event: string, callback: IMockListener) {
    const set = mockListeners.get(event) ?? new Set<IMockListener>();
    set.add(callback);
    mockListeners.set(event, set);
    return {
      remove() {
        set.delete(callback);
      },
    };
  },
};

function emitMockEvent(event: string, ...args: unknown[]) {
  mockListeners.get(event)?.forEach((callback) => callback(...args));
}

jest.mock('react-native-video', () => ({
  VideoView: () => null,
  useVideoPlayer: () => mockPlayer,
}));

jest.mock('@onekeyhq/components/src/shared/tamagui', () => ({
  usePropsAndStyle: (props: Record<string, unknown>) => [props, {}],
}));

const SOURCE = { uri: 'https://example.com/asset.png' };

function mountVideo(props: Omit<IVideoProps, 'source'> = {}) {
  let root: ReturnType<typeof create> | undefined;
  act(() => {
    root = create(<Video source={SOURCE} {...props} />);
  });
  return {
    unmount: () => {
      act(() => {
        root?.unmount();
      });
    },
  };
}

describe('native Video error delivery', () => {
  beforeEach(() => {
    mockListeners.clear();
    mockPlayer.status = 'idle';
  });

  it('forwards a native error status to onError', () => {
    const onError = jest.fn();
    mountVideo({ onError });

    act(() => {
      emitMockEvent('onStatusChange', 'loading');
    });
    expect(onError).not.toHaveBeenCalled();

    act(() => {
      emitMockEvent('onStatusChange', 'error');
    });
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('reports an error status that landed before the listener attached', () => {
    const onError = jest.fn();
    mockPlayer.status = 'error';
    mountVideo({ onError });

    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('does not subscribe to status changes without onError', () => {
    mountVideo();

    expect(mockListeners.get('onStatusChange')?.size ?? 0).toBe(0);
  });

  it('stops forwarding after unmount', () => {
    const onError = jest.fn();
    const { unmount } = mountVideo({ onError });
    unmount();

    act(() => {
      emitMockEvent('onStatusChange', 'error');
    });
    expect(onError).not.toHaveBeenCalled();
  });
});
