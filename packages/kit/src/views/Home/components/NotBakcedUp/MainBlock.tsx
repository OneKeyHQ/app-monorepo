import { StyleSheet } from 'react-native';

import type {
  IIconProps,
  IStackProps,
  IYStackProps,
} from '@onekeyhq/components';
import { Icon, SizableText, Stack, XStack, YStack } from '@onekeyhq/components';

type IProps = {
  title: string;
  actions: React.ReactNode;
  containerProps?: IYStackProps;
  iconContainerProps?: IStackProps;
  iconProps?: IIconProps;
};

function MainInfoBlock(props: IProps) {
  const { title, actions, containerProps, iconProps, iconContainerProps } =
    props;
  return (
    <YStack
      p="$6"
      justifyContent="space-between"
      borderWidth={StyleSheet.hairlineWidth}
      borderColor="$borderSubdued"
      borderRadius="$4"
      overflow="hidden"
      $platform-web={{
        boxShadow:
          '0 1px 1px 0 rgba(255, 255, 255, 0.25) inset, 0 0 0 1px rgba(0, 0, 0, 0.04), 0 0 2px 0 rgba(0, 0, 0, 0.08), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
      }}
      height={285}
      width="100%"
      $gtMd={{
        flex: 1,
      }}
      {...containerProps}
    >
      <YStack gap="$6">
        <XStack>
          <Stack
            borderWidth={StyleSheet.hairlineWidth}
            borderColor="$borderSubdued"
            borderRadius="$2"
            p="$2"
            $platform-web={{
              boxShadow:
                '0 1px 1px 0 rgba(0, 0, 0, 0.05), 0 0 0 1px rgba(0, 0, 0, 0.05), 0 4px 6px 0 rgba(0, 0, 0, 0.04), 0 24px 68px 0 rgba(0, 0, 0, 0.05), 0 2px 3px 0 rgba(0, 0, 0, 0.04)',
            }}
            {...iconContainerProps}
          >
            <Icon color="$iconOnColor" size="$6" {...iconProps} />
          </Stack>
        </XStack>
        <SizableText size="$heading2xl" maxWidth={240}>
          {title}
        </SizableText>
      </YStack>
      <Stack>{actions}</Stack>
    </YStack>
  );
}

export default MainInfoBlock;
