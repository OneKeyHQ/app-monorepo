import React, { FC } from 'react';

import { useIntl } from 'react-intl';

import { Button, Form, useIsVerticalLayout } from '@onekeyhq/components';

import Layout from '../Layout';

import SecondaryContent from './SecondaryContent';

type ImportWalletProps = {
  onPressBackButton?: () => void;
  visible?: boolean;
  onPressDrawerTrigger?: () => void;
};

const defaultProps = {} as const;

const ImportWallet: FC<ImportWalletProps> = ({
  onPressBackButton,
  onPressDrawerTrigger,
  visible,
}) => {
  const intl = useIntl();
  const isVerticalLayout = useIsVerticalLayout();

  const placeholder = `${intl.formatMessage({
    id: 'content__enter',
  })} ${intl.formatMessage({
    id: 'form__recovery_phrase',
  })}, ${intl.formatMessage({ id: 'form__private_key' })}, ${intl.formatMessage(
    { id: 'form__address' },
  )}`;

  return (
    <>
      <Layout
        title={intl.formatMessage({ id: 'action__import_wallet' })}
        secondaryContent={
          <SecondaryContent onPressDrawerTrigger={onPressDrawerTrigger} />
        }
        onPressBackButton={onPressBackButton}
        visible={visible}
      >
        <Form.Textarea
          height={{ base: 160, sm: 216 }}
          placeholder={placeholder}
        />
        <Button
          isDisabled
          type="primary"
          size={isVerticalLayout ? 'xl' : 'lg'}
          mt={4}
        >
          {intl.formatMessage({ id: 'action__confirm' })}
        </Button>
      </Layout>
    </>
  );
};

ImportWallet.defaultProps = defaultProps;

export default ImportWallet;
