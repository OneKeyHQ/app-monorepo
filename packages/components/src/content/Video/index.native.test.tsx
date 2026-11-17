import { TamaguiProvider, createTamagui } from '@tamagui/web';
import { renderToStaticMarkup } from 'react-dom/server';
import { StyleSheet } from 'react-native';

import { Video } from './index.native';

import type { IVideoProps } from './type';
import type { StyleProp, ViewStyle } from 'react-native';

// jest-expo supplies a React Native mock; StyleSheet.flatten lives on RNW.
jest.unmock('react-native');

type ICapturedVideoViewProps = {
  style?: StyleProp<ViewStyle>;
};

const mockVideoView = jest.fn((_props: ICapturedVideoViewProps) => null);

jest.mock('react-dom/server', () =>
  jest.requireActual<typeof import('react-dom/server')>(
    'react-dom/server.node',
  ),
);

jest.mock('react-native-video', () => ({
  VideoView: (props: ICapturedVideoViewProps) => mockVideoView(props),
  useVideoPlayer: () => ({
    play() {},
    pause() {},
    seekTo() {},
    addEventListener() {
      return { remove() {} };
    },
  }),
}));

jest.mock('@onekeyhq/components/src/shared/tamagui', () =>
  jest.requireActual<typeof import('@tamagui/web')>('@tamagui/web'),
);

const SOURCE = { uri: 'https://example.com/prime.mp4' };
const PRIME_FEATURE_MEDIA_FILL: ViewStyle = {
  position: 'absolute',
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
  width: '100%',
  height: '100%',
  transform: [{ scale: 1.01 }],
};

const tamaguiConfig = createTamagui({
  tokens: {
    color: { white: '#fff', black: '#000' },
    space: { 0: 0, true: 0 },
    size: { 0: 0, true: 0 },
    radius: { 0: 0, true: 0 },
    zIndex: { 0: 0, true: 0 },
  },
  themes: {
    light: {
      background: '#fff',
      color: '#000',
    },
  },
  shorthands: {
    w: 'width',
    h: 'height',
  },
});

function renderVideo(props: Omit<IVideoProps, 'source'> = {}) {
  renderToStaticMarkup(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <Video source={SOURCE} {...props} />
    </TamaguiProvider>,
  );
}

function getRenderedStyle(): ViewStyle {
  const lastCall = mockVideoView.mock.calls.at(-1);
  expect(lastCall).toBeDefined();
  return StyleSheet.flatten(lastCall?.[0].style) ?? {};
}

describe('native Video style merging', () => {
  beforeEach(() => {
    mockVideoView.mockClear();
  });

  it('forwards the Prime feature fill style to VideoView', () => {
    renderVideo({ style: PRIME_FEATURE_MEDIA_FILL });

    expect(getRenderedStyle()).toEqual(
      expect.objectContaining(PRIME_FEATURE_MEDIA_FILL),
    );
  });

  it('resolves shorthand-only dimensions onto VideoView', () => {
    renderVideo({ w: 120, h: 80 });

    // Root Jest uses Tamagui's web target, so numeric shorthands become px strings.
    expect(getRenderedStyle()).toEqual(
      expect.objectContaining({ width: '120px', height: '80px' }),
    );
  });

  it('lets caller style arrays override shorthands while keeping unspecified values', () => {
    renderVideo({
      w: 200,
      h: 100,
      style: [{ width: 300 }, { opacity: 0.5 }],
    });

    expect(getRenderedStyle()).toEqual(
      expect.objectContaining({
        width: 300,
        height: '100px',
        opacity: 0.5,
      }),
    );
  });
});
