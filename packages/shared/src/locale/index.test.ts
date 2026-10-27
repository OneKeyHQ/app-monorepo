import * as nativeLocale from '.';

import * as webLocale from './index.web-only';

describe('locale entry points', () => {
  it('export the same runtime names on web and native', () => {
    expect(Object.keys(webLocale).toSorted()).toEqual(
      Object.keys(nativeLocale).toSorted(),
    );
  });
});
