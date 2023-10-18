export abstract class BaseDotClient {
  abstract getTransaction(networkId: string, hash: string): Promise<any>;

  abstract getTransactions(networkId: string, address: string): Promise<any[]>;
}
