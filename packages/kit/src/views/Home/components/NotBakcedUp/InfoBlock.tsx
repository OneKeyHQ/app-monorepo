import { StyleSheet } from 'react-native';

import {
  type IIconProps,
  type IYStackProps,
  Icon,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { listItemPressStyle } from '@onekeyhq/shared/src/style';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';

type IProps = {
  iconProps: IIconProps;
  title: string;
  url: string;
  containerProps?: IYStackProps;
};

function InfoBlock(props: IProps) {
  const { iconProps, title, url, containerProps } = props;
  return (
    <YStack
      bg="$bg"
      userSelect="none"
      p="$6"
      borderRadius="$3"
      borderCurve="continuous"
      gap="$6"
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
      // $platform-android={{ elevation: 0.5 }}
      $platform-ios={{
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 0.5 },
        shadowOpacity: 0.2,
        shadowRadius: 0.5,
      }}
      overflow="hidden"
      justifyContent="space-between"
      onPress={() => {
        openUrlExternal(url);
      }}
      {...listItemPressStyle}
      {...containerProps}
    >
      <XStack justifyContent="space-between">
        <Stack
          borderWidth={1}
          borderColor="$borderSubdued"
          borderRadius="$2"
          borderCurve="continuous"
          p={11}
        >
          <Icon size="$6" color="$iconSubdued" {...iconProps} />
        </Stack>
        <Icon name="ArrowTopRightOutline" size="$5" color="$iconDisabled" />
      </XStack>
      <SizableText size="$headingMd">{title}</SizableText>
    </YStack>
  );
}

export default InfoBlock;
