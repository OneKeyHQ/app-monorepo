import type WebEmbedApiChainAdaLegacy from '../WebEmbedApiChainAdaLegacy';
import type WebEmbedApiChainXmrLegacy from '../WebEmbedApiChainXmrLegacy';
import type WebEmbedApiSecret from '../WebEmbedApiSecret';

export type IWebembedApi = {
  secret: WebEmbedApiSecret;
  chainAdaLegacy: WebEmbedApiChainAdaLegacy;
  chainXmrLegacy: WebEmbedApiChainXmrLegacy;
};
export type IWebembedApiKeys = keyof IWebembedApi;
