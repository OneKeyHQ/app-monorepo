// IP Table 配置
export interface IIpTableConfig {
  enabled: boolean;
  hosts: {
    [rootDomain: string]: {
      primaryIps: string[];
      fallbackIps: string[];
      enabled: boolean;
    };
  };
  currentSelections: {
    [rootDomain: string]: string; // 当前选中的 IP
  };
}

// SNI 请求配置
export interface ISniRequestConfig {
  ip: string;
  hostname: string;
  path: string;
  headers: Record<string, string>;
  method: string;
  body: string | null;
  timeout: number;
  port?: number;
}

// SNI 响应
export interface ISniResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}
