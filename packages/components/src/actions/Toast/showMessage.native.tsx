import { toast } from '@backpackapp-io/react-native-toast';

import { View, XStack } from '../../primitives';

import type { IToastMessageOptions } from './type';

const shadowOffset = { width: 0, height: 3 } as const;
const platformAndroidStyle = { elevation: 7 } as const;

export function dismissToast(id: string) {
  toast.dismiss(id);
}

export function showMessage({
  renderContent,
  toastId: stableId,
  duration,
}: IToastMessageOptions) {
  const toastId = toast('', {
    ...(stableId ? { id: stableId } : {}),
    duration,
    disableShadow: true,
    customToast: ({ width }) => (
      <XStack
        alignItems="center"
        justifyContent="center"
        alignSelf="center"
        width={width}
      >
        {/* @ts-ignore */}
        <View
          bg="$bg"
          px="$4"
          py="$3"
          borderRadius="$2"
          shadowColor="#181821"
          shadowOffset={shadowOffset}
          shadowOpacity={0.15}
          shadowRadius={4.65}
          $platform-android={platformAndroidStyle}
        >
          {renderContent({ width })}
        </View>
      </XStack>
    ),
  });
  return {
    close: () => {
      toast.dismiss(toastId);
    },
  };
}
