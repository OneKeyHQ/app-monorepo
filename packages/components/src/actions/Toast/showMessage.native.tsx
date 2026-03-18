import { toast } from '@backpackapp-io/react-native-toast';

import { View, XStack } from '../../primitives';

import type { IToastMessageOptions } from './type';

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
          shadowOffset={{
            width: 0,
            height: 3,
          }}
          shadowOpacity={0.15}
          shadowRadius={4.65}
          $platform-android={{
            elevation: 7,
          }}
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
