/**
 * @jest-environment jsdom
 */

import type { ReactNode } from 'react';

import { render } from '@testing-library/react';

import type { ImageSource } from 'expo-image';

type IMockExpoImageProps = {
  cachePolicy?: string;
  source?: ImageSource;
};

const mockExpoImageProps: IMockExpoImageProps[] = [];
let mockSkeletonCount = 0;
let mockIsNativeAndroid = true;
let mockImage: ImageSource | null = null;

jest.mock('expo-image', () => ({
  Image: (props: IMockExpoImageProps) => {
    mockExpoImageProps.push(props);
    return null;
  },
  resolveSource: (source: ImageSource | string | number | undefined) => {
    if (typeof source === 'string') {
      return { uri: source };
    }
    if (typeof source === 'number' || !source) {
      return null;
    }
    return source;
  },
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    get isNativeAndroid() {
      return mockIsNativeAndroid;
    },
  },
}));

jest.mock('@onekeyhq/components/src/shared/tamagui', () => ({
  usePropsAndStyle: (props: Record<string, unknown>) => [
    props,
    { width: props.size, height: props.size },
  ],
}));

jest.mock('../Skeleton', () => ({
  Skeleton: () => {
    mockSkeletonCount += 1;
    return null;
  },
}));

jest.mock('../Stack', () => ({
  Stack: ({ children }: { children?: ReactNode }) => <>{children}</>,
}));

jest.mock('./AnimatedImage', () => ({
  AnimatedExpoImage: () => null,
}));

jest.mock('./optimization', () => ({
  buildOptimizedImageSource: ({
    resolvedSource,
  }: {
    resolvedSource: ImageSource | null;
  }) => ({
    optimized: false,
    source: resolvedSource,
    rawSource: resolvedSource,
    rawUri: resolvedSource?.uri,
  }),
}));

jest.mock('./useImage', () => ({
  useImage: () => ({ image: mockImage, reFetchImage: jest.fn() }),
}));

const REMOTE_URI = 'https://example.com/a.png';
const REMOTE_SOURCE = { uri: REMOTE_URI };

// The component reads platformEnv at module scope, so require it lazily once
// the mock state above has been initialized.
let ImageV2: typeof import('./ImageV2.native').ImageV2;

describe('ImageV2 (native)', () => {
  beforeAll(() => {
    const imageModule: typeof import('./ImageV2.native') = require('./ImageV2.native');
    ImageV2 = imageModule.ImageV2;
  });

  beforeEach(() => {
    mockExpoImageProps.length = 0;
    mockSkeletonCount = 0;
    mockIsNativeAndroid = true;
    mockImage = REMOTE_SOURCE;
  });

  it('lets Glide keep decoded bitmaps in memory for URL sources on Android', () => {
    render(<ImageV2 source={REMOTE_SOURCE} size={40} />);

    expect(mockExpoImageProps).toEqual([
      expect.objectContaining({
        cachePolicy: 'memory-disk',
        source: { uri: REMOTE_URI },
      }),
    ]);
    expect(mockSkeletonCount).toBe(0);
  });

  it('keeps an explicit cache policy from the caller', () => {
    render(<ImageV2 source={REMOTE_SOURCE} size={40} cachePolicy="none" />);

    expect(mockExpoImageProps).toEqual([
      expect.objectContaining({ cachePolicy: 'none' }),
    ]);
  });

  it('leaves the cache policy untouched off Android', () => {
    mockIsNativeAndroid = false;

    render(<ImageV2 source={REMOTE_SOURCE} size={40} />);

    expect(mockExpoImageProps).toHaveLength(1);
    expect(mockExpoImageProps[0].cachePolicy).toBeUndefined();
  });

  it('shows the skeleton until useImage resolves a source', () => {
    mockImage = null;

    render(<ImageV2 source={REMOTE_SOURCE} size={40} />);

    expect(mockExpoImageProps).toHaveLength(0);
    expect(mockSkeletonCount).toBe(1);
  });
});
