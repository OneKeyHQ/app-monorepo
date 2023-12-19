import { useState } from 'react';

import { Button, Text, TextArea, Toast } from '@onekeyhq/components';
import { generateMnemonic } from '@onekeyhq/core/src/secret';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useAccountSelectorActions } from '../../states/jotai/contexts/accountSelector';

export function CreateHdWalletForm() {
  const { serviceAccount, servicePassword } = backgroundApiProxy;
  const [text, setText] = useState<string>(
    'zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo vote',
  );
  const actions = useAccountSelectorActions();

  return (
    <>
      <Text variant="$heading5xl">添加 HD 钱包</Text>

      <Button
        onPress={async () => {
          setText(generateMnemonic());
        }}
      >
        🔄
      </Button>
      <TextArea
        value={text}
        onChangeText={(t) => setText(t)}
        placeholder="输入助记词"
      />
      <Button
        onPress={async () => {
          const { wallet, indexedAccount } =
            await serviceAccount.createHDWallet({
              mnemonic: text,
            });

          console.log('hd wallet created: ', wallet);

          Toast.success({ title: `创建成功: ${wallet.name}` });

          actions.current.updateSelectedAccount({
            num: 0,
            builder: (v) => ({
              ...v,
              indexedAccountId: indexedAccount.id,
              walletId: wallet.id,
              focusedWallet: wallet.id,
            }),
          });
        }}
      >
        + HD 钱包
      </Button>
      <Button
        variant="destructive"
        onPress={async () => {
          const mnemonic = await servicePassword.encodeSensitiveText({
            text,
          });
          await serviceAccount.createHDWallet({
            // mnemonic: text,
            mnemonic,
            password: '11111111',
          });
        }}
      >
        + HD 钱包 (参数不加密)
      </Button>
    </>
  );
}
