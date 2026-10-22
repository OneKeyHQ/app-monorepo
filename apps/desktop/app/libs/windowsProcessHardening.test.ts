/* eslint-disable import/first */
// cspell:ignore dacl

jest.mock('@onekeyfe/electron-windows-process-hardening', () => ({
  hardenCurrentProcess: jest.fn(),
}));

import { hardenCurrentProcess as nativeHardenCurrentProcess } from '@onekeyfe/electron-windows-process-hardening';

import {
  hardenCurrentProcess,
  processHardeningStageError,
} from './windowsProcessHardening';

const mockNativeHarden = nativeHardenCurrentProcess as jest.Mock;

describe('Windows process hardening adapter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('preserves independent native stage results', () => {
    const result = {
      dacl: {
        status: 'failed',
        message: 'SetSecurityInfo failed',
        win32Error: 5,
      },
      extensionPoint: { status: 'applied' },
    };
    mockNativeHarden.mockReturnValue(result);

    expect(hardenCurrentProcess()).toBe(result);
    expect(mockNativeHarden).toHaveBeenCalledTimes(1);
  });

  it('maps binding errors to failures for both stages', () => {
    mockNativeHarden.mockImplementation(() => {
      throw new TypeError('Native binding unavailable');
    });

    expect(hardenCurrentProcess()).toEqual({
      dacl: { status: 'failed', message: 'Native binding unavailable' },
      extensionPoint: {
        status: 'failed',
        message: 'Native binding unavailable',
      },
    });
  });

  it('retains a Win32 code in the reported stage error', () => {
    expect(
      processHardeningStageError('dacl', {
        status: 'failed',
        message: 'SetSecurityInfo failed',
        win32Error: 5,
      }).message,
    ).toBe('dacl: SetSecurityInfo failed (Win32 5)');
  });
});
