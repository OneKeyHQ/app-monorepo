import { StyleSheet } from 'react-native';

import type { IIconProps, IYStackProps } from '@onekeyhq/components';
import { Icon, SizableText, XStack, YStack } from '@onekeyhq/components';

type IProps = {
  title: string;
  actions: React.ReactNode;
  containerProps?: IYStackProps;
  iconContainerProps?: IYStackProps;
  iconProps?: IIconProps;
};

function MainInfoBlock(props: IProps) {
  const { title, actions, containerProps, iconProps, iconContainerProps } =
    props;
  return (
    <YStack
      p="$6"
      borderRadius="$4"
      $platform-web={{
        boxShadow:
          '0 1px 1px 0 rgba(255, 255, 255, 0.1) inset, 0 0 0 1px rgba(0, 0, 0, 0.04), 0 0 2px 0 rgba(0, 0, 0, 0.08), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
      }}
      $platform-native={{
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '$borderSubdued',
      }}
      $theme-dark={{
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '$borderSubdued',
      }}
      height={285}
      width="100%"
      $gtMd={{
        flex: 1,
      }}
      gap="$6"
      alignItems="flex-start"
      overflow="hidden"
      {...containerProps}
    >
      <YStack
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
      </YStack>
      <SizableText size="$heading2xl" maxWidth={240}>
        {title}
      </SizableText>
      <XStack mt="auto">{actions}</XStack>
    </YStack>
  );
}

export default MainInfoBlock;
