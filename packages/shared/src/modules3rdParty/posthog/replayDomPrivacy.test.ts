// cspell:ignore rrweb
import {
  REPLAY_URL_PARAM,
  createReplayBlockWindows,
  filterReplaySnapshotData,
  maskReplayNetworkRequest,
  sanitizeReplayUrl,
  scrubReplayAttributeValue,
  scrubReplayEvent,
  templateReplayTestId,
} from './replayDomPrivacy';

import type { CapturedNetworkRequest } from 'posthog-js';

const ADDRESS = '0x52908400098527886E0F7030069857D2E4169EE7';

describe('sanitizeReplayUrl', () => {
  it('drops a hot-bundle file path including the OS user directory', () => {
    expect(
      sanitizeReplayUrl(
        'file:///Users/alice/Library/Application%20Support/@onekeyhq/desktop/onekey-bundle/6.6.0/build/index.html?x=1#/swap',
      ),
    ).toBe('/');
    expect(
      sanitizeReplayUrl(
        'file:///C:/Users/alice/AppData/Roaming/@onekeyhq/desktop/onekey-bundle/6.6.0/build/index.html',
      ),
    ).toBe('/');
  });

  it('keeps routes after the html file and templates dynamic segments', () => {
    expect(
      sanitizeReplayUrl(`file:///index.html/market/token/evm--1/${ADDRESS}`),
    ).toBe(`/market/token/evm--1/${REPLAY_URL_PARAM}`);
    expect(sanitizeReplayUrl('file:///swap')).toBe('/swap');
  });

  it('never keeps a bare OS path', () => {
    expect(sanitizeReplayUrl('file:///Users/alice/secret.txt')).toBe('/');
    expect(sanitizeReplayUrl('file:///home/alice/wallet')).toBe('/');
    expect(sanitizeReplayUrl('file:///D:/data')).toBe('/');
  });

  it('strips origin, query and hash from http URLs', () => {
    expect(
      sanitizeReplayUrl(
        `https://wallet.example.com/perps/${ADDRESS}?account=${ADDRESS}#frag`,
      ),
    ).toBe(`/perps/${REPLAY_URL_PARAM}`);
    expect(sanitizeReplayUrl('http://localhost:3001/')).toBe('/');
  });

  it('templates ids, amounts, emails and encoded values', () => {
    expect(sanitizeReplayUrl('/tx/123456789')).toBe(`/tx/${REPLAY_URL_PARAM}`);
    expect(sanitizeReplayUrl('/u/alice%40example.com')).toBe(
      `/u/${REPLAY_URL_PARAM}`,
    );
    expect(sanitizeReplayUrl('/a/%E0%A4%A')).toBe(`/a/${REPLAY_URL_PARAM}`);
    expect(sanitizeReplayUrl('/token/thisIsAVeryLongSegmentName123')).toBe(
      `/token/${REPLAY_URL_PARAM}`,
    );
  });

  it('never returns an empty string', () => {
    expect(sanitizeReplayUrl('')).toBe('/');
    expect(sanitizeReplayUrl(undefined)).toBe('/');
    expect(sanitizeReplayUrl(null)).toBe('/');
    expect(sanitizeReplayUrl('http://[')).toBe('/');
  });

  it('is idempotent', () => {
    const once = sanitizeReplayUrl(`https://x.test/market/token/${ADDRESS}`);
    expect(sanitizeReplayUrl(once)).toBe(once);
  });
});

describe('maskReplayNetworkRequest', () => {
  it('rewrites the name and drops headers and bodies', () => {
    const request = {
      name: `https://rpc.example.com/v1/${ADDRESS}?key=secret`,
      entryType: 'resource',
      startTime: 1,
      duration: 2,
      requestHeaders: { authorization: 'Bearer secret' },
      requestBody: '{"mnemonic":"secret"}',
      responseHeaders: { 'set-cookie': 'secret' },
      responseBody: '{"balance":"1"}',
    } as CapturedNetworkRequest;
    const masked = maskReplayNetworkRequest(request);
    expect(masked.name).toBe(`/v1/${REPLAY_URL_PARAM}`);
    expect(masked.requestHeaders).toBeUndefined();
    expect(masked.requestBody).toBeUndefined();
    expect(masked.responseHeaders).toBeUndefined();
    expect(masked.responseBody).toBeUndefined();
    expect(masked.startTime).toBe(1);
  });

  it('handles the href-only shape posthog-js uses for page URLs', () => {
    const masked = maskReplayNetworkRequest({
      name: 'file:///Users/alice/build/index.html',
    } as CapturedNetworkRequest);
    expect(masked.name).toBe('/');
  });
});

describe('attribute scrubbing', () => {
  it('masks text-bearing attributes like rrweb masks text', () => {
    expect(scrubReplayAttributeValue('aria-label', 'PnL +12.5 USDC')).toBe(
      '*** ***** ****',
    );
    expect(scrubReplayAttributeValue('title', ADDRESS)).toBe(
      '*'.repeat(ADDRESS.length),
    );
    expect(scrubReplayAttributeValue('placeholder', 'Max 1.2 ETH')).toBe(
      '*** *** ***',
    );
  });

  it('sanitizes links but keeps in-document references', () => {
    expect(
      scrubReplayAttributeValue('href', `https://x.test/address/${ADDRESS}`),
    ).toBe(`/address/${REPLAY_URL_PARAM}`);
    expect(scrubReplayAttributeValue('href', '#icon-check')).toBe(
      '#icon-check',
    );
    expect(scrubReplayAttributeValue('href', '#/swap?from=x')).toBe('#');
  });

  it('templates test ids and leaves other attributes alone', () => {
    expect(templateReplayTestId(`address-item-${ADDRESS}`)).toBe(
      `address-item-${REPLAY_URL_PARAM}`,
    );
    expect(templateReplayTestId('password-input')).toBe('password-input');
    expect(scrubReplayAttributeValue('class', 'css-view-1')).toBe('css-view-1');
  });

  it('scrubs a full snapshot tree, mutations and meta events in place', () => {
    const fullSnapshot = {
      type: 2,
      timestamp: 1,
      data: {
        node: {
          type: 0,
          childNodes: [
            {
              type: 2,
              tagName: 'div',
              attributes: { 'aria-label': 'Balance 9', class: 'row' },
              childNodes: [
                {
                  type: 2,
                  tagName: 'a',
                  attributes: { href: `/address/${ADDRESS}` },
                  childNodes: [],
                },
              ],
            },
          ],
        },
      },
    };
    scrubReplayEvent(fullSnapshot);
    const div = fullSnapshot.data.node.childNodes[0];
    expect(div.attributes).toEqual({
      'aria-label': '******* *',
      class: 'row',
    });
    expect(div.childNodes[0].attributes.href).toBe(
      `/address/${REPLAY_URL_PARAM}`,
    );

    const mutation = {
      type: 3,
      timestamp: 2,
      data: {
        source: 0,
        adds: [
          {
            parentId: 1,
            node: {
              type: 2,
              tagName: 'span',
              attributes: { title: 'secret' },
              childNodes: [],
            },
          },
        ],
        attributes: [
          { id: 3, attributes: { 'aria-label': 'Amount 5', style: null } },
        ],
      },
    };
    scrubReplayEvent(mutation);
    expect(mutation.data.adds[0].node.attributes.title).toBe('******');
    expect(mutation.data.attributes[0].attributes).toEqual({
      'aria-label': '****** *',
      style: null,
    });

    const meta = {
      type: 4,
      timestamp: 3,
      data: { href: 'file:///Users/alice/build/index.html', width: 1 },
    };
    scrubReplayEvent(meta);
    expect(meta.data.href).toBe('/');
  });
});

describe('createReplayBlockWindows', () => {
  it('blocks from open until close, and everything after an open start', () => {
    const windows = createReplayBlockWindows();
    expect(windows.isBlocked(5)).toBe(false);
    windows.open(10);
    windows.open(12);
    expect(windows.isBlocked(9)).toBe(false);
    expect(windows.isBlocked(10)).toBe(true);
    expect(windows.isBlocked(1000)).toBe(true);
    windows.close(20);
    expect(windows.isBlocked(15)).toBe(true);
    expect(windows.isBlocked(20)).toBe(false);
    expect(windows.isBlocked(25)).toBe(false);
    windows.close(30);
    expect(windows.isBlocked(25)).toBe(false);
  });

  it('keeps a bounded number of closed windows', () => {
    const windows = createReplayBlockWindows({ maxClosedWindows: 2 });
    windows.open(1);
    windows.close(2);
    windows.open(3);
    windows.close(4);
    windows.open(5);
    windows.close(6);
    expect(windows.isBlocked(1)).toBe(false);
    expect(windows.isBlocked(3)).toBe(true);
    expect(windows.isBlocked(5)).toBe(true);
  });
});

describe('filterReplaySnapshotData', () => {
  it('drops blocked, compressed and untimed events and scrubs the rest', () => {
    const windows = createReplayBlockWindows();
    windows.open(100);
    windows.close(200);
    const kept = {
      type: 4,
      timestamp: 50,
      data: { href: 'file:///Users/alice/build/index.html' },
    };
    const result = filterReplaySnapshotData(
      [
        kept,
        { type: 3, timestamp: 150, data: { source: 0 } },
        { type: 2, timestamp: 250, cv: '2024-10', data: 'H4sI' },
        { type: 3, data: { source: 1 } },
        'not-an-event',
      ],
      windows,
    );
    expect(result).toEqual([{ type: 4, timestamp: 50, data: { href: '/' } }]);
  });
});
