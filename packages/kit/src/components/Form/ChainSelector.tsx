import React, { useCallback, useMemo } from 'react';

import { ControllerProps, FieldValues } from 'react-hook-form';
import { useIntl } from 'react-intl';

import { Form } from '@onekeyhq/components';
import type { Network } from '@onekeyhq/engine/src/types/network';
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

    return networks.map((network) => ({
      label: network.name,
      value: network.id,
      tokenProps: {
        src: network.logoURI,
      },
      badge: network.impl === 'evm' ? 'EVM' : undefined,
    }));
  }, [networks]);

  const findActiveNetwork = useCallback<(id: string) => Network | null>(
    (id) => {
      if (!networks) return null;

      let selectedNetwork: Network | null = null;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      networks.forEach((network) => {
        if (network.id === id) {
          selectedNetwork = network;
        }
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
