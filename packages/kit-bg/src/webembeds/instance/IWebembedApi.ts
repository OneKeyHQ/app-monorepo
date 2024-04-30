import type WebEmbedApiChainAdaLegacy from '../WebEmbedApiChainAdaLegacy';
import type WebEmbedApiChainXmrLegacy from '../WebEmbedApiChainXmrLegacy';
import type WebEmbedApiSecret from '../WebEmbedApiSecret';
import type WebEmbedApiTest from '../WebEmbedApiTest';

export type IWebembedApi = {
  secret: WebEmbedApiSecret;
  chainAdaLegacy: WebEmbedApiChainAdaLegacy;
  chainXmrLegacy: WebEmbedApiChainXmrLegacy;
  test: WebEmbedApiTest;
};
export type IWebembedApiKeys = keyof IWebembedApi;
