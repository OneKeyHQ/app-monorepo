type IDesktopNetworkConditions = {
  latency: number;
  downloadThroughput: number;
  uploadThroughput: number;
};

export type IDesktopNetworkConditionRule = IDesktopNetworkConditions & {
  urlPattern: string;
};

// CDP matches these with the URLPattern constructor syntax and silently drops
// entries it cannot parse. An IPv6 host must therefore escape the brackets and
// colons; the unescaped `[::1]` form reads as a named group and never matches.
export const DESKTOP_DEV_SERVER_LOCAL_BYPASS_PATTERNS = [
  '*://localhost:*/*',
  '*://127.0.0.1:*/*',
  String.raw`*://\[\:\:1\]:*/*`,
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
