function enable() {
  // @ts-expect-error
  if (module.hot) {
    // @ts-expect-error
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
    module.hot?.accept();
  }
}

export default {
  enable,
};
