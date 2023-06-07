import type { ComponentProps } from 'react';

import { StyleSheet } from 'react-native';

import {
  Center,
  HStack,
  Icon,
  Pressable,
  Text,
  Typography,
  VStack,
} from '@onekeyhq/components';
import type { TypographyStyle } from '@onekeyhq/components/src/Typography';

import type { EAccountSelectorMode } from '../../../store/reducers/reducerAccountSelector';
import type { ColorType } from 'native-base/lib/typescript/components/types';
import type { MessageDescriptor } from 'react-intl';

export interface ISelectorTriggerSharedProps {
  type?: 'basic' | 'plain'; // basic with outline border
  bg?: ColorType;
}
export interface INetworkAccountSelectorTriggerProps
  extends ISelectorTriggerSharedProps {
  mode?: EAccountSelectorMode;
  iconSize?: number;
  labelTypography?: TypographyStyle;
}
interface IBaseSelectorTriggerProps extends ISelectorTriggerSharedProps {
  onPress?: () => void;
  icon: any;
  label: string | boolean | undefined | { id: MessageDescriptor['id'] };
  labelTypography?: TypographyStyle;
  description?: string | boolean;
  subDescription?: string;
  disabledInteractiveBg?: boolean;
  hasArrow?: boolean;
}
function BaseSelectorTrigger({
  type = 'plain',
  bg,
  icon,
  label,
  labelTypography = 'Body2Strong',
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
            <VStack py={0.5} px={!label && !subDescription ? 0.5 : 1.5}>
              <HStack alignItems="center" space={space ?? 0.5}>
                {icon ? <Center minH={5}>{icon}</Center> : null}
                {label ? (
                  <HStack
                    space={0.5}
                    alignItems="center"
                    {...(type === 'plain' && { pr: 0.5 })}
                  >
                    <Text typography={labelTypography} isTruncated maxW="120px">
                      {label}
                    </Text>
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
