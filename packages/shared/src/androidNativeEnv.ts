export const ANDROID_CHANNEL: 'google' | 'huawei' | 'apk' | '' = '';

export type IResolvedAndroidChannel = 'googlePlay' | 'apk';

// Non-native stub. Web / desktop / extension always report 'apk'; callers must
// guard with platformEnv.isNativeAndroid before trusting the result.
export async function resolveAndroidChannel(): Promise<IResolvedAndroidChannel> {
  return 'apk';
}

export function getAndroidChannelSync(): IResolvedAndroidChannel | undefined {
  return undefined;
}
