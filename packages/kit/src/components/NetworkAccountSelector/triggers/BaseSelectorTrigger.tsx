import type { ComponentProps } from 'react';

import { StyleSheet } from 'react-native';

import {
  Center,
  HStack,
  Icon,
  Pressable,
  Typography,
  VStack,
} from '@onekeyhq/components';

import type { EAccountSelectorMode } from '../../../store/reducers/reducerAccountSelector';
import type { ColorType } from 'native-base/lib/typescript/components/types';

export interface ISelectorTriggerSharedProps {
  type?: 'basic' | 'plain'; // basic with outline border
  bg?: ColorType;
}
export interface INetworkAccountSelectorTriggerProps
  extends ISelectorTriggerSharedProps {
  mode?: EAccountSelectorMode;
}
interface IBaseSelectorTriggerProps extends ISelectorTriggerSharedProps {
  onPress?: () => void;
  icon: any;
  label: any;
  description?: any;
  subDescription?: any;
  disabledInteractiveBg?: boolean;
  hasArrow?: boolean;
}
function BaseSelectorTrigger({
  type = 'plain',
  bg,
  icon,
  label,
  description,
  subDescription,
  onPress,
  hasArrow,
  space,
  ...props
}: IBaseSelectorTriggerProps & ComponentProps<typeof HStack>) {
  return (
    <Pressable onPress={onPress}>
      {(status) => {
        let bgColor: string | undefined;
        bgColor =
          bg ?? type === 'basic' ? 'action-secondary-default' : undefined;
        if (status.isPressed) {
          bgColor =
            type === 'basic' ? 'action-secondary-pressed' : 'surface-hovered';
        }
        if (status.isHovered) {
          bgColor =
            type === 'basic' ? 'action-secondary-hovered' : 'surface-hovered';
        }
        if (status.isFocused) {
          bgColor = 'surface-selected';
        }
        return (
          <HStack
            alignItems="center"
            px={1}
            py={1}
            bg={bgColor}
            borderRadius="full"
            borderWidth={type === 'basic' ? StyleSheet.hairlineWidth : 0}
            borderColor="border-default"
            {...props}
          >
            <VStack py={0.5} px={1.5}>
              <HStack alignItems="center" space={space ?? 0.5}>
                {icon ? <Center minH={5}>{icon}</Center> : null}
                {label ? (
                  <HStack
                    space={0.5}
                    alignItems="center"
                    {...(type === 'plain' && { pr: 0.5 })}
                  >
                    <Typography.Body2Strong isTruncated maxW="120px">
                      {label}
                    </Typography.Body2Strong>
                    {description ? (
                      <Typography.Body2 color="text-subdued" ml="0.5">
                        {description}
                      </Typography.Body2>
                    ) : null}
                  </HStack>
                ) : null}
              </HStack>
              {subDescription ? (
                <Typography.Body2 color="text-subdued">
                  {subDescription}
                </Typography.Body2>
              ) : null}
            </VStack>
            {type === 'plain' || hasArrow ? (
              <Icon size={20} name="ChevronDownMini" color="icon-subdued" />
            ) : null}
          </HStack>
        );
      }}
    </Pressable>
  );
}

export { BaseSelectorTrigger };
