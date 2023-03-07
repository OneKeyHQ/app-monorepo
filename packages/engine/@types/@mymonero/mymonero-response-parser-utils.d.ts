declare module '@mymonero/mymonero-response-parser-utils' {
  export default class ResponseParser {
    constructor(options: { coreBridge_instance: any });

    Parsed_AddressInfo: (
      data: any,
      address: string,
      view_key__private: string,
      spend_key__public: string,
      spend_key__private: string,
      fn: (e: Error, data: any) => void,
    ) => Promise<andy>;

    Parsed_AddressTransactions: () => any;
  }
}
