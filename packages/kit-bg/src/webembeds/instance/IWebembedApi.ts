import type WebEmbedApiChainAdaLegacy from '../WebEmbedApiChainAdaLegacy';
import type WebEmbedApiChainKaspa from '../WebEmbedApiChainKaspa';
import type WebEmbedApiImageUtils from '../WebEmbedApiImageUtils';
import type WebEmbedApiSecret from '../WebEmbedApiSecret';
import type WebEmbedApiTest from '../WebEmbedApiTest';

export type IWebembedApi = {
  chainAdaLegacy: WebEmbedApiChainAdaLegacy;
  test: WebEmbedApiTest;
  imageUtils: WebEmbedApiImageUtils;
  secret: WebEmbedApiSecret;
  chainKaspa: WebEmbedApiChainKaspa;
  isSDKReady(): Promise<boolean>;
};
export type IWebembedApiKeys = keyof IWebembedApi;
