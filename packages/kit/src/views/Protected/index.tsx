import type { FC } from 'react';
import { useCallback, useLayoutEffect } from 'react';

import { useIntl } from 'react-intl';

import {
  Box,
  Hidden,
  Switch,
  Text,
  Typography,
  useTheme,
} from '@onekeyhq/components';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { ValidationFields } from '../../components/Protected';
import { useNavigation } from '../../hooks';
import { useSettings, useStatus } from '../../hooks/redux';
import { setValidationState } from '../../store/reducers/settings';

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
      <Switch labelType="false" isChecked={isChecked} onToggle={onToggle} />
    </Box>
  </Box>
);

const Protected = () => {
  const intl = useIntl();
  const navigation = useNavigation();
  const { authenticationType } = useStatus();
  const { validationSetting = {} } = useSettings();
  const { themeVariant } = useTheme();

  useLayoutEffect(() => {
    const title = intl.formatMessage({ id: 'action__protection' });
    navigation.setOptions({
      title,
    });
  }, [navigation, intl, authenticationType]);

  const setValue = useCallback((key: ValidationFields, value: boolean) => {
    backgroundApiProxy.dispatch(setValidationState({ key, value }));
  }, []);

  return (
    <Box w="full" h="full" bg="background-default" p="4" maxW={768} mx="auto">
      <Box>
        <Typography.Caption mt="2" color="text-subdued">
          {intl.formatMessage({
            id: 'content__password_required_even_unlocked',
          })}
        </Typography.Caption>
        <Box w="full" mt="6">
          <Box
            mt="2"
            borderRadius="12"
            bg="surface-default"
            borderWidth={themeVariant === 'light' ? 1 : undefined}
            borderColor="border-subdued"
          >
            <Options
              title={intl.formatMessage({
                id: 'form__create_transactions',
              })}
              isChecked={validationSetting.Payment}
              divider
              onToggle={() =>
                setValue(ValidationFields.Payment, !validationSetting.Payment)
              }
            />
            <Options
              title={intl.formatMessage({
                id: 'form__create_delete_wallets',
              })}
              isChecked={validationSetting.Wallet}
              divider
              onToggle={() =>
                setValue(ValidationFields.Wallet, !validationSetting.Wallet)
              }
            />
            <Options
              title={intl.formatMessage({
                id: 'form__create_delete_accounts',
              })}
              isChecked={validationSetting.Account}
              onToggle={() =>
                setValue(ValidationFields.Account, !validationSetting.Account)
              }
            />
            {/* // view recovery_phrase or private_key always need input password */}
            <Hidden>
              <Options
                title={intl.formatMessage({
                  id: 'form__view_recovery_phrase_private_key',
                })}
                isChecked={validationSetting.Secret}
                onToggle={() =>
                  setValue(ValidationFields.Secret, !validationSetting.Secret)
                }
              />
            </Hidden>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default Protected;
