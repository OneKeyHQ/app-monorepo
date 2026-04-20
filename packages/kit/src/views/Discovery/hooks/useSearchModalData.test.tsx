/**
 * @jest-environment jsdom
 */
/* eslint-disable import/first */

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    isNative: false,
    isDesktop: false,
    isWeb: true,
    isRuntimeBrowser: true,
    isRuntimeChrome: false,
  },
}));

jest.mock('@onekeyhq/kit/src/hooks/useRouteIsFocused', () => ({
  useRouteIsFocused: () => true,
}));

jest.mock('@onekeyhq/components', () => {
  const deferredPromiseModule = require('../../../../../components/src/hooks/useDeferredPromise');
  const netInfoModule = require('../../../../../components/src/hooks/useNetInfo');

  return {
    __esModule: true,
    getCurrentVisibilityState: () => true,
    onVisibilityStateChange: () => () => {},
    useDeferredPromise: deferredPromiseModule.useDeferredPromise,
    useNetInfo: netInfoModule.useNetInfo,
  };
});

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => {
  const serviceDiscovery = {
    getBookmarkData: jest.fn(),
    getHistoryData: jest.fn(),
    fetchDiscoveryHomePageData: jest.fn(),
    searchDApp: jest.fn(),
  };

  (globalThis as any).__useSearchModalDataMock = {
    serviceDiscovery,
  };

  return {
    __esModule: true,
    default: {
      serviceDiscovery,
    },
  };
});

jest.mock('../../../components/ReviewControl', () => ({
  useReviewControl: jest.fn(),
}));

import { renderHook, waitFor } from '@testing-library/react-native';

import { useReviewControl } from '../../../components/ReviewControl';
import { DISCOVERY_LOCAL_SEARCH_CANDIDATE_LIMIT } from '../utils/searchResultRanking';

import { useSearchModalData } from './useSearchModalData';

const reviewControlMock = jest.mocked(useReviewControl);
const serviceDiscoveryMock = (globalThis as any).__useSearchModalDataMock
  .serviceDiscovery as {
  getBookmarkData: jest.Mock;
  getHistoryData: jest.Mock;
  fetchDiscoveryHomePageData: jest.Mock;
  searchDApp: jest.Mock;
};

describe('useSearchModalData', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    reviewControlMock.mockReturnValue(false);
    serviceDiscoveryMock.getBookmarkData.mockResolvedValue([]);
    serviceDiscoveryMock.getHistoryData.mockResolvedValue([]);
    serviceDiscoveryMock.fetchDiscoveryHomePageData.mockResolvedValue({
      trending: [
        {
          dappId: 'uniswap',
          name: 'Uniswap',
          url: 'https://app.uniswap.org',
          logo: '',
          description: '',
          networkIds: [],
          tags: [],
        },
      ],
    });
    serviceDiscoveryMock.searchDApp.mockResolvedValue([
      {
        dappId: 'remote-uniswap',
        name: 'Remote Uniswap',
        url: 'https://app.uniswap.org',
        logo: '',
        description: '',
        networkIds: [],
        tags: [],
      },
    ]);
  });

  it('does not fetch or show trending suggestions when review control is disabled', async () => {
    const { result } = renderHook(() => useSearchModalData('uni'));

    await waitFor(() => {
      expect(serviceDiscoveryMock.getBookmarkData).toHaveBeenCalled();
      expect(serviceDiscoveryMock.getHistoryData).toHaveBeenCalled();
    });

    expect(
      serviceDiscoveryMock.fetchDiscoveryHomePageData,
    ).not.toHaveBeenCalled();
    expect(serviceDiscoveryMock.searchDApp).not.toHaveBeenCalled();
    expect(serviceDiscoveryMock.getHistoryData).toHaveBeenCalledWith({
      generateIcon: false,
      sliceCount: 200,
    });
    expect(result.current.searchList).toEqual([
      expect.objectContaining({
        type: 'search-action',
      }),
    ]);
  });

  it('keeps enough local candidates for chrome-like re-ranking before returning search results', async () => {
    const strongBookmark = {
      title: 'Portfolio',
      url: 'https://app.uniswap.org/swap',
      logo: '',
      sortIndex: 6,
    };
    const weakBookmarks = Array.from({ length: 6 }, (_, index) => ({
      title: `App unit tests ${index + 1}`,
      url: `https://example.com/posts/${index + 1}`,
      logo: '',
      sortIndex: index,
    }));

    serviceDiscoveryMock.getBookmarkData.mockImplementation(
      async (options?: {
        generateIcon?: boolean;
        keyword?: string;
        sliceCount?: number;
      }) => {
        if (options?.keyword === 'app.uni') {
          const items = [...weakBookmarks, strongBookmark];
          return items.slice(0, options.sliceCount ?? items.length);
        }
        return [];
      },
    );
    serviceDiscoveryMock.getHistoryData.mockImplementation(
      async (options?: {
        generateIcon?: boolean;
        keyword?: string;
        sliceCount?: number;
      }) => {
        if (options?.generateIcon === false) {
          return [];
        }
        if (options?.keyword === 'app.uni') {
          return [];
        }
        return [];
      },
    );

    const { result } = renderHook(() => useSearchModalData('app.uni'));

    await waitFor(() => {
      expect(result.current.searchList[0]).toEqual(
        expect.objectContaining({
          type: 'bookmark',
          url: strongBookmark.url,
        }),
      );
    });

    expect(serviceDiscoveryMock.getBookmarkData).toHaveBeenCalledWith({
      generateIcon: true,
      keyword: 'app.uni',
      sliceCount: DISCOVERY_LOCAL_SEARCH_CANDIDATE_LIMIT,
    });
    expect(serviceDiscoveryMock.getHistoryData).toHaveBeenCalledWith({
      generateIcon: true,
      keyword: 'app.uni',
      sliceCount: DISCOVERY_LOCAL_SEARCH_CANDIDATE_LIMIT,
    });
  });
});
