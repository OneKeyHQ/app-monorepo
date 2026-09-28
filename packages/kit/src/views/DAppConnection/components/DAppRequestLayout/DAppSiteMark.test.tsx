/** @jest-environment jsdom */

import type { PropsWithChildren } from 'react';

import { render, screen } from '@testing-library/react';

import type { IDappSourceInfo } from '@onekeyhq/shared/types';
import {
  EHostSecurityLevel,
  type IHostSecurity,
} from '@onekeyhq/shared/types/discovery';

import { DAppSiteMark } from './DAppSiteMark';

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: () => 'Unverified' }),
}));
jest.mock('@onekeyhq/components', () => {
  const TestImage = ({ source }: { source: { uri: string } }) => (
    <span data-testid="site-image" data-uri={source.uri} />
  );
  TestImage.Fallback = ({ children }: PropsWithChildren) => children;
  return {
    Image: TestImage,
    Icon: ({ name }: { name: string }) => <span data-testid={name} />,
    SizableText: ({ children }: PropsWithChildren) => <span>{children}</span>,
    XStack: ({ children }: PropsWithChildren) => <div>{children}</div>,
  };
});
jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({
  // A previously resolved icon must not leak into an unverified request.
  usePromiseResult: () => ({ result: 'https://icons.example/previous.png' }),
}));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: { serviceDiscovery: { buildWebsiteIconUrl: jest.fn() } },
}));

const sourceInfo: IDappSourceInfo = {
  id: 'test-request',
  origin: 'https://help.onekey.so',
  hostname: 'help.onekey.so',
  scope: 'ethereum',
  data: { method: 'personal_sign', params: [] },
  isWalletConnectRequest: true,
};
const securityInfo = { level: EHostSecurityLevel.Security } as IHostSecurity;

describe('signing requester display identity', () => {
  it.each([undefined, ''])(
    'never shows a claimed domain, icon or verified badge without a display origin (%s)',
    (displayOrigin) => {
      render(
        <DAppSiteMark
          origin={sourceInfo.origin}
          sourceInfo={{ ...sourceInfo, displayOrigin }}
          favicon="https://help.onekey.so/favicon.ico"
          urlSecurityInfo={securityInfo}
        />,
      );
      expect(screen.getByText('Unverified')).toBeTruthy();
      expect(screen.getByTestId('GlobusOutline')).toBeTruthy();
      expect(screen.queryByText('help.onekey.so')).toBeNull();
      expect(screen.queryByTestId('site-image')).toBeNull();
      expect(screen.queryByTestId('BadgeVerifiedSolid')).toBeNull();
    },
  );

  it('shows the attested mismatch origin and retains its risk indicator', () => {
    render(
      <DAppSiteMark
        origin={sourceInfo.origin}
        sourceInfo={{ ...sourceInfo, displayOrigin: 'https://actual.example' }}
        favicon="https://help.onekey.so/favicon.ico"
        urlSecurityInfo={{ level: EHostSecurityLevel.High } as IHostSecurity}
      />,
    );
    expect(screen.getByText('actual.example')).toBeTruthy();
    expect(screen.queryByText('help.onekey.so')).toBeNull();
    expect(screen.getByTestId('ErrorSolid')).toBeTruthy();
    expect(screen.getByTestId('site-image').getAttribute('data-uri')).not.toBe(
      'https://help.onekey.so/favicon.ico',
    );
  });

  it('clears an attested identity when the next request is unverified', () => {
    const { rerender } = render(
      <DAppSiteMark
        origin={sourceInfo.origin}
        sourceInfo={{ ...sourceInfo, displayOrigin: sourceInfo.origin }}
        urlSecurityInfo={securityInfo}
      />,
    );
    expect(screen.getByText('help.onekey.so')).toBeTruthy();
    rerender(
      <DAppSiteMark
        origin={sourceInfo.origin}
        sourceInfo={sourceInfo}
        urlSecurityInfo={securityInfo}
      />,
    );
    expect(screen.getByText('Unverified')).toBeTruthy();
    expect(screen.queryByTestId('site-image')).toBeNull();
    expect(screen.queryByTestId('BadgeVerifiedSolid')).toBeNull();
  });

  it('preserves browser-derived identity for injected requests', () => {
    render(
      <DAppSiteMark
        origin={sourceInfo.origin}
        sourceInfo={{
          ...sourceInfo,
          isWalletConnectRequest: false,
          displayOrigin: 'https://forged.example',
        }}
        urlSecurityInfo={securityInfo}
      />,
    );
    expect(screen.getByText('help.onekey.so')).toBeTruthy();
    expect(screen.getByTestId('BadgeVerifiedSolid')).toBeTruthy();
    expect(screen.queryByText('forged.example')).toBeNull();
  });
});
