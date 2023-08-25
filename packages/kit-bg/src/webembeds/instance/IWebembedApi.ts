import type WebEmbedApiSecret from '../WebEmbedApiSecret';

export type IWebembedApi = {
  secret: WebEmbedApiSecret;
};
export type IWebembedApiKeys = keyof IWebembedApi;
