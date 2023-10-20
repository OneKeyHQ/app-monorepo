/* eslint-disable @typescript-eslint/no-unused-vars */

export const backgroundApiProxy = {
  connectBridge: (jsBridge: any) => {},
  bridgeReceiveHandler: (_: any): Promise<any> => Promise.resolve({}),
};

export const simpleDb = {
  discoverWebTabs: {
    getRawData: () =>
      Promise.resolve({
        tabs: [],
      }),
    setRawData: (_: any) => {},
  },
};
