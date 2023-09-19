import npmAxios from 'axios';
import npmCrossFetch from 'cross-fetch';
import { isFunction } from 'lodash';
import npmSuperagent from 'superagent';

import type { AxiosInstance } from 'axios';

type ITestResponseData = {
  requestMeta: {
    headers: Record<string, string>;
  };
};

const TEST_URL = 'https://node.onekeytest.com/health';
// const TEST_URL = 'https://fiat.onekeycn.com/setting/list';

async function testUrlResponse({
  name,
  doRequest,
}: {
  name: string;
  doRequest: (options: { url: string }) => Promise<ITestResponseData>;
}) {
  const url = TEST_URL;
  const data = await doRequest({ url: `${url}?name=${name}` });
  const headers = {
    'x-request-by': data?.requestMeta.headers['x-request-by'],
  };
  const isOk = !!headers['x-request-by'];
  return {
    name,
    isOk,
    res: {
      headers,
    },
  };
}

function createAxiosTests({
  type,
  instance,
}: {
  type: string;
  instance: AxiosInstance;
}) {
  return [
    testUrlResponse({
      name: `${type}__axios.get`,
      doRequest: async ({ url }) => {
        const res = await instance.get<ITestResponseData>(url);
        return res.data;
      },
    }),
    testUrlResponse({
      name: `${type}__axios.post`,
      doRequest: async ({ url }) => {
        const res = await instance.post<ITestResponseData>(url);
        return res.data;
      },
    }),
    testUrlResponse({
      name: `${type}__axios.request`,
      doRequest: async ({ url }) => {
        const res = await instance.request<ITestResponseData>(url as any);
        return res.data;
      },
    }),
    testUrlResponse({
      name: `${type}__axios.request2`,
      doRequest: async ({ url }) => {
        const res = await instance.request<ITestResponseData>({ url });
        return res.data;
      },
    }),
    testUrlResponse({
      name: `${type}__axios.request(post)`,
      doRequest: async ({ url }) => {
        const res = await instance.request<ITestResponseData>({
          url,
          method: 'post',
        });
        return res.data;
      },
    }),
  ];
}

function createFetchTests({
  type,
  instance,
}: {
  type: string;
  instance: typeof fetch;
}) {
  return [
    testUrlResponse({
      name: `${type}__fetch-(get)`,
      doRequest: async ({ url }) => {
        const res = await instance(url);
        const data = await res.json();
        return data as ITestResponseData;
      },
    }),
    testUrlResponse({
      name: `${type}__fetch-(post)`,
      doRequest: async ({ url }) => {
        const res = await instance(url, { method: 'post' });
        const data = await res.json();
        return data as ITestResponseData;
      },
    }),
    testUrlResponse({
      name: `${type}__fetch2-(get)`,
      doRequest: async ({ url }) => {
        const res = await instance(new Request(url));
        const data = await res.json();
        return data as ITestResponseData;
      },
    }),
    testUrlResponse({
      name: `${type}__fetch2-(post)`,
      doRequest: async ({ url }) => {
        const res = await instance(new Request(url, { method: 'post' }));
        const data = await res.json();
        return data as ITestResponseData;
      },
    }),
  ];
}

function createSuperAgentTests({
  type,
  instance,
}: {
  type: string;
  instance: typeof npmSuperagent;
}) {
  return [
    testUrlResponse({
      name: `${type}__superagent.get`,
      doRequest: async ({ url }) => {
        const res = await instance.get(url);
        return res.body as ITestResponseData;
      },
    }),
    testUrlResponse({
      name: `${type}__superagent.post`,
      doRequest: async ({ url }) => {
        const res = await instance.post(url);
        return res.body as ITestResponseData;
      },
    }),
    ...(isFunction(instance)
      ? [
          testUrlResponse({
            name: `${type}__superagent(GET,url)`,
            doRequest: async ({ url }) => {
              const res = await instance('GET', url);
              return res.body as ITestResponseData;
            },
          }),
          testUrlResponse({
            name: `${type}__superagent(POST,url)`,
            doRequest: async ({ url }) => {
              const res = await instance('POST', url);
              return res.body as ITestResponseData;
            },
          }),
        ]
      : []),
  ];
}

// try{$$axios.get('https://node.onekeytest.com/health')}catch(error){console.error('axios ERROR >>>>>>> :',error)}
export async function requestsInterceptTest2(): Promise<
  ITestResponseData | undefined
> {
  try {
    const res = await npmAxios.get<ITestResponseData>(TEST_URL);
    return res.data;
  } catch (error) {
    console.error('requestsInterceptTest2 ERROR', error);
    // const e = error as Error | undefined;
  } finally {
    // noop
  }
}

export async function requestsInterceptTest() {
  const results = await Promise.all([
    ...createAxiosTests({
      type: 'axios-singleton',
      instance: npmAxios,
    }),
    ...createAxiosTests({
      type: 'axios.create()',
      instance: npmAxios.create(),
    }),
    ...createFetchTests({
      type: 'global.fetch',
      instance: global.fetch,
    }),
    ...createFetchTests({
      type: 'cross-fetch',
      instance: npmCrossFetch,
    }),
    ...createSuperAgentTests({
      type: 'superagent-singleton',
      instance: npmSuperagent,
    }),
    ...createSuperAgentTests({
      type: 'superagent.agent()',
      instance: npmSuperagent.agent(),
    }),
  ]);
  const success = results.filter((item) => item.isOk);
  const failed = results.filter((item) => !item.isOk);
  return {
    success,
    failed,
  };
}
