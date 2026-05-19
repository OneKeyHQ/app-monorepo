export type JsonRpcId = number | string | null;

export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: JsonRpcId;
  method: string;
  params?: Record<string, unknown> | unknown[];
}

export interface JsonRpcSuccess<T = unknown> {
  jsonrpc: "2.0";
  id: JsonRpcId;
  result: T;
}

export interface JsonRpcErrorResponse {
  jsonrpc: "2.0";
  id: JsonRpcId;
  error: { code: number; message: string; data?: unknown };
}

export type JsonRpcResponse<T = unknown> =
  | JsonRpcSuccess<T>
  | JsonRpcErrorResponse;

export class JsonRpcException extends Error {
  constructor(public code: number, message: string, public data?: unknown) {
    super(message);
    this.name = "JsonRpcException";
  }
}
