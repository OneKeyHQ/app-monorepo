import React, { FC, useCallback, useLayoutEffect } from 'react';

import { useIntl } from 'react-intl';

import { Box, Switch, Text, Typography } from '@onekeyhq/components';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { ValidationFields } from '../../components/Protected';
import { useNavigation } from '../../hooks';
import { useSettings, useStatus } from '../../hooks/redux';
import { EnableLocalAuthenticationRoutes } from '../../routes/Modal/EnableLocalAuthentication';
import { ModalRoutes, RootRoutes } from '../../routes/types';
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

const FaceID = () => {
  const intl = useIntl();
  const navigation = useNavigation();
  const { authenticationType } = useStatus();
  const { enableLocalAuthentication, validationState = {} } = useSettings();

  useLayoutEffect(() => {
    const title =
      authenticationType === 'FACIAL'
        ? intl.formatMessage({
            id: 'content__face_id',
          })
        : intl.formatMessage({ id: 'content__touch_id' });
    navigation.setOptions({
      title,
    });
  }, [navigation, intl, authenticationType]);

  const setValue = useCallback((key: ValidationFields, value: boolean) => {
    backgroundApiProxy.dispatch(setValidationState({ key, value }));
  }, []);

  return (
    <Box w="full" h="full" bg="background-default" p="4">
      <Box
        display="flex"
        flexDirection="row"
        justifyContent="space-between"
        alignItems="center"
        py={4}
        px={{ base: 4, md: 6 }}
        bg="surface-default"
        borderRadius={12}
      >
        <Text
          typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}
          flex="1"
          numberOfLines={1}
          mr="3"
        >
          {authenticationType === 'FACIAL'
            ? intl.formatMessage({
                id: 'content__face_id',
              })
            : intl.formatMessage({ id: 'content__touch_id' })}
        </Text>
        <Box>
          <Switch
            labelType="false"
            isChecked={enableLocalAuthentication}
            onToggle={() => {
              navigation.navigate(RootRoutes.Modal, {
                screen: ModalRoutes.EnableLocalAuthentication,
                params: {
                  screen:
                    EnableLocalAuthenticationRoutes.EnableLocalAuthenticationModal,
                },
              });
            }}
          />
        </Box>
      </Box>
      {enableLocalAuthentication ? (
        <Box>
          <Typography.Caption mt="2" color="text-subdued">
            {intl.formatMessage({
              id: 'content__face_id_touch_id_can_be_used_instead_of',
            })}
          </Typography.Caption>
          <Box w="full" mt="6">
            <Box>
              <Typography.Subheading color="text-subdued">
                {intl.formatMessage({
                  id: 'form__use_for_uppercase',
                })}
              </Typography.Subheading>
            </Box>
            <Box mt="2" borderRadius="12" bg="surface-default" shadow="depth.2">
              <Options
                title={intl.formatMessage({
                  id: 'form__app_unlock',
                })}
                isChecked={validationState.Unlock ?? true}
                divider
                onToggle={() =>
                  setValue(
                    ValidationFields.Unlock,
                    !(validationState.Unlock ?? true),
                  )
                }
              />
              <Options
                title={intl.formatMessage({
                  id: 'form__password_free_payment',
                })}
                isChecked={validationState.Payment ?? true}
                divider
                onToggle={() =>
                  setValue(
                    ValidationFields.Payment,
                    !(validationState.Payment ?? true),
                  )
                }
              />
              <Options
                title={intl.formatMessage({
                  id: 'form__create_delete_wallets',
                })}
                isChecked={validationState.Wallet ?? true}
                divider
                onToggle={() =>
                  setValue(
                    ValidationFields.Wallet,
                    !(validationState.Wallet ?? true),
                  )
                }
              />
              <Options
                title={intl.formatMessage({
                  id: 'form__create_delete_accounts',
                })}
                isChecked={validationState.Account ?? true}
                onToggle={() =>
                  setValue(
                    ValidationFields.Account,
                    !(validationState.Account ?? true),
                  )
                }
              />
              <Options
                title={intl.formatMessage({
                  id: 'form__view_recovery_phrase_private_key',
                })}
                isChecked={validationState.Secret ?? true}
                onToggle={() =>
                  setValue(
                    ValidationFields.Secret,
                    !(validationState.Secret ?? true),
                  )
                }
              />
            </Box>
          </Box>
        </Box>
      ) : null}
    </Box>
  );
};

export default FaceID;
