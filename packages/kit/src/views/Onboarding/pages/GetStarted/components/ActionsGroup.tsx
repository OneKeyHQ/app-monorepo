import type { IKeyOfIcons, IXStackProps } from '@onekeyhq/components';
import {
  Divider,
  Group,
  Icon,
  SizableText,
  Spinner,
  XStack,
} from '@onekeyhq/components';

type IActionsGroupItem = {
  iconName: IKeyOfIcons;
  label: string;
  primary?: boolean;
  isLoading?: boolean;
} & IXStackProps;

type IActionsProp = {
  items: IActionsGroupItem[];
};

export function ActionsGroup({ items }: IActionsProp) {
  return (
    <Group
      borderRadius="$3"
      $gtMd={{
        borderRadius: '$2',
      }}
      separator={<Divider />}
    >
      {items.map((item: IActionsGroupItem, index) => (
        <Group.Item key={index}>
          <XStack
            flexDirection="row"
            py="$3.5"
            px="$4"
            bg={item.primary ? '$bgPrimary' : '$bgStrong'}
            $gtMd={{
              py: '$2',
            }}
            hoverStyle={{
              bg: item.primary ? '$bgPrimaryHover' : '$bgStrongHover',
            }}
            pressStyle={{
              bg: item.primary ? '$bgPrimaryActive' : '$bgStrongActive',
            }}
            focusVisibleStyle={{
              outlineColor: '$focusRing',
              outlineStyle: 'solid',
              outlineWidth: 2,
            }}
            focusable
            userSelect="none"
            borderCurve="continuous"
            onPress={item.onPress}
            testID={item.testID}
          >
            <Icon
              name={item.iconName}
              color={item.primary ? '$iconInverse' : '$icon'}
            />
            <SizableText
              pl="$3"
              size="$bodyLgMedium"
              color={item.primary ? '$textInverse' : '$text'}
            >
              {item.label}
            </SizableText>
            {item?.isLoading ? (
              <XStack ml="$2">
                <Spinner />
              </XStack>
            ) : null}
          </XStack>
        </Group.Item>
      ))}
    </Group>
  );
}
