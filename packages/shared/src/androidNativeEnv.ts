export const ANDROID_CHANNEL: 'google' | 'huawei' | 'apk' | '' = '';

export type IResolvedAndroidChannel = 'googlePlay' | 'apk';

// Non-native stub. Callers must gate with platformEnv.isNativeAndroid.
export async function resolveAndroidChannel(): Promise<IResolvedAndroidChannel> {
  return 'apk';
}
