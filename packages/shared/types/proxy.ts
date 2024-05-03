export interface IProxyRequestParam {
  method: string;
  params: any;
}

export interface IProxyRequestItem {
  method: string;
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
