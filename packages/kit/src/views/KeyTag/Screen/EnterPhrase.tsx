import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  Form,
  Icon,
  Typography,
  useForm,
  useIsVerticalLayout,
} from '@onekeyhq/components';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useFormOnChangeDebounced } from '../../../hooks/useFormOnChangeDebounced';
import LayoutContainer from '../../Onboarding/Layout';
import { KeyTagRoutes } from '../Routes/enums';
import { IKeytagRoutesParams } from '../Routes/types';

type NavigationProps = StackNavigationProp<IKeytagRoutesParams>;

const EnterPhrase = () => {
  console.log('EnterPhrase');
  const isVertical = useIsVerticalLayout();
  const useFormReturn = useForm();
  const navigation = useNavigation<NavigationProps>();
  const { formValues } = useFormOnChangeDebounced({
    useFormReturn,
    revalidate: false,
    clearErrorIfEmpty: true,
  });
  const submitDisable = !formValues?.text;
  const intl = useIntl();
  const { control, handleSubmit } = useFormReturn;
  return (
    <LayoutContainer
      title="Convert Recovery Phrase to  Dotmap for KeyTag"
      secondaryContent={
        !isVertical ? (
          <Box>
            <Icon name="DotsCircleHorizontalOutline" />
            <Typography.Body2Strong>
              What is a recovery phrase?
            </Typography.Body2Strong>
            <Typography.Body2 color="text-subdued">
              It is a 12-, 18 or 24-word phrase that can be used to restore your
              wallet.
            </Typography.Body2>
          </Box>
        ) : undefined
      }
    >
      <Box flex="1">
        <Form>
          <Form.Item
            control={control}
            name="text"
            rules={{
              validate: async (t) => {
                console.log('validate--', t);
                if (!t) return true;
                try {
                  await backgroundApiProxy.validator.validateMnemonic(t);
                  return true;
                } catch (e) {
                  console.log('validate--', e);
                }

                return intl.formatMessage({
                  id: 'form__add_exsting_wallet_invalid',
                });
              },
            }}
          >
            <Form.Textarea
              placeholder="Enter Recovery Phrase"
              h="48"
              trimValue={false}
            />
          </Form.Item>
          {/* <Textarea placeholder="Enter Recovery Phrase" /> */}
          <Button
            isDisabled={submitDisable}
            size={isVertical ? 'xl' : 'lg'}
            onPromise={handleSubmit((values) => {
              console.log('handleSubmit--', values);
              navigation.navigate(KeyTagRoutes.ShowDotMap, {
                mnemonic: values.text,
              });
            })}
            type="primary"
          >
            Next
          </Button>
        </Form>
      </Box>
    </LayoutContainer>
  );
};
export default EnterPhrase;
