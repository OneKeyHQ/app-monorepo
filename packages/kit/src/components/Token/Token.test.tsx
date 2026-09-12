import type { ReactNode } from 'react';

import { render } from '@testing-library/react-native';

import { Token } from './Token';

type IMockImageProps = {
  source?: { uri?: string };
};

// Records mount / unmount of the underlying image so the tests can prove the
// image element survives prop changes instead of being torn down and rebuilt.
const mockImageLifecycle: string[] = [];
const mockNetworkAvatarBase = jest.fn<null, [{ logoURI?: string }]>(() => null);

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('@onekeyhq/components', () => {
  const React: typeof import('react') = require('react');

  function Stack({ children }: { children?: ReactNode }) {
    return <>{children}</>;
  }

  function Image(props: IMockImageProps) {
    const uri = props.source?.uri;
    React.useEffect(() => {
      mockImageLifecycle.push(`mount:${uri ?? ''}`);
      return () => {
        mockImageLifecycle.push(`unmount:${uri ?? ''}`);
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return null;
  }
  Image.WithFallbackSources = Image;

  function Badge({ children }: { children?: ReactNode }) {
    return <>{children}</>;
  }
  Badge.Text = Stack;

  return {
    Badge,
    Icon: Stack,
    Image,
    SizableText: Stack,
    Skeleton: Stack,
    Stack,
    Tooltip: Stack,
    XStack: Stack,
    // `tokenSize.ts` deep-imports the scale helper through the same package
    // alias, so the factory has to provide it as well.
    s: (size: number) => size,
  };
});

jest.mock('../NetworkAvatar', () => ({
  NetworkAvatar: () => null,
  NetworkAvatarBase: (props: { logoURI?: string }) =>
    mockNetworkAvatarBase(props),
}));

jest.mock('../../hooks/useThemeVariant', () => ({
  useThemeVariant: () => 'light',
}));

jest.mock('../../hooks/useAccountData', () => ({
  useAccountData: () => ({ network: undefined }),
}));

describe('Token', () => {
  const tokenImageUri = 'https://img.test/token.png';
  const networkImageUri = 'https://img.test/network.png';

  beforeEach(() => {
    mockImageLifecycle.length = 0;
    mockNetworkAvatarBase.mockClear();
  });

  it('keeps the token image mounted when the network logo arrives later', () => {
    const { rerender } = render(<Token tokenImageUri={tokenImageUri} />);

    rerender(
      <Token tokenImageUri={tokenImageUri} networkImageUri={networkImageUri} />,
    );

    expect(mockImageLifecycle).toEqual([`mount:${tokenImageUri}`]);
  });

  it('renders the network overlay once the network logo is known', () => {
    const { rerender } = render(<Token tokenImageUri={tokenImageUri} />);
    expect(mockNetworkAvatarBase).not.toHaveBeenCalled();

    rerender(
      <Token tokenImageUri={tokenImageUri} networkImageUri={networkImageUri} />,
    );

    expect(mockNetworkAvatarBase).toHaveBeenCalledWith(
      expect.objectContaining({ logoURI: networkImageUri }),
    );
  });

  it('keeps the token image mounted when the network logo is removed', () => {
    const { rerender } = render(
      <Token tokenImageUri={tokenImageUri} networkImageUri={networkImageUri} />,
    );

    rerender(<Token tokenImageUri={tokenImageUri} />);

    expect(mockImageLifecycle).toEqual([`mount:${tokenImageUri}`]);
  });
});
