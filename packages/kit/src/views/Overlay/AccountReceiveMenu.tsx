import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Box, Dialog, IconButton, Typography } from '@onekeyhq/components';
import { isTaprootAddress } from '@onekeyhq/engine/src/vaults/utils/btcForkChain/utils';

import { showDialog } from '../../utils/overlayUtils';

import BaseMenu from './BaseMenu';

import type { IBaseMenuOptions } from './BaseMenu';

type Props = {
  iconBoxFlex: number;
  isSmallView: boolean;
  address: string;
  onReceive: (receiveInscription?: boolean) => void;
};

function ReceiveInscriptionDialog({
  address,
  onClose,
  onConfirm,
}: {
  address: string;
  onClose?: () => void;
  onConfirm?: () => void;
}) {
  const intl = useIntl();
  return (
    <Dialog
      visible
      contentProps={{
        iconType: 'warning',
        title: intl.formatMessage({ id: 'title__caution' }),
        content: intl.formatMessage({
          id: isTaprootAddress(address)
            ? 'msg__donot_send_ordinal_inscriptions_or_brc20_tokens_to_this_address'
            : 'msg__donot_send_ordinal_inscriptions_to_an_non_taproot_address_its_recommand_to_manage_inscriptions_assets_with_a_taproot_account',
        }),
      }}
      footerButtonProps={{
        onPrimaryActionPress: () => {
          onConfirm?.();
          onClose?.();
        },
        onSecondaryActionPress: () => {
          onClose?.();
        },
      }}
    />
  );
}

function AccountReceiveMenu(props: Props) {
  const { iconBoxFlex, isSmallView, onReceive, address } = props;
  const intl = useIntl();

  const options = useMemo(() => {
    const baseOptions: IBaseMenuOptions = [
      {
        id: 'action__receive_btc',
        onPress: () =>
          showDialog(
            <ReceiveInscriptionDialog
              address={address}
              onConfirm={() => onReceive()}
            />,
          ),
      },
      {
        id: 'action__receive_inscriptions_and_brc20',
        onPress: () => onReceive(true),
      },
    ];
    return baseOptions;
  }, [address, onReceive]);

  return (
    <Box flex={iconBoxFlex} mx={3} minW="56px" alignItems="center">
      <BaseMenu options={options} placement="bottom">
        <IconButton
          circle
          size={isSmallView ? 'xl' : 'lg'}
          name="QrCodeOutline"
          type="basic"
        />
      </BaseMenu>
      <Typography.CaptionStrong
        textAlign="center"
        mt="8px"
        color="text-default"
      >
        {intl.formatMessage({ id: 'action__receive' })}
      </Typography.CaptionStrong>
    </Box>
  );
}

export { AccountReceiveMenu };
