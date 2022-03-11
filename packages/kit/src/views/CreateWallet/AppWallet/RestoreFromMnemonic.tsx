import React, { FC } from 'react';

import { useNavigation } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import { Center, Form, Modal, useForm } from '@onekeyhq/components';
import {
  CreateWalletModalRoutes,
  CreateWalletRoutesParams,
} from '@onekeyhq/kit/src/routes/Modal/CreateWallet';
import { ModalScreenProps } from '@onekeyhq/kit/src/routes/types';

type NavigationProps = ModalScreenProps<CreateWalletRoutesParams>;

type FieldValues = { mnemonic: string };

const RestoreFromMnemonicModal: FC = () => {
  const intl = useIntl();
  const navigation = useNavigation<NavigationProps['navigation']>();
  const { reset, handleSubmit, control } = useForm<FieldValues>({
    defaultValues: { mnemonic: '' },
  });

  const handleRestore = handleSubmit((data) => {
    navigation.navigate(CreateWalletModalRoutes.AppWalletDoneModal, {
      mnemonic: data.mnemonic,
    });
    reset?.();
  });

  const content = (
    <Center>
      <Form.Item
        control={control}
        name="mnemonic"
        defaultValue=""
        formControlProps={{ padding: 0 }}
        labelAddon={['paste']}
        label={intl.formatMessage({ id: 'action__restore_with_recovery_seed' })}
        rules={{
          required: intl.formatMessage({ id: 'form__field_is_required' }),
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
  return (
    <Modal
      header={intl.formatMessage({ id: 'action__restore_with_recovery_seed' })}
      primaryActionTranslationId="action__restore"
      onPrimaryActionPress={() => handleRestore()}
      scrollViewProps={{
        children: content,
      }}
      hideSecondaryAction
    />
  );
};

export default RestoreFromMnemonicModal;
