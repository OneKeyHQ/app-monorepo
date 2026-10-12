/**
 * @jest-environment jsdom
 */

import { render } from '@testing-library/react';

import { NetworkAvatar } from './NetworkAvatar';

/*
yarn jest packages/kit/src/components/NetworkAvatar/NetworkAvatar.test.tsx
*/

jest.mock('@onekeyhq/components', () => {
  const Passthrough = ({ children }: { children?: React.ReactNode }) => (
    <div>{children}</div>
  );
  return {
    Badge: Passthrough,
    Icon: ({ name }: { name: string }) => <span data-icon={name} />,
    Image: ({ src }: { src?: string }) => <img alt="" data-src={src} />,
    Stack: Passthrough,
    Tooltip: Passthrough,
    XStack: Passthrough,
  };
});

// The network record is still in flight: model the moment right after an
// account switch, before `serviceNetwork.getNetwork` has answered.
jest.mock('../../hooks/usePromiseResult', () => ({
  usePromiseResult: (
    _fn: unknown,
    _deps: unknown,
    options?: { initResult?: unknown },
  ) => ({ result: options?.initResult, run: jest.fn() }),
}));

jest.mock('../../background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceNetwork: {
      getNetwork: jest.fn(() => new Promise(() => {})),
      getNetworkSafe: jest.fn(() => new Promise(() => {})),
    },
  },
}));

jest.mock('../LetterAvatar', () => ({
  LetterAvatar: () => <span data-letter-avatar="" />,
}));

describe('NetworkAvatar', () => {
  // Slack 09-22 QA report: switching to a watching address under All Networks
  // painted the colored All Networks logo until the async network record
  // arrived with `isAllNetworks`. The id alone identifies All Networks, so the
  // monochrome icon must render on the first frame.
  it('renders the All Networks icon before the network record resolves', () => {
    const { container } = render(<NetworkAvatar networkId="onekeyall--0" />);

    expect(
      container.querySelector('[data-icon="AllNetworksSolid"]'),
    ).not.toBeNull();
    expect(container.querySelector('img')).toBeNull();
  });

  it('still paints a regular network from its local logo while loading', () => {
    const { container } = render(<NetworkAvatar networkId="evm--1" />);

    expect(
      container.querySelector('[data-icon="AllNetworksSolid"]'),
    ).toBeNull();
    expect(
      container.querySelector('img')?.getAttribute('data-src'),
    ).toBeTruthy();
  });
});
