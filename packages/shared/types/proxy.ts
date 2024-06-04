export interface IProxyRequestParam {
  method: string;
  params: any;
  url?: string;
}

export interface IProxyRequestItem {
  route: string;
  params: IProxyRequestParam;
}

export interface IProxyRequest {
  networkId: string;
  body: IProxyRequestItem[];
}

export interface IProxyResponse<T> {
  code: number;
  message: string;
  data: {
    data: Array<{
      success: boolean;
      data: T;
      error?: string;
    }>;
  };
}

export interface IRpcProxyResponse<T> {
  code: number;
  message: string;
  data: {
    data: Array<{
      id: string;
      jsonrpc: string;
      result: T;
    }>;
  };
}
