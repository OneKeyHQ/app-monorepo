declare module '@mymonero/mymonero-lws-client' {
  interface MoneroTransaction {
    spent_outputs: any[];
  }

  interface MoneroAddressInfo {
    total_received: string;
    total_sent: string;
    locked_funds: string;
    scanned_height: number;
    start_height: number;
    scanned_block_height: number;
    blockchain_height: number;
    transaction_height: number;
    spent_outputs: any[];
  }

  interface Props {
    httpClient?: any;
    url?: string;
    api_key?: string;
    appName?: string;
    appVersion?: string;
  }

  export default class LWSClient {
    constructor(props: Props);

    login: (
      viewKey: string,
      address: string,
    ) => Promise<{ isNewAddress: boolean }>;

    getAddressTxs: () => Promise<any>;

    getAddressInfo: (
      viewKey: string,
      address: string,
    ) => Promise<MoneroAddressInfo>;
  }
}
