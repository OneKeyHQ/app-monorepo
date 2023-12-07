import { useCallback } from 'react';

import { useIntl } from 'react-intl';
import { YStack } from 'tamagui';

import type { IPageNavigationProp } from '@onekeyhq/components';
import { Page } from '@onekeyhq/components';

import { AddressInput } from '../../../../components/AddressInput';
import useAppNavigation from '../../../../hooks/useAppNavigation';
import { EModalRoutes } from '../../../../routes/Modal/type';
import { SendAssets } from '../../components/SendAssets';
import { EModalSendRoutes } from '../../router';

import type { IModalSendParamList } from '../../router';

function SendAddressInputContainer() {
  const intl = useIntl();
  const navigation =
    useAppNavigation<IPageNavigationProp<IModalSendParamList>>();

  const handleConfirm = useCallback(() => {
    navigation.pushModal(EModalRoutes.SendModal, {
      screen: EModalSendRoutes.SendAmountInput,
      params: {
        transfersInfo: [
          {
            from: '0x76f3f64cb3cD19debEE51436dF630a342B736C24',
            to: '0xA9b4d559A98ff47C83B74522b7986146538cD4dF',
            amount: '0.0001',
          },
        ],
      },
    });
  }, [navigation]);

  return (
    <Page>
      <Page.Header title={intl.formatMessage({ id: 'modal__send_to' })} />
      <Page.Body px="$4">
        <YStack>
          <SendAssets
            assets={[
              {
                'name': 'Bitcoin',
                'symbol': 'BTC',
                'id': '63455df060ad34cc8f4c23b1',
                'logoURI':
                  'https://cdn.jsdelivr.net/gh/atomiclabs/cryptocurrency-icons@1a63530be6e374711a8554f31b17e4cb92c25fa5/128/color/btc.png',
              },
            ]}
          />
          <AddressInput value="0xA9b4d559A98ff47C83B74522b7986146538cD4dF" />
        </YStack>
      </Page.Body>
      <Page.Footer
        onCancel={() => {}}
        onConfirm={handleConfirm}
        onConfirmText={intl.formatMessage({ id: 'action__next' })}
      />
    </Page>
  );
}

export { SendAddressInputContainer };
