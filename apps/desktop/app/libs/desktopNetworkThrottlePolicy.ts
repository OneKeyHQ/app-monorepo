type IDesktopNetworkConditions = {
  latency: number;
  downloadThroughput: number;
  uploadThroughput: number;
};

export type IDesktopNetworkConditionRule = IDesktopNetworkConditions & {
  urlPattern: string;
};

export const DESKTOP_DEV_SERVER_LOCAL_BYPASS_PATTERNS = [
  '*://localhost:*/*',
  '*://127.0.0.1:*/*',
  '*://[::1]:*/*',
] as const;

const BYPASSED_NETWORK_CONDITIONS: IDesktopNetworkConditions = {
  latency: 0,
  downloadThroughput: -1,
  uploadThroughput: -1,
};

export function buildDesktopRemoteOnlyNetworkConditionRules(
  conditions: IDesktopNetworkConditions,
): IDesktopNetworkConditionRule[] {
  return [
    ...DESKTOP_DEV_SERVER_LOCAL_BYPASS_PATTERNS.map((urlPattern) => ({
      urlPattern,
      ...BYPASSED_NETWORK_CONDITIONS,
    })),
    {
      urlPattern: '',
      ...conditions,
    },
  ];
}
