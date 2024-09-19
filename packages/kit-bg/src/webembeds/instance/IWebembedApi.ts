import type WebEmbedApiChainAdaLegacy from '../WebEmbedApiChainAdaLegacy';
import type WebEmbedApiHomeScreen from '../WebEmbedApiHomeScreen';
import type WebEmbedApiSecret from '../WebEmbedApiSecret';
import type WebEmbedApiTest from '../WebEmbedApiTest';

export type IWebembedApi = {
  chainAdaLegacy: WebEmbedApiChainAdaLegacy;
  test: WebEmbedApiTest;
  homeScreen: WebEmbedApiHomeScreen;
  secret: WebEmbedApiSecret;
  isSDKReady(): Promise<boolean>;
};
export type IWebembedApiKeys = keyof IWebembedApi;
