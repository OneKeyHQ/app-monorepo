import type { IZcashSdkApi } from '@onekeyhq/core/src/chains/zcash/sdkZcash/types/sdk';

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
  chainZcash: IZcashSdkApi;
  isSDKReady(): Promise<boolean>;
};
export type IWebembedApiKeys = keyof IWebembedApi;
