import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import type { IKeyOfIcons } from '@onekeyhq/components';
import {
  Accordion,
  Icon,
  Page,
  SizableText,
  YStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { AccountSelectorProviderMirror } from '../../../components/AccountSelector';
import { ListItem } from '../../../components/ListItem';
import { useHelpLink } from '../../../hooks/useHelpLink';
import { HomeTokenListProviderMirror } from '../../Home/components/HomeTokenListProvider/HomeTokenListProviderMirror';
import { WalletActionBuy } from '../../Home/components/WalletActions/WalletActionBuy';
import { WalletActionReceive } from '../../Home/components/WalletActions/WalletActionReceive';

import type { IListItemProps } from '../../../components/ListItem';

function ReceiveOptions({
  icon,
  title,
  subtitle,
  ...props
}: { icon: IKeyOfIcons; title: string; subtitle: string } & IListItemProps) {
  return (
    <ListItem
      mx="$0"
      p="$4"
      borderWidth={1}
      borderColor="$borderSubdued"
      drillIn
      gap="$4"
      userSelect="none"
      {...props}
    >
      <YStack bg="$neutral3" p="$2" borderRadius="$full">
        <Icon name={icon} />
      </YStack>
      <ListItem.Text flex={1} primary={title} secondary={subtitle} />
    </ListItem>
  );
}

function ReceiveSelectorContent() {
  const intl = useIntl();
  const receiveFromExchangeHelpLink = useHelpLink({
    path: 'articles/11461136',
  });
  const handleReceiveFromExchange = useCallback(() => {
    openUrlExternal(receiveFromExchangeHelpLink);
  }, [receiveFromExchangeHelpLink]);
  return (
    <Page>
      <Page.Header
        title={intl.formatMessage({ id: ETranslations.global_receive })}
      />
      <Page.Body>
        <YStack gap="$2.5" px="$5">
          <WalletActionBuy
            onClose={() => {}}
            source="receiveSelector"
            renderTrigger={({ onPress, disabled }) => (
              <ReceiveOptions
                icon="CreditCardOutline"
                title="Buy crypto"
                subtitle="Credit/Debit card, Apple Pay, Google Pay, etc."
                onPress={onPress}
                disabled={disabled}
              />
            )}
          />
          <WalletActionReceive
            source="receiveSelector"
            renderTrigger={({ onPress, disabled }) => (
              <ReceiveOptions
                icon="QrCodeOutline"
                title="Receive from another wallet"
                subtitle="Receive using your wallet address"
                onPress={onPress}
                disabled={disabled}
              />
            )}
          />
          <Accordion type="single" collapsible>
            <Accordion.Item value="exchange">
              <Accordion.Trigger
                unstyled
                borderWidth={0}
                bg="$transparent"
                p="$0"
              >
                <ReceiveOptions
                  icon="SwitchHorOutline"
                  title="Receive from exchange"
                  subtitle="Binance, OKX, Coinbase, etc."
                />
              </Accordion.Trigger>
              <Accordion.HeightAnimator>
                <Accordion.Content>
                  <SizableText>123</SizableText>
                </Accordion.Content>
              </Accordion.HeightAnimator>
            </Accordion.Item>
          </Accordion>
        </YStack>
      </Page.Body>
    </Page>
  );
}

function ReceiveSelector() {
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.home,
        sceneUrl: '',
      }}
      enabledNum={[0]}
    >
      <HomeTokenListProviderMirror>
        <ReceiveSelectorContent />
      </HomeTokenListProviderMirror>
    </AccountSelectorProviderMirror>
  );
}

export default ReceiveSelector;
