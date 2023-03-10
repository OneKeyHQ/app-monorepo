import type { FC } from 'react';
import { useMemo } from 'react';

import { useIntl } from 'react-intl';

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
  const intl = useIntl();
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
            {intl.formatMessage({ id: 'msg__invalid_word' })}
          </Typography.Body2Strong>
        </Center>
      ) : (
        <Box flex={1}>
          <ScrollView flex={1} horizontal disableScrollViewPanResponder>
            <HStack ml={2} space={2} alignItems="center">
              {accessoryData.map((value, index) => (
                <Button
                  key={`${value}-${index}`}
                  size="sm"
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
