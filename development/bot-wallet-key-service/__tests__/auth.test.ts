import { describe, expect, it, jest } from '@jest/globals';

import { extractBearerToken, sha256Hex, verifyAccessToken } from '../src/auth';

describe('auth.extractBearerToken', () => {
  it('parses a valid Bearer header', () => {
    expect(extractBearerToken('Bearer abc123_-XYZ')).toEqual({
      ok: true,
      tokenBase64Url: 'abc123_-XYZ',
    });
  });

  it('returns ok=false for missing/undefined', () => {
    expect(extractBearerToken(undefined)).toEqual({
      ok: false,
      reason: 'missing',
    });
    expect(extractBearerToken('')).toEqual({ ok: false, reason: 'missing' });
  });

  it('returns ok=false for wrong prefix', () => {
    expect(extractBearerToken('Basic abc')).toEqual({
      ok: false,
      reason: 'malformed',
    });
    expect(extractBearerToken('Token abc')).toEqual({
      ok: false,
      reason: 'malformed',
    });
  });

  it('returns ok=false for Bearer with empty token', () => {
    expect(extractBearerToken('Bearer ')).toEqual({
      ok: false,
      reason: 'malformed',
    });
  });

  it('returns ok=false for non-base64url payload (rejects "+", "/", "=")', () => {
    expect(extractBearerToken('Bearer abc+def')).toEqual({
      ok: false,
      reason: 'malformed',
    });
    expect(extractBearerToken('Bearer abc/def')).toEqual({
      ok: false,
      reason: 'malformed',
    });
    expect(extractBearerToken('Bearer abc==')).toEqual({
      ok: false,
      reason: 'malformed',
    });
    expect(extractBearerToken('Bearer abc def')).toEqual({
      ok: false,
      reason: 'malformed',
    });
  });
});

describe('auth.sha256Hex', () => {
  it('produces deterministic 64-char hex', () => {
    expect(sha256Hex('hello')).toBe(
      '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824',
    );
    expect(sha256Hex('hello')).toBe(sha256Hex('hello'));
    expect(sha256Hex('hello')).not.toBe(sha256Hex('hello!'));
  });
});

describe('auth.verifyAccessToken', () => {
  it('accepts the correct token', () => {
    const token = 'a'.repeat(43);
    const stored = sha256Hex(token);
    expect(verifyAccessToken(token, stored)).toBe(true);
  });

  it('rejects a wrong token', () => {
    const token = 'a'.repeat(43);
    const stored = sha256Hex(token);
    expect(verifyAccessToken('b'.repeat(43), stored)).toBe(false);
  });

  it('rejects when stored hash is malformed (defense in depth)', () => {
    expect(verifyAccessToken('a'.repeat(43), 'not-hex')).toBe(false);
    expect(verifyAccessToken('a'.repeat(43), '')).toBe(false);
    expect(verifyAccessToken('a'.repeat(43), 'ab12')).toBe(false);
  });

  it('uses crypto.timingSafeEqual via crypto-bridge', async () => {
    const { cryptoBridge } = await import('../src/crypto-bridge');
    const spy = jest.spyOn(cryptoBridge, 'timingSafeEqual');
    verifyAccessToken('a'.repeat(43), sha256Hex('a'.repeat(43)));
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
