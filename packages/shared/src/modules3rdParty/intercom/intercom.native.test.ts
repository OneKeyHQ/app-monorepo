jest.mock('./messenger', () => ({
  createIntercomMessengerSession: jest.fn(),
  showIntercom: jest.fn(),
}));

it('uses exactly the same TypeScript client for native, web and extension', async () => {
  const [native, web, extension] = await Promise.all([
    import('./index.native'),
    import('./index'),
    import('./index.ext'),
  ]);
  expect(native.createIntercomMessengerSession).toBe(
    web.createIntercomMessengerSession,
  );
  expect(extension.showIntercom).toBe(web.showIntercom);
});
