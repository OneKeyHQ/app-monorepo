/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
import {
  getRuntimeKind,
  isBackgroundRuntime,
  isMainRuntime,
} from '../runtimeInfo';

type RuntimeGlobal = typeof globalThis & {
  __ONEKEY_RUNTIME_KIND__?: 'main' | 'background';
};

afterEach(() => {
  delete (globalThis as RuntimeGlobal).__ONEKEY_RUNTIME_KIND__;
});

describe('runtimeInfo', () => {
  it('returns "main" when __ONEKEY_RUNTIME_KIND__ is undefined', () => {
    expect(getRuntimeKind()).toBe('main');
  });

  it('returns "main" when explicitly set', () => {
    (globalThis as RuntimeGlobal).__ONEKEY_RUNTIME_KIND__ = 'main';
    expect(getRuntimeKind()).toBe('main');
  });

  it('returns "background" when set', () => {
    (globalThis as RuntimeGlobal).__ONEKEY_RUNTIME_KIND__ = 'background';
    expect(getRuntimeKind()).toBe('background');
  });

  it('isMainRuntime returns true for main', () => {
    expect(isMainRuntime()).toBe(true);
  });

  it('isBackgroundRuntime returns true for background', () => {
    (globalThis as RuntimeGlobal).__ONEKEY_RUNTIME_KIND__ = 'background';
    expect(isBackgroundRuntime()).toBe(true);
  });

  it('isMainRuntime returns false for background', () => {
    (globalThis as RuntimeGlobal).__ONEKEY_RUNTIME_KIND__ = 'background';
    expect(isMainRuntime()).toBe(false);
  });
});
