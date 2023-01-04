import { useNavigation } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  Center,
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

import type { IKeytagRoutesParams } from '../Routes/types';
import type { StackNavigationProp } from '@react-navigation/stack';

type NavigationProps = StackNavigationProp<IKeytagRoutesParams>;

const EnterPhrase = () => {
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
      title={intl.formatMessage({
        id: 'title__convert_recovery_phrase_to_dotmap_for_keytag',
      })}
      secondaryContent={
        !isVertical ? (
          <Box>
            <Center
              mb={6}
              size={12}
              bgColor="decorative-surface-one"
              borderRadius="9999px"
            >
              <Icon
                size={24}
                color="decorative-icon-one"
                name="DotsCircleHorizontalOutline"
              />
            </Center>
            <Typography.Body2Strong>
              {intl.formatMessage({ id: 'content__what_is_recovery_phrase' })}
            </Typography.Body2Strong>
            <Typography.Body2 mt={2} color="text-subdued">
              {intl.formatMessage({
                id: 'content__what_is_recovery_phrase_desc',
              })}
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
                if (!t) return true;
                try {
                  await backgroundApiProxy.validator.validateMnemonic(t);
                  return true;
                } catch (e) {
                  console.error('validate mnemonic', e);
                }

                return intl.formatMessage({
                  id: 'form__add_exsting_wallet_invalid',
                });
              },
            }}
          >
            <Form.Textarea
              placeholder={intl.formatMessage({
                id: 'form__enter_recovery_phrase',
              })}
              h="48"
              trimValue={false}
            />
          </Form.Item>
          {/* <Textarea placeholder="Enter Recovery Phrase" /> */}
          <Button
            isDisabled={submitDisable}
            size={isVertical ? 'xl' : 'lg'}
            onPromise={handleSubmit((values) => {
              navigation.navigate(KeyTagRoutes.ShowDotMap, {
                mnemonic: values.text,
              });
            })}
            type="primary"
          >
            {intl.formatMessage({ id: 'action__next' })}
          </Button>
        </Form>
      </Box>
    </LayoutContainer>
  );
};
export default EnterPhrase;
