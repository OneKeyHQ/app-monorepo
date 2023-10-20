/* eslint-disable @typescript-eslint/no-unused-vars */

export const backgroundApiProxy = {
  connectBridge: (jsBridge: any) => {},
  bridgeReceiveHandler: (_: any): Promise<any> => Promise.resolve({}),
};

export const simpleDb = {
  discoverWebTabs: {
    getRawData: () =>
      Promise.resolve({
        tabs: [
          {
            'id': 'home',
            'url': 'about:blank',
            'title': 'OneKey',
            'isCurrent': false,
            'canGoBack': false,
            'loading': false,
          },
          {
            'id': 'BMgUCWustX5tI6fmqQsoT',
            'url': 'about:blank',
            'title': 'OneKey',
            'isCurrent': false,
            'canGoBack': false,
            'loading': false,
            'timestamp': 1697790363161,
          },
          {
            'id': 'CBPTaj9jYQ72FPmAkczYn',
            'url': 'about:blank',
            'title': 'OneKey',
            'isCurrent': true,
            'canGoBack': false,
            'loading': false,
            'timestamp': 1697790364880,
          },
          {
            'id': 'KA2RHowvl_WxG6pURtwBC',
            'url': 'about:blank',
            'title': 'OneKey',
            'isCurrent': false,
            'canGoBack': false,
            'loading': false,
            'timestamp': 1697790365626,
          },
          {
            'id': '_3BCqo5_PFJiKy2zoVB9c',
            'url': 'about:blank',
            'title': 'OneKey',
            'isCurrent': false,
            'canGoBack': false,
            'loading': false,
            'timestamp': 1697790436363,
          },
        ],
      }),
    setRawData: (_: any) => {},
  },
};
