import path from 'path';

import {
  getHardwareSdkResourceRelativePath,
  isHardwareSdkResourceRequest,
  resolveHardwareSdkResourcePath,
} from './hardwareSdkResourcePath';

describe('Desktop hardware SDK resource path', () => {
  const rootDir = path.resolve('/app/build/static/js-sdk');

  test('resolves every nested local SDK resource under one fixed root', () => {
    const requestUrl =
      'file:///bundle/static/js-sdk/data/messages/messages.json?cache=1';
    expect(isHardwareSdkResourceRequest(requestUrl)).toBe(true);
    expect(getHardwareSdkResourceRelativePath(requestUrl)).toBe(
      'data/messages/messages.json',
    );
    expect(
      resolveHardwareSdkResourcePath({
        requestUrl,
        rootDir,
      }),
    ).toBe(path.join(rootDir, 'data', 'messages', 'messages.json'));
  });

  test.each([
    'file:///bundle/static/js-sdk/../index.html',
    'file:///bundle/static/js-sdk/%2e%2e/index.html',
    'file:///bundle/static/js-sdk/js%2F..%2Fiframe.js',
    'file:///bundle/static/js-sdk/',
    'file:///bundle/static/js-sdk/%00iframe.html',
  ])('rejects an invalid SDK resource path: %s', (requestUrl) => {
    expect(
      resolveHardwareSdkResourcePath({
        requestUrl,
        rootDir,
      }),
    ).toBeUndefined();
  });

  test('does not claim unrelated file protocol requests', () => {
    const requestUrl = 'file:///bundle/static/images/icon.png';
    expect(isHardwareSdkResourceRequest(requestUrl)).toBe(false);
    expect(
      resolveHardwareSdkResourcePath({ requestUrl, rootDir }),
    ).toBeUndefined();
  });
});
