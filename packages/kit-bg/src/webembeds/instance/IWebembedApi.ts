import type WebEmbedApiChainAdaLegacy from '../WebEmbedApiChainAdaLegacy';
import type WebEmbedApiTest from '../WebEmbedApiTest';

export type IWebembedApi = {
  chainAdaLegacy: WebEmbedApiChainAdaLegacy;
  test: WebEmbedApiTest;
};
export type IWebembedApiKeys = keyof IWebembedApi;
