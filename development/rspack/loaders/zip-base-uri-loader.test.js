const loader = require('./zip-base-uri-loader');
it('maps only zip.js resource initialization to the bundler runtime base URI', () => {
  expect(loader('configure({ baseURI: import.meta.url });')).toBe(
    'configure({ baseURI: import.meta.rspackBaseUri });',
  );
  expect(() => loader('configure({ baseURI: changed });')).toThrow(
    'review the runtime URL mapping',
  );
});
