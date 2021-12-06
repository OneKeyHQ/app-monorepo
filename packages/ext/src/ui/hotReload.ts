function enable() {
  // @ts-ignore
  if (module.hot) {
    // @ts-ignore
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
    module.hot?.accept();
  }
}

export default {
  enable,
};
