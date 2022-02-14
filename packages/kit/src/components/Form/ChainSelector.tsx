import React, { useCallback, useMemo } from 'react';

import { ControllerProps, FieldValues } from 'react-hook-form';
import { useIntl } from 'react-intl';

import { Form } from '@onekeyhq/components';
import type { NetworkShort } from '@onekeyhq/engine/src/types/network';
import { useAppSelector } from '@onekeyhq/kit/src/hooks/redux';

function FormChainSelector<TFieldValues extends FieldValues = FieldValues>(
  props: Omit<ControllerProps<TFieldValues>, 'render'>,
) {
  const intl = useIntl();
  const networks = useAppSelector((s) => s.network.network);
  const activeNetwork = useAppSelector((s) => s.general.activeNetwork);
  const defaultNetworkId = activeNetwork?.network?.id;

  const options = useMemo(() => {
    if (!networks) return [];

    return Object.entries(networks).map(([key, value]) => ({
      title: key,
      options: value.map((item) => ({
        label: item.name,
        value: item.id,
        tokenProps: {
          src: item.logoURI,
        },
      })),
    }));
  }, [networks]);

  const findActiveNetwork = useCallback<(id: string) => NetworkShort | null>(
    (id) => {
      if (!networks) return null;

      let selectedNetwork: NetworkShort | null = null;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      Object.entries(networks).forEach(([_, value]) => {
        value.forEach((item) => {
          if (item.id === id) {
            selectedNetwork = item;
          }
        });
      });

      return selectedNetwork;
    },
    [networks],
  );

  return (
    <Form.Item
      label={intl.formatMessage({ id: 'network__network' })}
      helpText={(activeNetworkId = defaultNetworkId) => {
        const activeNetworkPayload = findActiveNetwork(activeNetworkId);
        return intl.formatMessage(
          {
            id: 'form__network_helperText',
          },
          {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            impl: activeNetworkPayload?.impl ?? '-',
          },
        );
      }}
      defaultValue={defaultNetworkId as any}
      formControlProps={{ zIndex: 10 }}
      {...props}
    >
      <Form.Select
        title={intl.formatMessage({ id: 'network__network' })}
        footer={null}
        containerProps={{
          zIndex: 999,
          padding: 0,
        }}
        triggerProps={{
          py: 2,
        }}
        options={options}
      />
    </Form.Item>
  );
}

export default FormChainSelector;
