import { ColorType } from 'native-base/lib/typescript/components/types';
import { StyleSheet } from 'react-native';

import {
  Box,
  Center,
  HStack,
  Icon,
  Pressable,
  Typography,
  useIsVerticalLayout,
} from '@onekeyhq/components';

import { EAccountSelectorMode } from '../../../store/reducers/reducerAccountSelector';

export interface ISelectorTriggerSharedProps {
  type?: 'basic' | 'plain'; // basic with outline border
  size?: 'sm' | 'lg' | string;
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
  disabledInteractiveBg?: boolean;
}
function BaseSelectorTrigger({
  type = 'plain',
  size = 'sm',
  bg,
  icon,
  label,
  onPress,
  disabledInteractiveBg,
}: IBaseSelectorTriggerProps) {
  const isVertical = useIsVerticalLayout();

  return (
    <Pressable onPress={onPress}>
      {(status) => {
        let bgColor: string | undefined;
        bgColor =
          bg ?? type === 'basic' ? 'action-secondary-default' : undefined;
        if (!disabledInteractiveBg) {
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
        }
        return (
          <HStack
            alignItems="center"
            p={1.5}
            pr={2.5}
            space={1}
            bg={bgColor}
            borderRadius="full"
            borderWidth={type === 'basic' ? StyleSheet.hairlineWidth : 0}
            borderColor="border-default"
          >
            <HStack space={size === 'sm' ? 2 : 3} alignItems="center">
              {icon ? <Center minH={7}>{icon}</Center> : null}

              {label ? (
                <Typography.Body2Strong isTruncated maxW="120px">
                  {label}
                </Typography.Body2Strong>
              ) : null}
            </HStack>
            {type === 'plain' && !isVertical ? (
              <Icon size={20} name="ChevronDownSolid" />
            ) : null}
          </HStack>
        );
      }}
    </Pressable>
  );
}

export { BaseSelectorTrigger };
