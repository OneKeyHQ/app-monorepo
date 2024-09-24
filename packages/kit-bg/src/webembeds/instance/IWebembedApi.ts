import type WebEmbedApiChainAdaLegacy from '../WebEmbedApiChainAdaLegacy';
import type WebEmbedApiImageUtils from '../WebEmbedApiImageUtils';
import type WebEmbedApiSecret from '../WebEmbedApiSecret';
import type WebEmbedApiTest from '../WebEmbedApiTest';

export type IWebembedApi = {
  chainAdaLegacy: WebEmbedApiChainAdaLegacy;
  test: WebEmbedApiTest;
  imageUtils: WebEmbedApiImageUtils;
  secret: WebEmbedApiSecret;
  isSDKReady(): Promise<boolean>;
};
export type IWebembedApiKeys = keyof IWebembedApi;
