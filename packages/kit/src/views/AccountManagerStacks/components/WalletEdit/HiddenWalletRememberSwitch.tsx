import { useEffect, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  ESwitchSize,
  IconButton,
  Popover,
  SizableText,
  Switch,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src//background/instance/backgroundApiProxy';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';

export function HiddenWalletRememberSwitch({
  wallet,
}: {
  wallet: IDBWallet | undefined;
}) {
  const walletId = wallet?.id;
  const isTemp = wallet?.isTemp;
  const [val, setVal] = useState(!isTemp);
  // This component stays mounted while the user moves between hidden wallets,
  // so the local switch state must follow the focused wallet (and the
  // persisted flag the list refresh brings back) instead of the first wallet
  // it was seeded from (OK-63622). Adjusting state during render avoids a
  // frame that shows the previous wallet's value.
  const seedKey = `${walletId ?? ''}:${String(isTemp)}`;
  const [prevSeedKey, setPrevSeedKey] = useState(seedKey);
  if (prevSeedKey !== seedKey) {
    setPrevSeedKey(seedKey);
    setVal(!isTemp);
  }
  // Persisting is async; if the user focuses another hidden wallet before a
  // toggle settles, the stale callback must not overwrite the new wallet's
  // display, or an accessible wallet could show as "off" and get hidden.
  const activeWalletIdRef = useRef(walletId);
  useEffect(() => {
    activeWalletIdRef.current = walletId;
  }, [walletId]);
  const intl = useIntl();

  return (
    <ListItem userSelect="none" key={wallet?.id}>
      <XStack flex={1} gap="$2" alignItems="center">
        <ListItem.Text
          primary={intl.formatMessage({
            id: ETranslations.form_keep_hidden_wallet_label,
          })}
        />
        <Popover
          title={intl.formatMessage({ id: ETranslations.global_hidden_wallet })}
          placement="bottom-start"
          renderTrigger={
            <IconButton
              testID="account-manager-intl-icon-btn"
              variant="tertiary"
              icon="InfoCircleOutline"
              size="small"
            />
          }
          renderContent={
            <YStack
              p="$5"
              pt="$0"
              $gtMd={{
                p: '$4',
              }}
            >
              <SizableText
                $gtMd={{
                  size: '$bodyMd',
                }}
              >
                {intl.formatMessage({
                  id: ETranslations.form_keep_hidden_wallet_label_desc,
                })}
              </SizableText>
            </YStack>
          }
        />
      </XStack>
      <Switch
        testID="account-manager-switch"
        size={ESwitchSize.small}
        value={val}
        onChange={async () => {
          if (!walletId) {
            return;
          }
          const targetWalletId = walletId;
          const newVal = !val;
          try {
            await backgroundApiProxy.serviceAccount.setWalletTempStatus({
              walletId: targetWalletId,
              isTemp: !newVal,
            });
            if (activeWalletIdRef.current !== targetWalletId) {
              return;
            }
            setVal(newVal);
          } catch (error) {
            if (activeWalletIdRef.current === targetWalletId) {
              setVal(val);
            }
            throw error;
          }
        }}
      />
    </ListItem>
  );
}
