import type { IHomeTokenRequest } from '@onekeyhq/shared/types/token';

import { HomeTokenRequestRegistry } from './homeTokenRequestRegistry';

describe('Home token request ownership', () => {
  let runtimeId: string;
  let registry: HomeTokenRequestRegistry;
  const request = (
    generation: number,
    ownerKey = 'owner-a',
  ): IHomeTokenRequest => ({
    mainRuntimeId: runtimeId,
    generation,
    ownerKey,
  });

  beforeEach(() => {
    runtimeId = 'runtime-a';
    registry = new HomeTokenRequestRegistry(
      () => runtimeId,
      () => true,
    );
  });

  it('rejects a delayed older begin without replacing the newer owner', () => {
    const old = request(1);
    const current = request(3, 'owner-b');
    registry.invalidate(request(2));
    registry.claim(current);
    expect(() => registry.claim(old)).toThrow('superseded');
    expect(registry.isCurrent(current)).toBe(true);
  });

  it('makes equal-generation fan-out idempotent but never revives a tombstone', () => {
    const token = request(1);
    registry.claim(token);
    registry.claim({ ...token });
    expect(() => registry.claim({ ...token, ownerKey: 'other' })).toThrow(
      'superseded',
    );
    registry.cancel(token);
    expect(() => registry.claim(token)).toThrow('superseded');
  });

  it('ignores old invalidation and old component cleanup after a newer begin', () => {
    const old = request(1);
    const current = request(2);
    registry.claim(old);
    registry.claim(current);
    registry.invalidate(old);
    registry.cancel(old);
    expect(registry.isCurrent(current)).toBe(true);
  });

  it('uses the native advertised incarnation when generations reset on reload', () => {
    const old = request(100);
    registry.claim(old);
    runtimeId = 'runtime-b';
    const current = request(1);
    expect(registry.isCurrent(old)).toBe(false);
    registry.claim(current);
    expect(() => registry.claim(old)).toThrow('runtime expired');
    expect(() => registry.invalidate(old)).toThrow('runtime expired');
    expect(registry.isCurrent(current)).toBe(true);
  });

  it('rejects work while native teardown has cleared the advertised main', () => {
    const token = request(1);
    registry.claim(token);
    runtimeId = '';
    expect(() => registry.assertCurrent(token)).toThrow('superseded');
  });

  it('preserves non-Home and non-native behavior', () => {
    registry.invalidate(request(3));
    expect(registry.isCurrent(undefined)).toBe(true);
    const disabled = new HomeTokenRequestRegistry(
      () => undefined,
      () => false,
    );
    disabled.claim(request(1));
    disabled.invalidate(request(2));
    expect(disabled.isCurrent(request(1))).toBe(true);
  });
});
