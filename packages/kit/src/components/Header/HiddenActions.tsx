/* eslint-disable no-nested-ternary */
import React, { FC } from 'react';

import { useIntl } from 'react-intl';

import { IconButton, Select, useIsVerticalLayout } from '@onekeyhq/components';

// eslint-disable-next-line @typescript-eslint/ban-types
type HiddenActionsProps = {};

const defaultProps = {} as const;

const HiddenActions: FC<HiddenActionsProps> = () => {
  const isVerticalLayout = useIsVerticalLayout();
  const intl = useIntl();

  return (
    <>
      <Select
        headerShown={false}
        footer={null}
        defaultValue="https://rpc.onekey.so/eth"
        activatable={false}
        options={[
          {
            iconProps: {
              name: isVerticalLayout ? 'ScanOutline' : 'ScanSolid',
            },
            label: intl.formatMessage({ id: 'title__scan_qr_code' }),
            value: 'scan',
          },
          {
            iconProps: {
              name: isVerticalLayout
                ? 'ArrowsExpandOutline'
                : 'ArrowsExpandSolid',
            },
            label: intl.formatMessage({ id: 'form__expand_view' }),
            value: 'expand',
          },
          {
            iconProps: {
              name: isVerticalLayout ? 'LockClosedOutline' : 'LockClosedSolid',
            },
            label: intl.formatMessage({ id: 'action__lock_now' }),
            value: 'lock',
          },
        ]}
        renderTrigger={({ onPress }) => (
          <IconButton
            name="DotsVerticalSolid"
            onPress={onPress}
            circle
            size={isVerticalLayout ? 'sm' : 'base'}
          />
        )}
      />
    </>
  );
};

HiddenActions.defaultProps = defaultProps;

export default HiddenActions;
