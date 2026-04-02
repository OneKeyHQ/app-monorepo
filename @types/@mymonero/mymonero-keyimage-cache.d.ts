/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable camelcase */
declare module '@mymonero/mymonero-keyimage-cache' {
  export const Lazy_KeyImage: (
    mutable_keyImagesByCacheKey: any,
    tx_pub_key: string,
    out_index: string,
    public_address: string,
    view_key__private: string,
    spend_key__public: string,
    spend_key__private: string,
    coreBridge_instance: any,
  ) => string;
  export const Lazy_KeyImageCacheForWalletWith: (address: string) => any;
}
