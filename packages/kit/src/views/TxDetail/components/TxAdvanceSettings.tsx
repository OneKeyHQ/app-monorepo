import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Button, Collapse, Form, useForm } from '@onekeyhq/components';

import { useNetworkSimple } from '../../../hooks';

import type { ITxActionListViewProps } from '../types';

type AdvanceValues = {
  nonce: string;
};

function TxAdvanceSettings(props: ITxActionListViewProps) {
  const { decodedTx } = props;

  const { networkId } = decodedTx;

  const network = useNetworkSimple(networkId);

  const nonceEditable = network?.settings?.nonceEditable;

  const intl = useIntl();

  const useFormReturn = useForm<AdvanceValues>({
    mode: 'onChange',
    reValidateMode: 'onChange',
    defaultValues: {
      nonce: '0',
    },
  });

  const { control } = useFormReturn;

  const advanceSettings = useMemo(() => {
    const setttings = [];
    if (nonceEditable) {
      setttings.push(
        <Form.Item
          name="nonce"
          label={intl.formatMessage({ id: 'form__nonce' })}
          control={control}
          helpText={intl.formatMessage({
            id: 'content__these_information_may_be_found',
          })}
        >
          <Form.NumberInput
            size="lg"
            rightElement={
              <Button type="plain" size="lg">
                {intl.formatMessage({ id: 'action__reset' })}
              </Button>
            }
          />
        </Form.Item>,
      );
    }

    return setttings;
  }, [control, intl, nonceEditable]);

  if (advanceSettings && advanceSettings.length > 0) {
    return (
      <Collapse
        arrowPosition="right"
        textAlign="center"
        renderCustomTrigger={(onPress, collapsed) =>
          collapsed ? (
            <Button
              type="plain"
              size="sm"
              mt={2}
              rightIconName="ChevronDownMini"
              color="text-subdued"
              onPress={onPress}
            >
              {intl.formatMessage({ id: 'form__advance' })}
            </Button>
          ) : null
        }
      >
        <Form mt={6}>{advanceSettings}</Form>
      </Collapse>
    );
  }

  return null;
}

export { TxAdvanceSettings };
