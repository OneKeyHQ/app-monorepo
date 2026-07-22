import { type ReactNode, createElement } from 'react';

import { type ReactTestRenderer, act, create } from 'react-test-renderer';

import { HomeStoreSourceControllers } from './HomeStoreSourceControllers';

const mockTestGlobal = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};
let mockHomeRuntime: {
  topology: 'split';
  connection: 'ready' | 'waiting';
  producerInstanceId?: string;
  protocolVersion: number;
} = {
  topology: 'split' as const,
  connection: 'ready' as const,
  producerInstanceId: 'producer-a',
  protocolVersion: 1,
};

jest.mock('@onekeyhq/kit/src/states/jotai/contexts/home', () => ({
  useHomeInteraction: () => ({
    sectionControls: {
      portfolio: { 'home.portfolio.showLpTokensOnly': false },
    },
  }),
  useHomeRuntimeState: () => mockHomeRuntime,
}));

jest.mock(
  '../../components/HomeTokenListProvider/HomeTokenListProviderMirror',
  () => {
    const React = jest.requireActual<typeof import('react')>('react');
    return {
      HomeTokenListProviderMirror: ({ children }: { children?: ReactNode }) =>
        React.createElement('View', { testID: 'token-list-mirror' }, children),
    };
  },
);

jest.mock('./HomeBalanceStoreController', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    HomeBalanceStoreController: () =>
      React.createElement('View', { testID: 'balance-controller' }),
  };
});

jest.mock('./HomeAccountValuePersistenceController', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    HomeAccountValuePersistenceController: () =>
      React.createElement('View', { testID: 'account-value-controller' }),
  };
});

jest.mock('./HomeBannerStoreController', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    HomeBannerStoreController: () =>
      React.createElement('View', { testID: 'banner-controller' }),
  };
});

jest.mock(
  '../../components/TokenListBlock/HomePortfolioStoreController',
  () => {
    const React = jest.requireActual<typeof import('react')>('react');
    return {
      HomePortfolioStoreController: () =>
        React.createElement('View', { testID: 'portfolio-controller' }),
    };
  },
);

jest.mock('./HomeCapabilityStoreController', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    HomeCapabilityStoreController: () =>
      React.createElement('View', { testID: 'capability-controller' }),
  };
});

jest.mock('./HomeDeFiStoreController', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    HomeDeFiStoreController: () =>
      React.createElement('View', { testID: 'defi-controller' }),
  };
});

jest.mock('./HomeHistoryStoreController', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    HomeHistoryStoreController: () =>
      React.createElement('View', { testID: 'history-controller' }),
  };
});

jest.mock('./HomeMarketStoreController', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    HomeMarketStoreController: () =>
      React.createElement('View', { testID: 'market-controller' }),
  };
});

jest.mock('./HomeNFTStoreController', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    HomeNFTStoreController: () =>
      React.createElement('View', { testID: 'nft-controller' }),
  };
});

jest.mock('./HomePerpsStoreController', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    HomePerpsStoreController: () =>
      React.createElement('View', { testID: 'perps-controller' }),
  };
});

jest.mock('./HomePortfolioControlPersistenceController', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    HomePortfolioControlPersistenceController: () =>
      React.createElement('View', { testID: 'portfolio-control-controller' }),
  };
});

jest.mock('./HomeStoreControllerBridge', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    HomeStoreControllerBridge: () =>
      React.createElement('View', { testID: 'runtime-controller' }),
  };
});

jest.mock('./HomeStoreCommandController', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    HomeStoreCommandController: () =>
      React.createElement('View', { testID: 'command-controller' }),
  };
});

jest.mock('./HomeStoreSnapshotController', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    HomeStoreSnapshotController: () =>
      React.createElement('View', { testID: 'snapshot-controller' }),
  };
});

beforeAll(() => {
  mockTestGlobal.IS_REACT_ACT_ENVIRONMENT = true;
});

afterAll(() => {
  delete mockTestGlobal.IS_REACT_ACT_ENVIRONMENT;
});

describe('HomeStoreSourceControllers', () => {
  beforeEach(() => {
    mockHomeRuntime = {
      topology: 'split',
      connection: 'ready',
      producerInstanceId: 'producer-a',
      protocolVersion: 1,
    };
  });

  it('mounts only runtime and cache controllers outside Wallet Home', () => {
    let view!: ReactTestRenderer;
    act(() => {
      view = create(<HomeStoreSourceControllers />);
    });

    expect(
      view.root.findAllByProps({ testID: 'runtime-controller' }),
    ).toHaveLength(1);
    expect(
      view.root.findAllByProps({ testID: 'capability-controller' }),
    ).toHaveLength(0);
    expect(
      view.root.findAllByProps({ testID: 'balance-controller' }),
    ).toHaveLength(0);
    expect(
      view.root.findAllByProps({ testID: 'snapshot-controller' }),
    ).toHaveLength(1);
    expect(
      view.root.findAllByProps({ testID: 'command-controller' }),
    ).toHaveLength(0);
    expect(
      view.root.findAllByProps({ testID: 'portfolio-control-controller' }),
    ).toHaveLength(0);

    act(() => view.unmount());
  });

  it('mounts wallet domain sources only for the Wallet Home scene', () => {
    let view!: ReactTestRenderer;
    act(() => {
      view = create(
        <HomeStoreSourceControllers enableWalletSources>
          {createElement('View', { testID: 'home-renderer' })}
        </HomeStoreSourceControllers>,
      );
    });

    expect(
      view.root.findAllByProps({ testID: 'banner-controller' }),
    ).toHaveLength(1);
    expect(
      view.root.findAllByProps({ testID: 'account-value-controller' }),
    ).toHaveLength(1);
    expect(
      view.root.findAllByProps({ testID: 'command-controller' }),
    ).toHaveLength(1);
    expect(
      view.root.findAllByProps({ testID: 'perps-controller' }),
    ).toHaveLength(1);
    expect(
      view.root.findAllByProps({ testID: 'defi-controller' }),
    ).toHaveLength(1);
    expect(
      view.root.findAllByProps({ testID: 'history-controller' }),
    ).toHaveLength(1);
    expect(
      view.root.findAllByProps({ testID: 'portfolio-controller' }),
    ).toHaveLength(1);
    expect(
      view.root.findAllByProps({ testID: 'portfolio-control-controller' }),
    ).toHaveLength(1);
    expect(
      view.root
        .findByProps({ testID: 'token-list-mirror' })
        .findAllByProps({ testID: 'portfolio-controller' }),
    ).toHaveLength(1);
    expect(view.root.findAllByProps({ testID: 'nft-controller' })).toHaveLength(
      1,
    );
    expect(
      view.root.findAllByProps({ testID: 'market-controller' }),
    ).toHaveLength(1);
    expect(view.root.findAllByProps({ testID: 'home-renderer' })).toHaveLength(
      1,
    );

    act(() => view.unmount());
  });

  it('starts every wallet producer only after the runtime handshake is ready', () => {
    mockHomeRuntime = {
      topology: 'split',
      connection: 'waiting',
      producerInstanceId: undefined,
      protocolVersion: 0,
    };
    let view!: ReactTestRenderer;
    const render = () => <HomeStoreSourceControllers enableWalletSources />;
    act(() => {
      view = create(render());
    });

    expect(
      view.root.findAllByProps({ testID: 'portfolio-controller' }),
    ).toHaveLength(0);
    expect(
      view.root.findAllByProps({ testID: 'balance-controller' }),
    ).toHaveLength(0);
    expect(
      view.root.findAllByProps({ testID: 'banner-controller' }),
    ).toHaveLength(0);
    expect(
      view.root.findAllByProps({ testID: 'command-controller' }),
    ).toHaveLength(1);

    mockHomeRuntime = {
      topology: 'split',
      connection: 'ready',
      producerInstanceId: 'producer-after-handshake',
      protocolVersion: 1,
    };
    act(() => view.update(render()));

    expect(
      view.root.findAllByProps({ testID: 'portfolio-controller' }),
    ).toHaveLength(1);
    expect(
      view.root.findAllByProps({ testID: 'balance-controller' }),
    ).toHaveLength(1);
    expect(
      view.root.findAllByProps({ testID: 'banner-controller' }),
    ).toHaveLength(1);
    expect(
      view.root.findAllByProps({ testID: 'command-controller' }),
    ).toHaveLength(1);

    mockHomeRuntime = {
      topology: 'split',
      connection: 'waiting',
      producerInstanceId: undefined,
      protocolVersion: 0,
    };
    act(() => view.update(render()));

    expect(
      view.root.findAllByProps({ testID: 'portfolio-controller' }),
    ).toHaveLength(0);
    expect(
      view.root.findAllByProps({ testID: 'balance-controller' }),
    ).toHaveLength(0);
    expect(
      view.root.findAllByProps({ testID: 'banner-controller' }),
    ).toHaveLength(0);
    expect(
      view.root.findAllByProps({ testID: 'command-controller' }),
    ).toHaveLength(1);

    act(() => view.unmount());
  });
});
