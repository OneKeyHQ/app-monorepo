import {
  // ExchangeClient,
  HttpTransport,
  InfoClient,
  // MultiSignClient,
  // SubscriptionClient,
  // WebSocketTransport,
} from '@nktkas/hyperliquid';

class HyperLiquidApiClients {
  private _infoClient: InfoClient | null = null;

  get infoClient(): InfoClient {
    if (!this._infoClient) {
      this._infoClient = new InfoClient({
        transport: new HttpTransport(),
      });
    }
    return this._infoClient;
  }

  // private _exchangeClient: ExchangeClient | null = null;

  // get exchangeClient(): ExchangeClient {
  //   if (!this._exchangeClient) {
  //     this._exchangeClient = new ExchangeClient({
  //       transport: new HttpTransport(),
  //     });
  //   }
  //   return this._exchangeClient;
  // }

  // private _subscriptionClient: SubscriptionClient | null = null;

  // get subscriptionClient(): SubscriptionClient {
  //   if (!this._subscriptionClient) {
  //     this._subscriptionClient = new SubscriptionClient({
  //       transport: new WebSocketTransport(),
  //     });
  //   }
  //   return this._subscriptionClient;
  // }

  // private _multiSignClient: MultiSignClient | null = null;

  // get multiSignClient(): MultiSignClient {
  //   if (!this._multiSignClient) {
  //     this._multiSignClient = new MultiSignClient({
  //       transport: new HttpTransport(),
  //     });
  //   }
  //   return this._multiSignClient;
  // }
}

const hyperLiquidApiClients = new HyperLiquidApiClients();
export { hyperLiquidApiClients };
