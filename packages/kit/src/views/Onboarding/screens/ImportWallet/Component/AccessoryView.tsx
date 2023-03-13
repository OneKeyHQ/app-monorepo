import type { ComponentProps, FC } from 'react';
import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Alert, Box, Button, ScrollView } from '@onekeyhq/components';
import useIsKeyboardShown from '@onekeyhq/components/src/Layout/BottomTabs/utils/useIsKeyboardShown';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

interface AccessoryViewProps extends ComponentProps<typeof ScrollView> {
  withKeybord?: boolean;
  accessoryData?: string[];
  selected?: (value: string) => void;
}

export const AccessoryView = ({
  accessoryData,
  withKeybord,
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
      horizontal
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
        <>
          {accessoryData.map((value, index) => (
            <Button
              key={`${value}-${index}`}
              size="sm"
              onPress={() => {
                if (selected) {
                  selected(value);
                }
              }}
              mr="8px"
            >
              {value}
            </Button>
          ))}
        </>
      )}
    </ScrollView>
  ) : null;
};
