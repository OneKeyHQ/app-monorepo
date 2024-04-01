export type IOneKeyAPIBaseResponse<T = any> = {
  code: number;
  message: string;
  data: T;
};
