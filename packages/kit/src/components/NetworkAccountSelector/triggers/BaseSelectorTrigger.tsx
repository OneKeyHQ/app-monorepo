import { StyleSheet } from 'react-native';

import {
  Center,
  HStack,
  Icon,
  Pressable,
  Typography,
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
  disabledInteractiveBg?: boolean;
}
function BaseSelectorTrigger({
  type = 'plain',
  bg,
  icon,
  label,
  description,
  onPress,
}: IBaseSelectorTriggerProps) {
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
            p={1}
            bg={bgColor}
            borderRadius="full"
            borderWidth={type === 'basic' ? StyleSheet.hairlineWidth : 0}
            borderColor="border-default"
          >
            <HStack space={0.5} alignItems="center">
              {icon ? <Center minH={5}>{icon}</Center> : null}
              {label ? (
                <HStack
                  py={0.5}
                  px={1.5}
                  space={0.5}
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
                  {type === 'plain' ? (
                    <Icon
                      size={20}
                      name="ChevronDownMini"
                      color="icon-subdued"
                    />
                  ) : null}
                </HStack>
              ) : null}
            </HStack>
          </HStack>
        );
      }}
    </Pressable>
  );
}

export { BaseSelectorTrigger };
