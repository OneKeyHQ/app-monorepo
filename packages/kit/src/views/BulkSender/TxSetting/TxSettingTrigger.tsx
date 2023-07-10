import type { ComponentProps } from 'react';

import { isFunction, isString } from 'lodash';

import { HStack, Icon, Pressable, Text, VStack } from '@onekeyhq/components';

type Props = {
  header: string;
  title: string;
  desc?: string | React.ReactNode;
  icon?: JSX.Element;
  onPress?: () => void;
  descStyle?: ComponentProps<typeof Text>;
};

function TxSettingTrigger(props: Props) {
  const { header, title, desc, icon, onPress, descStyle } = props;
  return (
    <VStack space={4} flex={1}>
      <Text textTransform="uppercase" typography="Subheading">
        {header}
      </Text>
      <Pressable onPress={onPress} flex={1}>
        <HStack alignItems="center" flex={1}>
          <HStack alignItems="center" space={3} flex={1}>
            {icon}
            <VStack space={1}>
              <Text typography="Body1Strong">{title}</Text>
              {isString(desc) ? (
                <Text typography="Body2" color="text-subdued" {...descStyle}>
                  {desc}
                </Text>
              ) : (
                desc
              )}
            </VStack>
          </HStack>
          {isFunction(onPress) && <Icon name="ChevronRightMini" size={23} />}
        </HStack>
      </Pressable>
    </VStack>
  );
}

export { TxSettingTrigger };
