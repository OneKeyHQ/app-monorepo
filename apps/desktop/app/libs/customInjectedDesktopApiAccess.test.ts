import fs from 'fs';
import path from 'path';

import {
  assertCustomInjectedDesktopApiAccess,
  isAllowedCustomInjectedWebviewApiMethod,
  resolveCustomInjectedDesktopApiAccessFlag,
} from './customInjectedDesktopApiAccess';
import { isTrustedDesktopApiRendererUrl } from './trustedDesktopApiRenderer';

describe('Custom Injection Desktop API access', () => {
  test('falls back only when the primary cross-process setting is unavailable', () => {
    expect(resolveCustomInjectedDesktopApiAccessFlag(undefined, true)).toBe(
      true,
    );
    expect(resolveCustomInjectedDesktopApiAccessFlag(undefined, false)).toBe(
      false,
    );
    expect(resolveCustomInjectedDesktopApiAccessFlag(false, true)).toBe(false);
  });

  test('requires both developer mode and the Custom Injection switch', () => {
    expect(() =>
      assertCustomInjectedDesktopApiAccess({
        module: 'webview',
        method: 'getActiveCustomInjectedWorkspace',
        state: {
          developerModeEnabled: false,
          customInjectionEnabled: true,
        },
      }),
    ).toThrow('enabled developer settings');
    expect(() =>
      assertCustomInjectedDesktopApiAccess({
        module: 'webview',
        method: 'getActiveCustomInjectedWorkspace',
        state: {
          developerModeEnabled: true,
          customInjectionEnabled: false,
        },
      }),
    ).toThrow('Custom Injection switch');
    expect(() =>
      assertCustomInjectedDesktopApiAccess({
        module: 'webview',
        method: 'getActiveCustomInjectedWorkspace',
        state: {
          developerModeEnabled: true,
          customInjectionEnabled: true,
        },
      }),
    ).not.toThrow();
  });

  test('fails closed for unlisted Custom Injection methods', () => {
    expect(
      isAllowedCustomInjectedWebviewApiMethod(
        'updateCustomInjectedProtocolRegistry',
      ),
    ).toBe(false);
    expect(() =>
      assertCustomInjectedDesktopApiAccess({
        module: 'webview',
        method: 'updateCustomInjectedProtocolRegistry',
        state: {
          developerModeEnabled: true,
          customInjectionEnabled: true,
        },
      }),
    ).toThrow('disallowed Custom Injection method');
  });

  test('keeps every public Custom Injection webview method on the explicit allowlist', () => {
    const source = fs.readFileSync(
      path.resolve(
        __dirname,
        '../../../../packages/kit-bg/src/desktopApis/DesktopApiWebview.ts',
      ),
      'utf8',
    );
    const declarations = Array.from(
      source.matchAll(
        /^ {2}(?:(private) )?(?:async )?([A-Za-z0-9_]*CustomInjected[A-Za-z0-9_]*)\(/gmu,
      ),
    );
    const publicMethods = declarations
      .filter((match) => !match[1])
      .map((match) => match[2]);
    const privateMethods = declarations
      .filter((match) => match[1])
      .map((match) => match[2]);

    expect(publicMethods.length).toBeGreaterThan(0);
    for (const method of publicMethods) {
      expect(isAllowedCustomInjectedWebviewApiMethod(method)).toBe(true);
    }
    for (const method of privateMethods) {
      expect(isAllowedCustomInjectedWebviewApiMethod(method)).toBe(false);
    }
  });

  test('does not affect unrelated Desktop APIs', () => {
    expect(() =>
      assertCustomInjectedDesktopApiAccess({
        module: 'webview',
        method: 'getInjectedJsContent',
        state: {
          developerModeEnabled: false,
          customInjectionEnabled: false,
        },
      }),
    ).not.toThrow();
  });

  test('accepts only the trusted main renderer location', () => {
    expect(
      isTrustedDesktopApiRendererUrl({
        candidateUrl: 'http://localhost:3001/settings?tab=dev#custom',
        trustedEntryUrl: 'http://localhost:3001/',
      }),
    ).toBe(true);
    expect(
      isTrustedDesktopApiRendererUrl({
        candidateUrl: 'http://localhost:3002/',
        trustedEntryUrl: 'http://localhost:3001/',
      }),
    ).toBe(false);
    expect(
      isTrustedDesktopApiRendererUrl({
        candidateUrl: 'https://evil.example/',
        trustedEntryUrl: 'http://localhost:3001/',
      }),
    ).toBe(false);
    expect(
      isTrustedDesktopApiRendererUrl({
        candidateUrl: 'file:///Applications/OneKey/index.html#/settings',
        trustedEntryUrl: 'file:///Applications/OneKey/index.html',
      }),
    ).toBe(true);
    expect(
      isTrustedDesktopApiRendererUrl({
        candidateUrl: 'file:///tmp/hostile.html',
        trustedEntryUrl: 'file:///Applications/OneKey/index.html',
      }),
    ).toBe(false);
  });
});
