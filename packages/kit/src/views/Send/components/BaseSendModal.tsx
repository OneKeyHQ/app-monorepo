import { ComponentProps } from 'react';

import { Modal } from '@onekeyhq/components';

import { useActiveWalletAccount } from '../../../hooks/redux';

export type IBaseSendModal = ComponentProps<typeof Modal>;
function BaseSendModal(props: IBaseSendModal) {
  const { network } = useActiveWalletAccount();

  return (
    <Modal
      headerDescription={network?.name || network?.shortName || undefined}
      onSecondaryActionPress={({ close }) => close()}
      {...props}
    />
  );
}

export { BaseSendModal };
