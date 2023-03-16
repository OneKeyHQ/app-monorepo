import type { ComponentProps } from 'react';
import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Alert, Box, Button, ScrollView } from '@onekeyhq/components';
import useIsKeyboardShown from '@onekeyhq/components/src/Layout/BottomTabs/utils/useIsKeyboardShown';

interface AccessoryViewProps extends ComponentProps<typeof ScrollView> {
  withKeybord?: boolean;
  accessoryData?: string[];
  /* 
    disable scroll behavior and show all contents
  */
  expandWords?: boolean;
  selected?: (value: string) => void;
}

export const AccessoryView = ({
  accessoryData,
  withKeybord,
  expandWords,
  selected,
  ...rest
}: AccessoryViewProps) => {
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
    <ScrollView
      horizontal={!expandWords}
      disableScrollViewPanResponder
      showsHorizontalScrollIndicator={false}
      bgColor="background-default"
      contentContainerStyle={{
        flexGrow: 1,
      }}
      {...rest}
    >
      {showInvalidTip ? (
        <Alert
          alertType="warn"
          title={intl.formatMessage({ id: 'msg__invalid_word' })}
          dismiss={false}
          containerProps={{
            flex: 1,
          }}
        />
      ) : (
        <Box
          flexDirection="row"
          m="-4px"
          {...(expandWords && { flexWrap: 'wrap' })}
        >
          {accessoryData.map((value, index) => (
            <Button
              key={`${value}-${index}`}
              size={expandWords ? 'xs' : 'sm'}
              onPress={() => {
                selected?.(value);
              }}
              m="4px"
              shadow="none"
            >
              {value}
            </Button>
          ))}
        </Box>
      )}
    </ScrollView>
  ) : null;
};
