import 'axios';

declare module 'axios' {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  export interface AxiosRequestConfig {
    runnerId?: string;
  }
}
