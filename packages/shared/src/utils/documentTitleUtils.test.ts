/**
 * @jest-environment jsdom
 */
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { getDocumentTitle, setDocumentTitle } from './documentTitleUtils';

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isWeb: false },
}));

const SHELL_TITLE = 'OneKey';
const PERPS_TITLE = '12.345 | INJ | OneKey';

describe('documentTitleUtils', () => {
  beforeEach(() => {
    globalThis.document.title = SHELL_TITLE;
  });

  it('owns the tab title on web', () => {
    platformEnv.isWeb = true;
    setDocumentTitle(PERPS_TITLE);
    expect(globalThis.document.title).toBe(PERPS_TITLE);
    expect(getDocumentTitle()).toBe(PERPS_TITLE);
  });

  it('leaves the shell title alone on desktop, extension and native', () => {
    platformEnv.isWeb = false;
    setDocumentTitle(PERPS_TITLE);
    expect(globalThis.document.title).toBe(SHELL_TITLE);
    expect(getDocumentTitle()).toBe('');
  });
});
