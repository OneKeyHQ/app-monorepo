import { StyleSheet } from 'react-native';

import type {
  IIconProps,
  IImageProps,
  IYStackProps,
} from '@onekeyhq/components';
import {
  Icon,
  IconButton,
  Image,
  SizableText,
  YStack,
} from '@onekeyhq/components';

type IProps = {
  title: string;
  subtitle?: string;
  actions: React.ReactNode;
  containerProps?: IYStackProps;
  iconContainerProps?: IYStackProps;
  iconProps?: IIconProps;
  bgSource?: IImageProps['source'];
  closable?: boolean;
  onClose?: () => void;
};

function MainInfoBlock(props: IProps) {
  const {
    title,
    subtitle,
    actions,
    containerProps,
    iconProps,
    iconContainerProps,
    bgSource,
    closable,
    onClose,
  } = props;
  return (
    <YStack
      p="$4"
      userSelect="none"
      borderRadius="$3"
      borderCurve="continuous"
      $platform-web={{
        boxShadow:
          '0 1px 1px 0 rgba(255, 255, 255, 0.05) inset, 0 0 0 1px rgba(0, 0, 0, 0.04), 0 0 2px 0 rgba(0, 0, 0, 0.08), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
      }}
      $platform-native={{
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '$borderSubdued',
      }}
      $theme-dark={{
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '$borderSubdued',
      }}
      $platform-android={{ elevation: 0.5 }}
      $platform-ios={{
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 0.5 },
        shadowOpacity: 0.2,
        shadowRadius: 0.5,
      }}
      gap="$6"
      alignItems="flex-start"
      overflow="hidden"
      pointerEvents="box-none"
      {...containerProps}
    >
      {bgSource ? (
        <YStack
          position="absolute"
          top="50%"
          y="-50%"
          right={-220}
          $gtMd={{
            right: -176,
          }}
          pointerEvents="box-none"
        >
          <Image
            pointerEvents="box-none"
            source={bgSource}
            w={600}
            h={380}
            zIndex={0}
          />
        </YStack>
      ) : null}
      {closable ? (
        <IconButton
          variant="tertiary"
          position="absolute"
          top="$4"
          right="$4"
          icon="CrossedLargeOutline"
          onPress={onClose}
          size="small"
          iconProps={{
            color: '$iconSubdued',
          }}
        />
      ) : null}
      <YStack
        borderWidth={1}
        borderColor="$borderSubdued"
        borderRadius="$2"
        borderCurve="continuous"
        p={11}
        $platform-web={{
          boxShadow:
            '0 1px 1px 0 rgba(0, 0, 0, 0.05), 0 0 0 1px rgba(0, 0, 0, 0.05), 0 4px 6px 0 rgba(0, 0, 0, 0.04), 0 24px 68px 0 rgba(0, 0, 0, 0.05), 0 2px 3px 0 rgba(0, 0, 0, 0.04)',
        }}
        pointerEvents="box-none"
        {...iconContainerProps}
      >
        <Icon
          pointerEvents="box-none"
          color="$iconOnColor"
          size="$6"
          {...iconProps}
        />
      </YStack>
      <YStack gap="$1" maxWidth={288}>
        <SizableText
          size="$heading2xl"
          $gtMd={{
            size: '$heading3xl',
          }}
          maxWidth={288}
          zIndex={1}
          pointerEvents="box-none"
        >
          {title}
        </SizableText>
        {subtitle ? (
          <SizableText
            size="$bodyMd"
            color="$textSubdued"
            pointerEvents="box-none"
          >
            {subtitle}
          </SizableText>
        ) : null}
      </YStack>
      <YStack mt="auto" zIndex={1} alignSelf="stretch" pointerEvents="box-none">
        {actions}
      </YStack>
    </YStack>
  );
}

export default MainInfoBlock;
