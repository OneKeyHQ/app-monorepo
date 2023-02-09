export class RPCBody {
  public readonly method: string;

  public readonly params: any[];

  public readonly id: number;

  public readonly jsonrpc: string;

  constructor(method: string, params: any[], id = 1, jsonrpc = '2.0') {
    this.method = method;
    this.params = params;
    this.id = id;
    this.jsonrpc = jsonrpc;
  }
}
