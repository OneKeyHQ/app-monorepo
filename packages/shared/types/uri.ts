export interface IUrlValue {
  url: string;
  hostname: string;
  origin: string;
  pathname: string;
  urlSchema: string;
  urlPathList: string[];
  urlParamList: { [key: string]: string };
}
