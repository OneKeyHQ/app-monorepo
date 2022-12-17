import type { FC } from 'react';
import { memo, useLayoutEffect } from 'react';

import { useIntl } from 'react-intl';

import { Box, Switch, Text, useTheme } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useNavigation } from '@onekeyhq/kit/src/hooks';
import { useSettings, useStatus } from '@onekeyhq/kit/src/hooks/redux';
import { setEnableHaptics } from '@onekeyhq/kit/src/store/reducers/settings';
import { defaultHapticStatus } from '@onekeyhq/shared/src/haptics';

type OptionsProps = {
  title?: string;
  onToggle?: () => void;
  divider?: boolean;
  isChecked?: boolean;
};

const Options: FC<OptionsProps> = ({ title, onToggle, divider, isChecked }) => (
  <Box
    display="flex"
    flexDirection="row"
    justifyContent="space-between"
    alignItems="center"
    py={4}
    px={{ base: 4, md: 6 }}
    borderBottomWidth={divider ? '1 ' : undefined}
    borderBottomColor="divider"
  >
    <Text
      typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}
      flex="1"
      numberOfLines={1}
      mr="3"
    >
      {title}
    </Text>
    <Box>
      <Switch
        labelType="false"
        key={isChecked?.toString?.()}
        isChecked={isChecked}
        onToggle={onToggle}
      />
    </Box>
  </Box>
);

const VolumeHaptic = () => {
  const intl = useIntl();
  const navigation = useNavigation();
  const { authenticationType } = useStatus();
  const { enableHaptics = defaultHapticStatus } = useSettings();
  const { themeVariant } = useTheme();
  const { dispatch } = backgroundApiProxy;
  useLayoutEffect(() => {
    const title = intl.formatMessage({ id: 'form__sound_n_vibration' });
    navigation.setOptions({
      title,
    });
  }, [navigation, intl, authenticationType]);

  return (
    <Box w="full" h="full" bg="background-default" p="4" maxW={768} mx="auto">
      <Box w="full">
        <Box
          mt="2"
          borderRadius="12"
          bg="surface-default"
          borderWidth={themeVariant === 'light' ? 1 : undefined}
          borderColor="border-subdued"
        >
          <Options
            title={intl.formatMessage({
              id: 'form__vibrate',
            })}
            isChecked={enableHaptics}
            onToggle={() => {
              dispatch(setEnableHaptics(!enableHaptics));
            }}
          />
        </Box>
      </Box>
    </Box>
  );
};

export default memo(VolumeHaptic);
