/** @jest-environment jsdom */

import { renderHook } from '@testing-library/react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useHomeNativeListTheme } from './useHomeNativeListTheme';

// Every theme token resolves to its own name so the mapping is readable.
const mockColors = new Proxy({} as Record<string, { val: string }>, {
  get: (_, name) => ({ val: `token:${String(name)}` }),
});

jest.mock('@onekeyhq/components', () => ({ useTheme: () => mockColors }));

it('gives Web rows a hover fill distinct from the pressed fill', () => {
  const wasNative = platformEnv.isNative;
  try {
    platformEnv.isNative = false;
    const web = renderHook(() => useHomeNativeListTheme()).result.current;
    expect(web.rowHoverBackground).toBe('token:bgHover');
    expect(web.rowPressedBackground).toBe('token:bgActive');

    platformEnv.isNative = true;
    const native = renderHook(() => useHomeNativeListTheme()).result.current;
    expect(native.rowHoverBackground).toBeUndefined();
    expect(native.rowPressedBackground).toBe('token:bgActive');
  } finally {
    platformEnv.isNative = wasNative;
  }
});
