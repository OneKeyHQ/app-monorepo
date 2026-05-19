export interface AdapterHealth {
  name: string;
  connected: boolean;
  detail?: string;
}

export abstract class Adapter {
  abstract readonly name: string;
  abstract attach(): Promise<void>;
  abstract detach(): Promise<void>;
  abstract health(): Promise<AdapterHealth>;
}
