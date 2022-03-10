import React, { FC, useMemo } from 'react';

import { RouteProp, useRoute } from '@react-navigation/core';
import { useNavigation } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import { Box, Form, Modal, Typography, useForm } from '@onekeyhq/components';
import { useToast } from '@onekeyhq/kit/src/hooks/useToast';
import {
  BackupWalletModalRoutes,
  BackupWalletRoutesParams,
} from '@onekeyhq/kit/src/routes/Modal/BackupWallet';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { ModalRoutes, RootRoutes } from '../../../routes/types';
import { updateWallet } from '../../../store/reducers/wallet';

type RouteProps = RouteProp<
  BackupWalletRoutesParams,
  BackupWalletModalRoutes.BackupWalletMnemonicsVerifyModal
>;

type MnemonicsVerifyValues = {
  word1: string;
  word2: string;
  word3: string;
};

const BackupMnemonicsVerifyView: FC = () => {
  const intl = useIntl();
  const toast = useToast();
  const navigation = useNavigation();
  const { dispatch } = backgroundApiProxy;
  const { mnemonics, walletId } = useRoute<RouteProps>().params;

  const { control, handleSubmit } = useForm<MnemonicsVerifyValues>({
    mode: 'onChange',
  });

  const pickNumbers = useMemo(() => {
    // 随机生成三个不同的数字,从小到大排序
    const randomNumbers: number[] = [];
    while (randomNumbers.length < 3) {
      const randomNumber = Math.floor(Math.random() * mnemonics.length);
      if (!randomNumbers.includes(randomNumber)) {
        randomNumbers.push(randomNumber);
      }
    }
    return randomNumbers.sort((a, b) => a - b);
  }, [mnemonics.length]);

  const onSubmit = handleSubmit(async (values: MnemonicsVerifyValues) => {
    const { word1, word2, word3 } = values;

    // check if the words are correct,Ignore case
    try {
      if (
        word1.trim().toLowerCase() ===
          mnemonics[pickNumbers[0]].toLowerCase() &&
        word2.trim().toLowerCase() ===
          mnemonics[pickNumbers[1]].toLowerCase() &&
        word3.trim().toLowerCase() === mnemonics[pickNumbers[2]].toLowerCase()
      ) {
        const wallet = await backgroundApiProxy.engine.confirmHDWalletBackuped(
          walletId,
        );
        if (!wallet || wallet?.backuped === false)
          throw new Error("Wallet isn't backuped");

        dispatch(updateWallet(wallet));
        navigation.navigate(RootRoutes.Modal, {
          screen: ModalRoutes.BackupWallet,
          params: {
            screen: BackupWalletModalRoutes.BackupWalletManualSuccessModal,
            params: {
              walletId,
            },
          },
        });
      } else {
        toast.show({
          title: intl.formatMessage({
            id: 'alert__some_of_words_you_typed_are_wrong',
          }),
        });
      }
    } catch (e) {
      console.error(e);
      toast.show({
        title: intl.formatMessage({
          id: 'msg__unknown_error',
        }),
      });
    }
  });

  const generateFormKey = (index: number) => {
    switch (index) {
      case 0:
        return 'word1';
      case 1:
        return 'word2';
      case 2:
        return 'word3';

      default:
        return 'word1';
    }
  };

  return (
    <Modal
      header={intl.formatMessage({ id: 'modal__finish_backup' })}
      hideSecondaryAction
      primaryActionTranslationId="action__done"
      primaryActionProps={{
        onPromise: () => onSubmit(),
      }}
      scrollViewProps={{
        children: (
          <Box>
            <Typography.DisplayMedium>
              {intl.formatMessage({ id: 'modal__finish_backup_desc' })}
            </Typography.DisplayMedium>
            <Form mt={6}>
              {pickNumbers.map((value, index) => (
                <Form.Item
                  name={generateFormKey(index)}
                  control={control}
                  rules={{
                    required: intl.formatMessage({
                      id: 'form__field_is_required',
                    }),
                    maxLength: {
                      value: 20,
                      message: intl.formatMessage({
                        id: 'msg__exceeding_the_maximum_word_limit',
                      }),
                    },
                  }}
                  formControlProps={{ width: 'full' }}
                  defaultValue=""
                >
                  <Form.Input
                    w="full"
                    placeholder={intl.formatMessage(
                      {
                        id: 'form__check_recovery_seed_placeholder',
                      },
                      {
                        0: value + 1,
                      },
                    )}
                  />
                </Form.Item>
              ))}
            </Form>
          </Box>
        ),
      }}
    />
  );
};

export default BackupMnemonicsVerifyView;
