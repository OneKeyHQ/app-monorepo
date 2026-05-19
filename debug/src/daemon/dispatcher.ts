import {
  JsonRpcException,
  type JsonRpcId,
  type JsonRpcRequest,
  type JsonRpcResponse,
} from "../shared/jsonRpc.js";

export type Handler = (
  params: Record<string, unknown>,
) => unknown | Promise<unknown>;

export class Dispatcher {
  private readonly handlers = new Map<string, Handler>();

  register(method: string, handler: Handler): void {
    this.handlers.set(method, handler);
  }

  async handle(req: JsonRpcRequest): Promise<JsonRpcResponse> {
    const id = req?.id ?? null;
    if (!req || req.jsonrpc !== "2.0" || typeof req.method !== "string") {
      return this.errorResp(id, -32600, "Invalid Request");
    }

    const handler = this.handlers.get(req.method);
    if (!handler) {
      return this.errorResp(id, -32601, `Method not found: ${req.method}`);
    }

    const params = (req.params ?? {}) as Record<string, unknown>;
    try {
      const result = await handler(params);
      return { jsonrpc: "2.0", id, result };
    } catch (e) {
      if (e instanceof JsonRpcException) {
        return this.errorResp(id, e.code, e.message, e.data);
      }
      const msg = e instanceof Error ? e.message : String(e);
      return this.errorResp(id, -32603, `Internal error: ${msg}`);
    }
  }

  private errorResp(
    id: JsonRpcId,
    code: number,
    message: string,
    data?: unknown,
  ): JsonRpcResponse {
    return {
      jsonrpc: "2.0",
      id,
      error: { code, message, ...(data !== undefined ? { data } : {}) },
    };
  }
}
