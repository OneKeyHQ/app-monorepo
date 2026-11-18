import type { ReactNode } from 'react';
import { useEffect } from 'react';

import { act, render } from '@testing-library/react-native';

import { useMarketDetailDisplayData } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/hooks/useMarketDetailDisplayData';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type {
  IMarketStockDetailPreview,
  IMarketTokenDetail,
  IMarketTokenDetailPreview,
} from '@onekeyhq/shared/types/marketV2';

import { Token } from './Token';

type IMockImageProps = {
  round?: boolean;
  source?: { uri?: string };
  src?: string;
  onError?: (event: { error: string }) => void;
};

// Records mount / unmount of the underlying image so the tests can prove the
// image element survives prop changes instead of being torn down and rebuilt.
const mockImageLifecycle: string[] = [];
const mockImageProps: IMockImageProps[] = [];
const mockNetworkAvatarBase = jest.fn<null, [{ logoURI?: string }]>(() => null);
let mockTokenDetail: IMarketTokenDetail | undefined;
let mockTokenDetailPreview: IMarketTokenDetailPreview | undefined;
let mockStockPreview: IMarketStockDetailPreview | undefined;

function MockImage(props: IMockImageProps) {
  mockImageProps.push(props);
  const uri = props.source?.uri ?? props.src;
  useEffect(() => {
    mockImageLifecycle.push(`mount:${uri ?? ''}`);
    return () => {
      mockImageLifecycle.push(`unmount:${uri ?? ''}`);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

jest.mock('../../../../components/src/primitives/Image/ImageV2', () => ({
  ImageV2: MockImage,
}));
jest.mock('../../views/Market/MarketDetailV2/hooks/useTokenDetail', () => ({
  useTokenDetail: () => ({
    tokenAddress: '0xtoken',
    networkId: 'evm--1',
    isNative: false,
    tokenDetail: mockTokenDetail,
    tokenDetailPreview: mockTokenDetailPreview,
  }),
}));
jest.mock('../../views/Market/MarketDetailV2/hooks/StockDetailContext', () => ({
  useStockDetail: () => ({ stockPreview: mockStockPreview }),
}));

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('@onekeyhq/components', () => {
  function Stack({ children }: { children?: ReactNode }) {
    return <>{children}</>;
  }

  const { ImageWithFallbackSources } = jest.requireActual<
    typeof import('../../../../components/src/primitives/Image/ImageWithFallbackSources')
  >('../../../../components/src/primitives/Image/ImageWithFallbackSources');
  const Image = Object.assign(MockImage, {
    WithFallbackSources: ImageWithFallbackSources,
  });

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
    mockImageProps.length = 0;
    mockNetworkAvatarBase.mockClear();
    platformEnv.isNativeAndroid = false;
    mockTokenDetail = undefined;
    mockTokenDetailPreview = undefined;
    mockStockPreview = undefined;
  });

  it.each(['token', 'stock'] as const)(
    'keeps the %s preview image mounted when the first detail adds a fallback',
    (kind) => {
      const fallbackUri = 'https://img.test/fallback.png';
      const identity = {
        address: '0xtoken',
        networkId: 'evm--1',
        name: 'Token',
        symbol: 'TOKEN',
        decimals: 18,
      };
      if (kind === 'token') {
        mockTokenDetailPreview = { ...identity, tokenImageUri, selectedAt: 1 };
      } else {
        mockStockPreview = {
          stockId: 'TOKEN',
          name: 'Token',
          symbol: 'TOKEN',
          logoUrl: tokenImageUri,
        };
      }
      function DetailToken() {
        const { tokenDetail } = useMarketDetailDisplayData();
        return (
          <Token
            tokenImageUri={tokenDetail?.logoUrl}
            tokenImageUris={tokenDetail?.logoUrls}
          />
        );
      }
      const { rerender } = render(<DetailToken />);
      mockTokenDetail = {
        ...identity,
        logoUrl: tokenImageUri,
        logoUrls: [tokenImageUri, fallbackUri],
      };
      mockTokenDetailPreview = undefined;
      rerender(<DetailToken />);

      expect(mockImageLifecycle).toEqual([`mount:${tokenImageUri}`]);
      act(() => {
        mockImageProps.at(-1)?.onError?.({ error: 'Primary image failed' });
      });
      expect(mockImageProps.at(-1)?.src).toBe(fallbackUri);
      expect(mockImageLifecycle).toEqual([`mount:${tokenImageUri}`]);
    },
  );

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

  it('rounds Android fungible tokens in the native image without rounding NFTs', () => {
    platformEnv.isNativeAndroid = true;
    const { rerender } = render(<Token tokenImageUri={tokenImageUri} />);
    expect(mockImageProps.at(-1)?.round).toBe(true);

    rerender(<Token tokenImageUri={tokenImageUri} isNFT />);
    expect(mockImageProps.at(-1)?.round).toBeUndefined();
  });

  it('keeps the previous image path outside Android', () => {
    render(<Token tokenImageUri={tokenImageUri} />);
    expect(mockImageProps.at(-1)?.round).toBeUndefined();
  });
});
