/** @jest-environment jsdom */

import { Fragment, createElement } from 'react';

import { render } from '@testing-library/react';

const mockExpoImageRender = jest.fn();
const mockLoadAsync = jest.fn();

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    isNative: true,
    isNativeAndroid: true,
    isNativeIOS: false,
  },
}));

jest.mock('@onekeyhq/components/src/shared/tamagui', () => ({
  usePropsAndStyle: (props: Record<string, unknown>) => [
    props,
    { height: 24, width: 24 },
  ],
}));

jest.mock('react-native', () => ({
  StyleSheet: {
    flatten: () => ({ height: 24, width: 24 }),
  },
}));

jest.mock('expo-image', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const ExpoImage = (props: Record<string, unknown>) => {
    mockExpoImageRender(props);
    return React.createElement('div', { 'data-testid': 'expo-image' });
  };
  ExpoImage.loadAsync = (...args: unknown[]): Promise<never> =>
    mockLoadAsync(...args) as Promise<never>;
  ExpoImage.getCachePathAsync = jest.fn();
  return {
    Image: ExpoImage,
    resolveSource: (source: string | { uri?: string } | undefined) =>
      typeof source === 'string' ? { uri: source } : source,
  };
});

jest.mock('../Skeleton', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    Skeleton: () => React.createElement('div', { 'data-testid': 'skeleton' }),
  };
});

jest.mock('../Stack', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    Stack: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
  };
});

jest.mock('./AnimatedImage', () => ({
  AnimatedExpoImage: () => null,
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const {
  ImageV2,
}: typeof import('./ImageV2.native') = require('./ImageV2.native');

describe('ImageV2 Android resource path', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('gives each View the URL and delegates reuse to Glide memory-disk cache', () => {
    const uri = 'https://example.com/android-token.png';

    render(
      createElement(
        Fragment,
        null,
        createElement(ImageV2, { source: { uri } }),
        createElement(ImageV2, { source: { uri } }),
      ),
    );

    expect(mockExpoImageRender).toHaveBeenCalledTimes(2);
    const sources = mockExpoImageRender.mock.calls.map(
      ([props]: [Record<string, unknown>]) => props.source,
    );
    expect(sources).toEqual([{ uri }, { uri }]);
    expect(mockExpoImageRender).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ cachePolicy: 'memory-disk' }),
    );
    expect(mockExpoImageRender).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ cachePolicy: 'memory-disk' }),
    );
    expect(mockLoadAsync).not.toHaveBeenCalled();
  });
});
