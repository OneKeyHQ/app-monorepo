import type { FC } from 'react';
import { useMemo } from 'react';

import {
  Box,
  Button,
  Center,
  HStack,
  Icon,
  ScrollView,
  Typography,
} from '@onekeyhq/components';
import useIsKeyboardShown from '@onekeyhq/components/src/Layout/BottomTabs/utils/useIsKeyboardShown';

import type { IBoxProps } from 'native-base';

type AccessoryViewProps = {
  withKeybord?: boolean;
  accessoryData?: string[];
  selected?: (value: string) => void;
  boxProps?: IBoxProps;
};

export const AccessoryView: FC<AccessoryViewProps> = ({
  accessoryData,
  withKeybord,
  selected,
  boxProps,
}) => {
  const isKeyboardshow = useIsKeyboardShown();
  const showAccessory = useMemo(
    () =>
      ((isKeyboardshow && withKeybord) || !withKeybord) &&
      ((accessoryData && accessoryData.length) || !accessoryData),
    [accessoryData, isKeyboardshow, withKeybord],
  );
  const showInvalidTip = !accessoryData;
  return showAccessory ? (
    <Box
      position="absolute"
      bottom="0"
      left="0"
      h="58px"
      w="full"
      backgroundColor={
        showInvalidTip ? 'surface-warning-subdued' : 'background-default'
      }
      {...boxProps}
    >
      {showInvalidTip ? (
        <Center flex={1} flexDirection="row">
          <Icon name="ExclamationTriangleMini" color="icon-warning" />
          <Typography.Body2Strong>
            Contains invalid words
          </Typography.Body2Strong>
        </Center>
      ) : (
        <Box flex={1}>
          <ScrollView flex={1} horizontal disableScrollViewPanResponder>
            <HStack ml={2} space={2} alignItems="center">
              {accessoryData.map((value) => (
                <Button
                  type="basic"
                  h="34px"
                  size="sm"
                  borderColor="border-default"
                  bgColor="action-secondary-default"
                  borderRadius="12px"
                  onPress={() => {
                    if (selected) {
                      selected(value);
                    }
                  }}
                >
                  {value}
                </Button>
              ))}
            </HStack>
          </ScrollView>
        </Box>
      )}
    </Box>
  ) : null;
};
