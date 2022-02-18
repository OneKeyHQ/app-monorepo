import React, { FC, useMemo } from 'react';

import { useNavigation } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import { Center, Form, Modal, useForm } from '@onekeyhq/components';
import { CreateWalletRoutesParams } from '@onekeyhq/kit/src/routes/Modal/CreateWallet';
import {
  ModalScreenProps,
  RootRoutes,
  RootRoutesParams,
} from '@onekeyhq/kit/src/routes/types';

type NavigationProps = ModalScreenProps<RootRoutesParams> &
  ModalScreenProps<CreateWalletRoutesParams>;

type FieldValues = { mnemonic: string };

const RestoreFromMnemonicModal: FC = () => {
  const intl = useIntl();
  const navigation = useNavigation<NavigationProps['navigation']>();
  const {
    reset,
    handleSubmit,
    control,
    formState: { isValid },
  } = useForm<FieldValues>({
    mode: 'onChange',
    defaultValues: { mnemonic: '' },
  });

  const handleRestore = handleSubmit(() => {
    // TODO: Validate mnemonic again and create wallet from that

    // if success, change active to this, then navigate to create wallet
    reset();
    navigation.navigate(RootRoutes.Root);
  });

  const content = (
    <Center>
      <Form.Item
        control={control}
        name="mnemonic"
        defaultValue=""
        formControlProps={{ padding: 0 }}
        rules={{
          required: intl.formatMessage({ id: 'form__field_is_required' }),
          validate: (value: string) => {
            // TODO: validate mnemonic
            if (value.split(/\s+/).length !== 12) {
              // TODO: Replace i18n
              return 'Your mnemonic is invalid.';
            }
          },
        }}
      >
        <Form.Textarea
          placeholder={intl.formatMessage({
            id: 'form__recovery_seed_placeholder',
          })}
        />
      </Form.Item>
    </Center>
  );

  const actionProps = useMemo(
    () => ({
      isDisabled: !isValid,
    }),
    [isValid],
  );

  return (
    <Modal
      header={intl.formatMessage({ id: 'action__restore_with_recovery_seed' })}
      primaryActionTranslationId="action__restore"
      onPrimaryActionPress={() => handleRestore()}
      primaryActionProps={actionProps}
      scrollViewProps={{
        children: content,
      }}
      hideSecondaryAction
    />
  );
};

export default RestoreFromMnemonicModal;
