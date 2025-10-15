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
      flex={1}
      height={134}
      p="$6"
      borderWidth={StyleSheet.hairlineWidth}
      borderColor="$borderSubdued"
      borderRadius="$4"
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
          p="$2"
          borderWidth={StyleSheet.hairlineWidth}
          borderColor="$borderSubdued"
          borderRadius="$2"
        >
          <Icon size="$6" color="$iconSubdued" {...iconProps} />
        </Stack>
        <Icon name="ArrowTopRightOutline" size="$5" color="$iconDisabled" />
      </XStack>
      <SizableText size="$headingXs" width="100%">
        {title}
      </SizableText>
    </YStack>
  );
}

export default InfoBlock;
