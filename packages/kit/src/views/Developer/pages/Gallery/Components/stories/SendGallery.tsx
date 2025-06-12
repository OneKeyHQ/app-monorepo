import { type ReactNode, useCallback } from 'react';

import { StyleSheet } from 'react-native';

import {
  Button,
  SizableText,
  Stack,
  Toast,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import type { IV4MigrationImportedCredential } from '@onekeyhq/kit-bg/src/migrations/v4ToV5Migration/types';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { Layout } from './utils/Layout';

function PartContainer({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <YStack>
      <Stack paddingTop="$5" paddingBottom="$2.5">
        <SizableText size="$headingMd">{title}</SizableText>
      </Stack>

      <YStack
        padding="$2.5"
        gap="$5"
        borderColor="$border"
        borderWidth={StyleSheet.hairlineWidth}
        borderRadius="$2"
      >
        {children}
      </YStack>
    </YStack>
  );
}

function ExternalAccountSign() {
  const { activeAccount } = useActiveAccount({ num: 0 });
  return (
    <PartContainer title="ExternalAccountSign">
      <Button
        onPress={async () => {
          const r = await backgroundApiProxy.serviceDemo.demoEvmPersonalSign({
            networkId: activeAccount.network?.id || '',
            accountId: activeAccount.account?.id || '',
          });
          console.log('Personal Sign result:', r);
          if (r.isVerified) {
            Toast.success({
              title: `Personal Sign success: ${r.signature}`,
            });
          } else {
            Toast.error({
              title: `Personal Sign failed: ${r.signature}`,
            });
          }
        }}
      >
        personal_sign: ({activeAccount.account?.address})
      </Button>

      <Button
        onPress={async () => {
          /*
            rawTx
              "0x02f86d0101830128ed8301d1ac828a109402ba7fd1b0acdd0e4f8c6da7c4ba8fd7f963ba5085012a05f20080c080a0a628a75f3355a5e765a0dcd2844e84254601c55e01ff851bc18e766c6e2c2deca07bca58e8e36f1d3729c47b22b7cc0797317951ea24336a238e0f706f6404d5ec"
            txid
              "0x63a5e9fdc8ae8c6cfb72c5662bee9e84a4c19887d01c25e8180ee10d24ac6601"
          */
          const r = await backgroundApiProxy.serviceDemo.demoEvmSendTxSign({
            networkId: activeAccount.network?.id || '',
            accountId: activeAccount.account?.id || '',
            encodedTx: {
              from: '0x02bA7fd1b0aCdd0E4F8c6DA7C4bA8Fd7F963bA50',
              to: '0x02bA7fd1b0aCdd0E4F8c6DA7C4bA8Fd7F963bA50',
              gasLimit: '0x8a10',
              maxPriorityFeePerGas: '0x128ed',
              maxFeePerGas: '0x1d1ac',
              data: '0x',
              nonce: '0x1',
              value: '0x12a05f200',
              chainId: '0x1',
              // https://github.com/MetaMask/core/blob/main/packages/transaction-controller/src/types.ts#L860
              // type: '0x2', // legacy = '0x0',  accessList = '0x1',  feeMarket = '0x2',
            },
          });
          console.log('Sign tx success', r);
          Toast.success({
            title: `Sign tx success: ${r.rawTx} ${r.txid}`,
          });
        }}
      >
        sign tx: ({activeAccount.account?.address})
      </Button>

      <Button
        onPress={async () => {
          /*
            rawTx
              "0x02f86d0101830128ed8301d1ac828a109402ba7fd1b0acdd0e4f8c6da7c4ba8fd7f963ba5085012a05f20080c080a0a628a75f3355a5e765a0dcd2844e84254601c55e01ff851bc18e766c6e2c2deca07bca58e8e36f1d3729c47b22b7cc0797317951ea24336a238e0f706f6404d5ec"
            txid
              "0x63a5e9fdc8ae8c6cfb72c5662bee9e84a4c19887d01c25e8180ee10d24ac6601"
          */
          const r = await backgroundApiProxy.serviceDemo.demoEvmSendTxSign({
            networkId: activeAccount.network?.id || '',
            accountId: activeAccount.account?.id || '',
            encodedTx: {
              from: '0x02bA7fd1b0aCdd0E4F8c6DA7C4bA8Fd7F963bA50',
              to: '0x02bA7fd1b0aCdd0E4F8c6DA7C4bA8Fd7F963bA50',
              gasLimit: '0x8a10',
              gasPrice: '0x128ed',
              data: '0x',
              nonce: '0x1',
              value: '0x12a05f200',
              chainId: '0x1',
              // https://github.com/MetaMask/core/blob/main/packages/transaction-controller/src/types.ts#L860
              // type: '0x2', // legacy = '0x0',  accessList = '0x1',  feeMarket = '0x2',
            },
          });
          console.log('Sign tx success', r);
          Toast.success({
            title: `Sign tx success: ${r.rawTx} ${r.txid}`,
          });
        }}
      >
        sign legacy tx: ({activeAccount.account?.address})
      </Button>
    </PartContainer>
  );
}

function SendTestButton() {
  const { activeAccount } = useActiveAccount({ num: 0 });

  return (
    <Stack>
      <Button
        onPress={async () => {
          const r = await backgroundApiProxy.serviceDemo.demoSend({
            networkId: activeAccount.network?.id || '',
            accountId: activeAccount.account?.id || '',
          });
          console.log('demoSend done:', r);
        }}
      >
        测试发送流程(使用首页的账户选择器)
      </Button>
      <SizableText>
        {activeAccount.network?.id}, {activeAccount.account?.id},
        {activeAccount.account?.address}
      </SizableText>
    </Stack>
  );
}

function BatchFetchRawTx() {
  const fetchRawTx = useCallback(async () => {
    const r = await backgroundApiProxy.serviceSend.getRawTransactions({
      networkId: getNetworkIdsMap().btc,
      txids: [
        'e09b43f0a901d4bf4c32e91944105244106b305916001ca4e689470655172530',
        '976e767cbe4533a9b3482adea568da27f348be8f48bfa8f9f0b0f8f5a2a8041d',
        '033ac49ccc84de4a97a2ece743760572d639e6556e65d6b92789256b8fe4be8c',
        '03c4483e411d4282c9df64423c00d11b65cdecc5d5feb9eeabca66e4134fccf3',
        '2a511d931219ebd0833ea2d5f75868dbc2297485afbe0a5a5ff1af788780c01c',
        'be86ab3f4d8fb995a277b667efee753f30ab349c7efe7ea20991f30330a41195',
        '0703d87513f5c90847eb590d07f1560d45bd45b44dad1ac07c223297018f53c2',
        'f90c121e5b497b996062c6eb9f8c8a32f59923eac60c80e0dfe181baa8756fe6',
        '19a74ebcdd79478bc69f8273f2a2d59fbcf3798f21e74c0f5fbafab173125464',
        'b8870a59da0b61c59bdac6aa70c86a803ed1e85f92f8149e4d6a920015897bac',
        '5ac4f54dc9df6111587116e1f33be59f3047efe7eb6bd4505100b8d6fbbd359d',
        'd8de7836828610e692b3fdd5c66deb2a4481ccfd20b50e22558a8148a8888f59',
        '664d3a1bc8ca37e7ab2116f6e34ec0bebe7f7014b6319ce1c4534f1d21ecd8d0',
        '15aa951bd0ef112afc8c30de79cb9fdf9546c65e55482a3cebb69cd2d4d13c25',
        '21df85713f483e90f737680d64fda62d74a5a52c9c9b267aec3c69e70bcd9b96',
        '3deae6381d3e4a0190e1161136be621d2daf59fd71b65635545f069c0b9aef1f',
        'a576d9a7c1a79b088965440257f69acf29897e83cc5eb7f3c392866751d01b6b',
        '38573b7091d87e99da1711943318d66c39d5d173139411cce08e870ae7e3b391',
        'f6c4aea6aa4f442b2a950faf50ffc3b90e38eb9d25cf6e7ffad6e52904c98e81',
        '486da9dbc124cfe6ecd54168fba2c045712621192398f7d4d30b80312623a1fa',
        '01e9e2e4ecb9da66aa37f5bdccd9d5f21c8fc72d24986956633c9ef5f3d192f2',
        'e970c37bac4d0e859b825384e625402cbef62622062398dda7df93b6c8e6987f',
        '5991b89e53c13dfe119eea9b8640d0e533417b2b7f0adcfe475316ca19bdac07',
        'a831a98d066628eea8030cd6868c5f4e80fc12b6a6539a264934acdea0ff6632',
        '1fc2fa4a4f18244c193aa7b0e999496b24fbd364c2878d88f526d5fd0d91d326',
        '21e5e6d317b0256e798cc6b1d6ddfaa6c3d70752ee0a746af1778e9bc034f3eb',
        '7e445e52ad0b7eca1cf73546aeb345f344365974ccbb7ec0286a8d6342040f76',
        '630bf66a19572f2c6afddccd732820fc2e6c134eb880334403d52852e3d18c94',
        '73db35ae437ddc3fbbc6baeb8e012c6ec9fb9adaa3ee474582b895c9f590ef25',
        'b1da35fa4130920a88135dfcecdfcf2df3f24196618a5ffa0a4bc953b0fe4f61',
        '447d0faaac38b08bdcf1ab094b821b34bacdd46e9e31076699fac28eb227a675',
        'de2f16fa706077ffe544a08531ef52806ef39fb0cd208d0ad1cd624122c2680c',
        'df434c700ded847dc92e3aeb3d3a0a5d59366c5c0cb4e26a3874d88e2d4dbde6',
        'a831e8ea793b51952327b51908e84746965114bc47680dfe222fea18e1570fb0',
        'fd362d6c824ecd3cabfcf74e1f619d77b1b2ba83c6b0a3b4d9a2335bb07d4e7c',
        '45e7c641ed80e780c200c6da520a8b333f49072e5a079ed64c88b98eef0624cf',
        'fff90e6a0dcc7f96b4ed76824941491f16bc70ca62bd6a55c37570545fcc248e',
        '2bad7833e3de0d104a546aec5e7a442fd5071b8f6dfe6c14a734516af9821426',
        '4f9c7e1f069ecbf4a119c6bafbcbb80055337ececcb61299f51d95978e8b2aaa',
        '87aa720937cb32fe4dd8ae33b8c642a2411d7941a5dbfa75a168348fad0fca8f',
        '088a1701a0ef4c2801c087175215f4cb03574176cee27f7c9cb60eeba6d1423b',
        'a8ebe4cc6a83c112e2c20bdb59f00070fc668f4ed472b74ac49b8577846a9f3c',
        '5f4169e58cb5800e8079cc1c3c4668b451f47abc2b3871109ebd2ba6eefc142b',
        '247622dbfb71ccf9fb07ba31485da0b447ab6093feebff9a69e0e6ce286c452a',
        '801f694a61baec9079138c4e0d0dadbc0e9d269982a8bc3da2c809ee61fb5cdd',
        '6c04b7e4d66d5411fa09f55bd33213122842bbbe726061ad74d0963c30152dcc',
        'fa435aa8c175cf8ed50de7906d936018cfca4c01c3a0ed8a0278859a146bd3a7',
        '3e9811fcce74ee5444a890bd802a4c5a21ee6d31159ef277c17b40bfefd2d003',
        'ebea84e7c9dab590db7530f6806630b466c067172abecaecad29b5a0e77220a5',
        '384ca9d83591c15fa86306b53229fcb125099b753d2a105908feefc79c24010b',
        '8059cc897d7a1d78f0cc6616c568a58361aa13e593f1b4bbf8b6b15b4a281d1a',
        'b16ea62dfca054d0e990715dfdb1d8c8e04eb9172300e4f5e4ba5af491afc7e1',
        'ee71c1a17bc565132fc175c1a6c1e7b59a5d02edf05f12285cb034c71c78a56f',
        '7a2bc085b99e2e62857e3fa7178a2f6813bb728bfc17a7811cd9f44d447d4f70',
        '89c1bf3c7fff580ef3f8287a80aea22e6b0f678ae71f90cb0950ebce6534e979',
        '1379966bf3770b0b19ec59e3729de686a964fd5f42c40577e836cb8a8e1feeec',
        '27c516f6cf4a973114f2590816bf598cb6b5577eb17ef2ca7725b479c0902c39',
        'be32af1552409b28713b858d5c1eb1a3b828ffa17b12bb2475ed971567f639b8',
        'e4632b11cc2eca7945100cbc8f72bb772beddf8cbb1e356f16d955f174c2c6ec',
        'e4fbf2969e875076d8023664bc37d3a6c0ff7189b44c58b3c94be80e3ea64e99',
        '2d2ebb7e87892067a6b57c383a385a49f13455e1dd248bbaa030ad83f2891713',
        'c66220a88ca821d584fc480d48f58daaf0dc08625b1167b8d85a00997d3cce7d',
        '50114ea24214a558057536227a0d9beae8a4a0c52b1ceb438c3e90e4db50f483',
        'b17b22386b2385cf87c16d7dd0ae8784366b4733ce11b95a6a2ea7a43e1f6d61',
        'bf0ed5e857d5fe4bfded6dfd04adfb5ad314de9c4277abf76ec5f01d549f8d06',
        '6815e1b2eeee9840b7021aa4ac85341297ccf07385c0369cc4ea68e8408721c4',
        '4f52c1fa0ee3649b302c5242a716f0c40ce13d7cd07855ec49564494e5480393',
        '208603c68db659f70094637a32535be219a58c8a128a65837ddc57a54e5c6d4e',
        'd8d5c202a5a0342439ea612c51b4771b0f118ad205cac135598c70bc00f44194',
        'fe3059a5163469355589844a06e0893426434dd51ede223618851065310f44d9',
        '40d9874173304d92e50dbd76ab7b5c6a5b7c1e3eb498308b252a5c5c213acee8',
        '3311db7468d3142ca9656ae5666e8202f857d99666fffbfea1dfb90e35ac112d',
        'fdd236a9d141ba4bc1e2efc3c1022a1a41adfd8d229c9a5e70fafdb1c83e9a17',
        'c75662dd9278a5737bf03ef651b68c4e0b82944865dd43e0fb6c431cae002a81',
        '3520cd9179aa89e90e4b59c604bc0a6fffbf70f09b83429b20f686505b44d6d3',
        '82e40ffe8fde7df1d29d274412bc2b92536e412b5b6ada3216e532b033e220f3',
        '6a36d90952d93c5b8d93d6e371bd754cefbd482e63c8851e25a59a14865c1890',
        '204a8c5aa57db63ff17890f9b1da11a0b67c2c4b57f89d4d3e20a4fe9cbed748',
        'a2443b78b1d7cd119004f98911300d4101ad95a61d33ddc1c868b7b0eb50abd2',
        '9a6aff834a4520bd894188f4a2e4d634efd4ed1632cde1a3fb16764ae8761b0f',
        'a85e48a2efb95108e4d339ca700bf2a7fbf0364ef25371b4a40610950381f35f',
        '9efc5b907ddddc5ff72504192e4a412c68e53bb0d1ba313adce2ca6902989393',
        '195b2c0cb2b9565f6ad97f45b3b815b9b01cb6f8be746111f5466254884ddc45',
        'ff05e71979ed310c67a2b7c7e5588a0344c347ebc0ba6e98c2ed606c6b44315d',
        '9e1cf31b12306bea229c95d8f1f46221a6a0739e586273bbb33ab2c5ff7411dc',
        'fb5ef1e35cac9fd497f35afb0843e6b906191e24ce051ca72a6fbf9446044423',
        'aab77e03f882877d84f3ce988ee8ce1a22ba3e3768627ef10055dc8a9b0f1a20',
        '5a1b50c02286159602ab08b2f4fcca92ee92078fb2a7d1f9a507daffd2102ed1',
        'befd9e0c1bd3edf30bda3f1c934f360c96706fa697344c66695e499166676b36',
        'a9fbad4f09aa646093d938c5b7c1a89e961e66cfdb79089e1571125d52c9cfbb',
        '3a091d007439491823c1249043c5477d82ef678308d2df68d4136b9bd02c480e',
        'c76328cbf26fce3226436b9bc4bb1749cd600f9f61d28e809cf001f045247625',
        '187d8437bd8610020227253385e0babf0836dc10bc6d96dfc668f6f7b6682256',
        '80180b353fc266a320a0c3a501e0a5b4714675e5458c69a96c557f3248b63021',
        '0ea20af19757f8ff2e4f11898887949dc00eda1125d1fbfbfb42366b945abd28',
        '242009ab80627826660c70eb5bf7f3e3840ed2d217a0fe410c9604797afd520d',
        'c425413c908b4d43d1a7d2f92b9671d50b152a7a05b4ae703adee1f5badae6db',
        '815a3874535f3dfa947b8ee65b6c28ebfb4474c5ff19739906c2fa8347f0fc77',
        '2d11c8148d6137a61f7245b27de4b2f21864fb330049c1b6ebf616511ba69eb3',
        'fe2d6b486b63467641385becbf5661c5455e3bfb6aab0590b6676581ae95d6db',
        'c031805dc19dd0dc540d75442c2fc9a35b70f8995a77ec7df8d927f12b0bd100',
        '7b1502bd95ad0245a20d5c94bac21c74f91f2283c75640023393c70d6a3aa71f',
        'cd8c44e7f663679f141cd7bbafb1a5ae9d1a475519cd530d47375d00f81d3b21',
        '3c3c58f809ef8bb7e160e9a84a7835652b4127a2dfa54fb89b44d68fed708569',
        '49216ea125a61da3f04f51bb105bc840657448d122cdb305c6ad0e7a1644939b',
        'a46d924574648ec82b80e0a7e54cd55d2df3936a41cd5eea6ca8572925cd42c0',
        '9a0a12e7fa7d97fbc52e3a6238b83a8c755afd2fda1a1e7ee768273b4a7ad647',
        'cbfaf788234cebc1a65a8f7c26b9c25d17eeee581d63cc397809fe3ac2b50611',
        'ac8ed42ddb2307d6e8786bac77ab435000423a59b1b58dda305f5d9f5ba2b568',
        '07e788f9b5da2ef0ca3f441e861068ce25b5bffc189b4f583e656bfcf5cdee58',
        '505377042af343e8067a84ab2a9dc8e45a82022b2c4c71379ae505e19a90a1ed',
        '31fbfdabfa795576ce0b6cea0ff0e33735f38a520e644158ac3c09ba6792f236',
        '2b3e9c24dcb5a6fc11752fcec90d993a5d0bda16d0505943bc140d42810793a6',
        '93d4ef45acb44e0299a3467a5e5a537d8a004f0cc694bdc4d6d6496a264a88f4',
        '758f4c5a720aa97c217287fd3e7cfefc8c940bc3ffa2e35a0c6d829dc4ccec95',
        '4520ff7422d7826b9a138f5f3745e69053bb7466c2065ba54a461a091720b11c',
        '607d0e3bcdecac6615e5bd98a1e10340399f0a1847a2dd4a7238e7179d1c8669',
        '4fb1bbf6bca487af6faca7a5e2f2035b1ee1b871958cc3724d177546b714b1a0',
        '9aaf3bba09fcaf6e951592a32cf9dc625fd688e74c67ab93481b02376810008c',
        'd373eba598b39426125e76cf9385586a568a4166db1fd6f766fc4ad78c3228fa',
        '1238b8d3196b935112d436840dd82c28a90b24a8b2773bb7028f389f6ce80d3b',
        '872fdeb0849c3c493b9f121d276f3f4a4535476205a5b791bbfe26b73ddf3f78',
        'a261b302b590866809c451e1cbc7167f264ef2b7c47a61fc2bca2c3a34381a97',
        'f2c8b895b4cf35737fb0b1f1d742b7622e92386d22f4cedd249a0c708a3d5ca2',
        '35454645e5616471688ce32a79c92ba46e4e2d6ee6859e959f18212e7494346d',
        'f59824a5e63259b81a13a95611a9100c5f88524f4795287d94cecb1d14b168f3',
        'd103015a26f1a1dedea6ed77841778c982763272e910c1072c20ef2cdbe0df90',
        '2f87403ce864d66f54b2cfa79e81f63946b5f5657697338cf1b9dfe6d0df4670',
        '9e0ff964539851938e77fdee87a57f5b7344fc43e03ec31b5d254754a8713232',
        'd060858bd2a2fe042959b8e0e06949afbf1e4aeb89b97642cf7da80369ec4a90',
        '2fddff19698ea1eeffd179f0c02446791791b8c27b4b587027e71f01cb9ce84f',
        '77c663c09004fa65db5e8df6994c87fd76ea4f9b8af808a2f8e691106c4cd325',
        'bb88479ddd3b0fcbacbb2c202c45f3346bf14352034e2f46b4b31b63736c2d53',
        'da8285e53f441d3211c58a5e1f29906d6dc986c281c7d06c2fdb5a833736868b',
        '917c348da0a906f09cca7d483849012601583a0609a54fdc76369c394765fa5e',
        'a43c9877e79e89112a6510c73074927139fe179ca0eee3ea8e5423acda3246b1',
        'b251db28deb12ec41f9c05b21a5706c923e0f2fe4eb333f6f2c46f0b744de3ab',
        'fcf3ef1312b2e5aca36cbe603758fce1da651dfe96d71c2bee5eff38fb9dc2e5',
        'e4c8aa762874ce7734c3cae3916a9683a96c8fa9d2e4201eb251ab5bd2896ad0',
        'fdeb615ec248661858a0b7d574cddf91de7fa5abcf3cf28b0537a1e4e1ce9a92',
        '9c1d31704d4505df90838e85cb44ad4197b2be73216a22ffc6b6ebcd0609b4a9',
        '8a92d1cdd2c96319753053d94e8e7877e5570e1e78cda1fe032ca6aa4d9c754d',
        '3d3d11028c7e9a9629fb314b9ddf521b81bd3e84d21bf305b9ec94b3d4df24de',
        '1027b085d1cd76a179f8bdcac99e27a7a915248d2249ea47aa8daaf97533a537',
        'd5de267a9ca034b9e4646277aead4c6b166cc4c0be38199a7f33b72c7c9983b3',
        'ff2c06606ae297195e7f3fb80409fe8c981c9ad1de21c5b03db1f5b61f0043d3',
        'f3933a0f68dc317a2320006e516e4e1b2054d0520f2be777f2107d93f333c821',
        'f9f8d7c16be84fa4af3e3fd44b4aec07428fea2448b7e22cd83f2501fc182f73',
        '2f36bd77f2f29d51fc21da62eb09e89497a3e82cfb820563e260a0dd034dd4cd',
        'fdbbab5c1cf7f3b9278c9249850fe6d2bf462f952b4109ead658d7a0136b9fab',
        'd31955473b5a16834300a4d5e7fa94c2c2dede3cdb010f149928d54f1d6f08ad',
        '7baad2b78e92c22da65204fbb559cb20d2e02d668fb2b2ca250d2e25bc865bcc',
        '96c067f8b4ed29b1ad9b92cb38d8375b336973b10f3be300c0bae37901e20709',
        '3d3fbf65b8afb2ecfcfbf612567d4da76be8e00da38ae9185c60135ccb9602c8',
        '09b9b4640d003dba4a86d976a97f3671686f78ab6b1ce91e822824c42f7fa771',
        '0038fbbc52e483b0b2e0c4d6c7181913bca9f1c2c732df7c166d0ff11d859ffe',
        'c0ff21feb12b3eeb4370dd830e6b1fc8f24583fa808a42e95d03127f71a03598',
        '1e721f05a1b8e396997ddfa7c08f92f46181a59599c4e5ebda92d684d6c63e4e',
      ],
    });
    console.log('fetchRawTx', r);
  }, []);
  return <Button onPress={fetchRawTx}>Fetch raw tx</Button>;
}

const SendGallery = () => (
  <Layout
    filePath={__CURRENT_FILE_PATH__}
    componentName="Send"
    elements={[
      {
        title: 'Default',
        element: (
          <AccountSelectorProviderMirror
            config={{
              sceneName: EAccountSelectorSceneName.home,
            }}
            enabledNum={[0]}
          >
            <Stack>
              <ExternalAccountSign />
              <SendTestButton />
              <Button
                onPress={() => {
                  void backgroundApiProxy.serviceV4Migration.demoShowDataOfV4Migration();
                }}
              >
                Test v4 migration
              </Button>
              <Button
                onPress={async () => {
                  const r =
                    await backgroundApiProxy.serviceV4Migration.prepareMigration(
                      {
                        isAutoStartOnMount: true,
                      },
                    );
                  console.log(r);
                }}
              >
                prepareMigration
              </Button>
              <Button
                onPress={async () => {
                  const r =
                    await backgroundApiProxy.serviceV4Migration.buildV4WalletsForBackupSectionData();
                  console.log(r);
                }}
              >
                getV4WalletsForBackup
              </Button>
              <Button
                onPress={async () => {
                  const r =
                    await backgroundApiProxy.serviceV4Migration.revealV4HdMnemonic(
                      {
                        hdWalletId: 'hd-1',
                      },
                    );
                  console.log(r);
                }}
              >
                revealV4Mnemonic
              </Button>
              <Button
                onPress={async () => {
                  const logResult = (r: IV4MigrationImportedCredential) => {
                    console.log('ExportSecretKeys >>>> ', {
                      privateKey: r.exportedPrivateKey,
                      address: r.account.address,
                    });
                    console.log(r);
                  };
                  const accountIds: string[] = [
                    'imported--60--022af46276751943e1447e903076e93d7e47729708d87ac5e2854719a5f1e2ca17',
                    'imported--0--xpub6BthKLEjBd54zLpbuefhkyYTSpfNmLXCHTH2qx68Pk7xK3q15GeEz4y1TXEhwCunAyVFKZhcmjHXGVGsy2e2uf9Dvu3aFuHQpvvg8eBSwRs--',
                    "imported--0--xpub6C4EqF8f7TpvWGTuHhsVdVCfZZr8QtGLQ5nQVcTCy5qMDZXoystKHB8VvZqahU1q446H9KH2DrLzoRERWUyaUSYcSqMgfcxaFMY1eNnJnW5--86'/",
                    'imported--0--ypub6X5Uoa9945krfbaNKhHdvtBaGoU3gHZ4mxgSCHnXoEN6gtFsAR1yiCWC5J2PJ9CdWyWcjvY3Kh4spVgHLv5dhF3K2JM79Ho5h67SGTMWvis--',
                    'imported--0--zpub6qyshJi7r5Au27dvK7UTxcNVVc8NoQFZ96dPF8C33h34oW1zUFMSfswwTYLvuwumy1jq9Cj5spfwBWSt7r5mTEaRTHuaPjEkG9Pqd6iZTf3--',
                  ];
                  for (const accountId of accountIds) {
                    try {
                      const r =
                        await backgroundApiProxy.serviceV4Migration.revealV4ImportedPrivateKey(
                          {
                            password: '11111111',
                            accountId,
                          },
                        );
                      logResult(r);
                    } catch (error) {
                      //
                    }
                  }
                }}
              >
                revealV4ImportedPrivateKey
              </Button>
              <Button
                onPress={async () => {
                  const r =
                    await backgroundApiProxy.serviceV4Migration.startV4MigrationFlow();
                  console.log(r);
                }}
              >
                startV4MigrationFlow
              </Button>
            </Stack>
            <BatchFetchRawTx />
          </AccountSelectorProviderMirror>
        ),
      },
    ]}
  />
);

export default SendGallery;
