export { ConfigManager } from './config-manager';
export { DEFAULT_CONFIG } from './defaults';
export { configSchema } from './config-schema';
export type { IAppConfig } from './config-schema';

export type IEndpointEnv = 'test' | 'prod';

const HOSTS: Record<IEndpointEnv, string> = {
  test: 'onekeytest.com',
  prod: 'onekeycn.com',
};

export function getHost(env: IEndpointEnv): string {
  return HOSTS[env];
}
