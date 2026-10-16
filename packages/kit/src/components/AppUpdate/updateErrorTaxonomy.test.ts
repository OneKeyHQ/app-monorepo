/**
 * @jest-environment node
 */
// cspell:ignore OCDS
// Tests for the OCDS v1.1 §4 failure-classification matrix in
// updateErrorTaxonomy.ts. This is the single source of truth every native
// classifier (iOS / Android / Node) must agree with, so the matrix is pinned
// here exhaustively: any change that flips a code's permanent/transient class
// must show up as a failing assertion.
//
// yarn jest packages/kit/src/components/AppUpdate/updateErrorTaxonomy.test.ts

import {
  UNRECOVERABLE_DOWNLOAD_ERROR_CODES,
  classifyHttpStatus,
  extractHttpStatusFromError,
  isPermanentThisUrlDownloadError,
  isPermanentThisUrlHttpStatus,
  isUnrecoverableDownloadError,
} from './updateErrorTaxonomy';

describe('classifyHttpStatus — OCDS v1.1 §4 matrix', () => {
  // Explicitly enumerated permanent rows (§4 table + permanent 5xx overrides).
  test.each([401, 403, 404, 410, 501, 505])(
    'status %i → permanent (explicit row)',
    (status) => {
      expect(classifyHttpStatus(status)).toBe('permanent');
    },
  );

  // Explicitly enumerated transient rows.
  test.each([408, 416, 429])(
    'status %i → transient (explicit row)',
    (status) => {
      expect(classifyHttpStatus(status)).toBe('transient');
    },
  );

  // Default rule: 4xx → permanent EXCEPT 408 / 429.
  test.each([400, 402, 405, 411, 418, 451, 499])(
    'unlisted 4xx %i → permanent (default rule)',
    (status) => {
      expect(classifyHttpStatus(status)).toBe('permanent');
    },
  );

  // Default rule: 5xx → transient EXCEPT 501 / 505.
  test.each([500, 502, 503, 504, 599])(
    'unlisted 5xx %i → transient (default rule)',
    (status) => {
      expect(classifyHttpStatus(status)).toBe('transient');
    },
  );

  // Anything else / unknown → permanent.
  test.each([0, 100, 200, 301, 399, 600, 999])(
    'non-4xx/5xx %i → permanent (catch-all)',
    (status) => {
      expect(classifyHttpStatus(status)).toBe('permanent');
    },
  );

  test('non-finite status → permanent', () => {
    expect(classifyHttpStatus(Number.NaN)).toBe('permanent');
    expect(classifyHttpStatus(Number.POSITIVE_INFINITY)).toBe('permanent');
  });

  test('exactly-one-class holds for every status 100..599', () => {
    for (let s = 100; s <= 599; s += 1) {
      const cls = classifyHttpStatus(s);
      expect(cls === 'permanent' || cls === 'transient').toBe(true);
    }
  });
});

describe('isPermanentThisUrlHttpStatus', () => {
  test('only 401 / 403 are permanent-this-url', () => {
    expect(isPermanentThisUrlHttpStatus(401)).toBe(true);
    expect(isPermanentThisUrlHttpStatus(403)).toBe(true);
    expect(isPermanentThisUrlHttpStatus(404)).toBe(false);
    expect(isPermanentThisUrlHttpStatus(410)).toBe(false);
    expect(isPermanentThisUrlHttpStatus(500)).toBe(false);
  });
});

describe('UNRECOVERABLE_DOWNLOAD_ERROR_CODES', () => {
  test('covers §4 permanent HTTP statuses + SHA mismatch', () => {
    for (const code of [
      'SHA256_MISMATCH',
      'HTTP_401',
      'HTTP_403',
      'HTTP_404',
      'HTTP_410',
      'HTTP_501',
      'HTTP_505',
    ]) {
      expect(UNRECOVERABLE_DOWNLOAD_ERROR_CODES.has(code)).toBe(true);
    }
  });

  test('does NOT include transient statuses', () => {
    for (const code of ['HTTP_408', 'HTTP_429', 'HTTP_500', 'HTTP_503']) {
      expect(UNRECOVERABLE_DOWNLOAD_ERROR_CODES.has(code)).toBe(false);
    }
  });
});

describe('extractHttpStatusFromError', () => {
  test.each([
    ['HTTP 416', 416],
    ['HTTP error 504', 504],
    ['Download failed with status: 503', 503],
  ])('parses %s → %i', (msg, expected) => {
    expect(extractHttpStatusFromError(new Error(msg))).toBe(expected);
  });

  test('returns undefined for non-HTTP errors', () => {
    expect(
      extractHttpStatusFromError(new Error('NSURLErrorDomain -1005')),
    ).toBe(undefined);
    expect(extractHttpStatusFromError(new Error('boom'))).toBe(undefined);
  });
});

describe('isUnrecoverableDownloadError — §4 + default rule', () => {
  test.each([
    'HTTP 401',
    'HTTP 403',
    'HTTP 404',
    'HTTP 410',
    'HTTP 501',
    'HTTP 505',
    'Bundle SHA256 verification failed: MISMATCH',
  ])('permanent: %s → unrecoverable', (msg) => {
    expect(isUnrecoverableDownloadError(new Error(msg))).toBe(true);
  });

  test.each([
    'HTTP 408',
    'HTTP 429',
    'HTTP 500',
    'HTTP error 503',
    'NSURLErrorDomain -1009',
  ])('transient: %s → recoverable', (msg) => {
    expect(isUnrecoverableDownloadError(new Error(msg))).toBe(false);
  });

  test('unlisted permanent 4xx via default rule → unrecoverable', () => {
    // 451 is not in the unrecoverable code set, but the §4 default rule
    // classifies it permanent, so it must still bail.
    expect(isUnrecoverableDownloadError(new Error('HTTP 451'))).toBe(true);
  });

  test('config / programmer errors → unrecoverable', () => {
    for (const msg of [
      'Bundle download URL must use HTTPS',
      'Invalid version string format',
      'Already downloading',
      'Invalid URL',
    ]) {
      expect(isUnrecoverableDownloadError(new Error(msg))).toBe(true);
    }
  });
});

describe('isPermanentThisUrlDownloadError', () => {
  test('401 / 403 errors → true', () => {
    expect(isPermanentThisUrlDownloadError(new Error('HTTP 401'))).toBe(true);
    expect(isPermanentThisUrlDownloadError(new Error('HTTP error 403'))).toBe(
      true,
    );
  });

  test('other permanent / transient statuses → false', () => {
    expect(isPermanentThisUrlDownloadError(new Error('HTTP 404'))).toBe(false);
    expect(isPermanentThisUrlDownloadError(new Error('HTTP 500'))).toBe(false);
    expect(isPermanentThisUrlDownloadError(new Error('boom'))).toBe(false);
  });
});
