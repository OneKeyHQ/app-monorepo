import type { IKeyOfIcons, IXStackProps } from '@onekeyhq/components';
import { Icon, SizableText, Spinner, XStack } from '@onekeyhq/components';

type IAction = {
  iconName?: IKeyOfIcons;
  label: string;
  primary?: boolean;
  isLoading?: boolean;
} & IXStackProps;

export function Action(props: IAction) {
  const { iconName, label, primary, isLoading, onPress, testID } = props;

  return (
    <XStack
      flexDirection="row"
      py="$3.5"
      px="$4"
      bg={primary ? '$bgPrimary' : '$bgStrong'}
      $gtMd={{
        py: '$2',
      }}
      hoverStyle={{
        bg: primary ? '$bgPrimaryHover' : '$bgStrongHover',
      }}
      pressStyle={{
        bg: primary ? '$bgPrimaryActive' : '$bgStrongActive',
      }}
      focusVisibleStyle={{
        outlineColor: '$focusRing',
        outlineStyle: 'solid',
        outlineWidth: 2,
      }}
      focusable
      userSelect="none"
      borderCurve="continuous"
      borderRadius="$3"
      onPress={onPress}
      testID={testID}
      alignItems="center"
      justifyContent="center"
      gap="$1.5"
    >
      {iconName ? (
        <Icon
          size="$5"
          name={iconName}
          color={primary ? '$iconInverse' : '$icon'}
        />
      ) : null}
      <SizableText
        size="$bodyLgMedium"
        color={primary ? '$textInverse' : '$text'}
      >
        {label}
      </SizableText>
      {isLoading ? (
        <XStack ml="$2">
          <Spinner />
        </XStack>
      ) : null}
    </XStack>
  );
}
