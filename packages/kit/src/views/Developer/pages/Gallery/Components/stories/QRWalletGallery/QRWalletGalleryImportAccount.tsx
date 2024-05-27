import { useState } from 'react';

import { publicToAddress, toChecksumAddress } from '@ethereumjs/util';
import HDKey from 'hdkey';

import { Button, Stack, TextArea } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import useScanQrCode from '@onekeyhq/kit/src/views/ScanQrCode/hooks/useScanQrCode';
import type { IAnimationValue } from '@onekeyhq/kit-bg/src/services/ServiceScanQRCode/utils/parseQRCode/type';
import type { IAirGapAccount } from '@onekeyhq/qr-wallet-sdk';
import {
  AirGapCryptoHDKeyEvm,
  airGapUrUtils,
  getAirGapSdk,
} from '@onekeyhq/qr-wallet-sdk';

import { KEYRING_ACCOUNT, KEYRING_MODE } from './types';

function HdKeyImport() {
  const defaultData =
    'UR:CRYPTO-HDKEY/PTAOWKAXHDCLAXLECXLTSNHYJZJPBBFYRYIHKPQZVTNEBBEHJTKTWDMYHLPFHLZTWMDADSNDGMSWESAAHDCXDICEBETLROYKCABAAAFMSWJZEMCHTNPTKNYNVYHPHFETHDSTKORHYTTAGAATHSRHAHTAADEHOEADCSFNAOAEAMTAADDYOTADLNCSDWYKCSFNYKAEYKAOCYSGWSYLBSAXAXATTAADDYOEADLRAEWKLAWKAXAEAYCYDKURZERDASIYGWJTIHGRIHKKBKJOHSIAIAJLKPJTJYDMJKJYHSJTIEHSJPIEHFKIDSWZ';

  const [data, setData] = useState(defaultData);
  // const [data, setData] = useState('');

  // eslint-disable-next-line spellcheck/spell-checker
  /*
  "0x4B7115aD9623A528f1845eaf85D166dE1E869BFB"
  
UR:CRYPTO-HDKEY/OTADYKAXHDCLAEVSWFDMJPFSWPWKAHCYWSPSMNDWMUSOSKPRBBEHETCHSNPFCYBBMWRHCHSPFXJEECAAHDCXLTFSZMLYRTDLGMHFCNZCCTVWCMKBPSFTGONBGAUEFSEHGRQZDMVODIZMWEEMTLAYBAKIYLAT


UR:CRYPTO-HDKEY/1-2/LPADAOCSGECYBAKIYLATHDDAOTADYKAXHDCLAEVSWFDMJPFSWPWKAHCYWSPSMNDWMUSOSKPRBBEHETCHSNPFCYBBMWRHCHSPFXFPKSLPID

UR:CRYPTO-HDKEY/2-2/LPAOAOCSGECYBAKIYLATHDDAJEECAAHDCXLTFSZMLYRTDLGMHFCNZCCTVWCMKBPSFTGONBGAUEFSEHGRQZDMVODIZMWEEMTLAYWLBYRLPR

  */
  const {
    start: startScan,
    // close,
  } = useScanQrCode();

  const navigation = useAppNavigation();
  return (
    <>
      <Button
        onPress={async () => {
          const startAnimatedScan: () => Promise<
            string | undefined
          > = async () => {
            const scanResult = await startScan({
              autoHandleResult: false,
              mask: true,
            });
            const animatedData = scanResult.data as IAnimationValue;
            const fullData = animatedData.fullData;
            console.log({
              animatedData,
            });
            return fullData;
          };

          const rawData = await startAnimatedScan();
          setData(rawData || '');
          // TODO  close scan modal
        }}
      >
        Scan
      </Button>
      <TextArea value={data} onChangeText={setData} placeholder="qrcode data" />
      <Button
        onPress={async () => {
          const urDecoder = airGapUrUtils.createAnimatedURDecoder();
          const dataList = data
            .split('\n')
            .map((item) => item.trim())
            .filter(Boolean);

          // scan Animated qr code
          for (const d of dataList) {
            urDecoder.receivePart?.(d);
          }

          const ur = await urDecoder.promiseResultUR;

          // eslint-disable-next-line spellcheck/spell-checker
          /*
            if (ur.type === 'crypto-hdkey') {
                return await submitQRHardwareCryptoHDKey(ur.cbor.toString('hex'));
              } else if (ur.type === 'crypto-account') {
                return await submitQRHardwareCryptoAccount(ur.cbor.toString('hex'));
              }
          */
          const cborHex = ur.cbor.toString('hex');

          const dataItem = airGapUrUtils.decodeUrToDataItem(cborHex);

          console.log(ur.type, ur.cbor, cborHex, dataItem);
          if (ur.type === 'crypto-hdkey') {
            console.log('crypto-hdkey cbor', cborHex);

            const cryptoHDKey = AirGapCryptoHDKeyEvm.fromCBOR(
              Buffer.from(cborHex, 'hex'),
            );

            //
            // "m/44'/60'/0'"
            const hdPath = `m/${cryptoHDKey.getOrigin()?.getPath()}`;
            const xfp = cryptoHDKey
              .getOrigin()
              ?.getSourceFingerprint()
              ?.toString('hex');
            const childrenPathWildcard = cryptoHDKey.getChildren()?.getPath();
            const childrenPathWildcardWithDefault =
              childrenPathWildcard || '0/*';
            const name = cryptoHDKey.getName(); // walletName: "OneKey"
            const note = cryptoHDKey.getNote(); //

            let keyringAccount = KEYRING_ACCOUNT.standard;
            const keyringMode = KEYRING_MODE.hd;

            // __readCryptoHDKey()
            if (cryptoHDKey.getNote() === KEYRING_ACCOUNT.standard) {
              keyringAccount = KEYRING_ACCOUNT.standard;
            } else if (
              cryptoHDKey.getNote() === KEYRING_ACCOUNT.ledger_legacy
            ) {
              keyringAccount = KEYRING_ACCOUNT.ledger_legacy;
            }

            // only available to __readCryptoAccount()
            if (cryptoHDKey.getNote() === KEYRING_ACCOUNT.ledger_live) {
              keyringAccount = KEYRING_ACCOUNT.ledger_live;
            }

            if (!xfp) {
              //   throw new Error(
              //     'KeystoneError#invalid_data: invalid crypto-hdkey, cannot get source fingerprint',
              //   );
            }
            const xpub = cryptoHDKey.getBip32Key();

            const airGapAccount: IAirGapAccount = {
              chain: 'ETH',
              path: hdPath,
              publicKey: '',
              name: 'OneKeyPro',
              chainCode: '1111',
              extendedPublicKey: xpub,
              xfp,
              note,
              extra: { okx: { chainId: 1 } },
            };
            console.log('crypto-hdkey xpub', {
              airGapAccount,
              dataList,
              hdPath,
              xfp,
              childrenPathWildcardWithDefault,
              childrenPathWildcard,
              name,
              note,
              keyringAccount,
              xpub,
            });

            for (let i = 0; i < 3; i += 1) {
              // __readCryptoHDKey method
              if (keyringMode === KEYRING_MODE.hd) {
                // https://github.com/KeystoneHQ/keystone-airgaped-base/blob/master/packages/base-eth-keyring/src/BaseKeyring.ts#L527
                const hdk = HDKey.fromExtendedKey(xpub);
                const childrenPath = childrenPathWildcardWithDefault
                  .replace('*', String(i)) // replace first * with i
                  .replace(/\*/g, '0'); // replace other * with 0
                const basePath = 'm';
                const derivePath = `${basePath}/${childrenPath}`;
                const dkey = hdk.derive(derivePath); // "m/0/0" "m/0/1" "m/0/2"

                const fullPath = `${hdPath}/${childrenPath}`;

                let addr = `0x${publicToAddress(dkey.publicKey, true).toString(
                  'hex',
                )}`;
                addr = toChecksumAddress(addr);

                console.log({
                  addr,
                  hdPath,
                  childrenPath,
                  fullPath,
                  childrenPathWildcard,
                  childrenPathWildcardWithDefault,
                  basePath,
                  derivePath,
                });
              }
              // __readCryptoAccount method
              else {
                // this.paths[toChecksumAddress(address)] = path;
                // protected paths: Record<string, string>;
                const paths: Record<string, string> = {};
                const result = Object.keys(paths)[i];
                if (result) {
                  const address = toChecksumAddress(result);
                  console.log(address);
                } else {
                  throw new Error(
                    `KeystoneError#pubkey_account.no_expected_account`,
                  );
                }
              }
            }
          }

          const sdk = getAirGapSdk();
          // return childrenPath "0/*" of accountBySdk
          const accountBySdk = sdk.parseHDKey(ur);
          // generateAddress by index
          const addressBySdk = sdk.eth.generateAddressFromXpub({
            xpub: accountBySdk.extendedPublicKey || '',
            // `m/0'/0`, // Could not derive hardened child key
            derivePath: `m/0/0`, // basePath 'm' + childrenPath "0/*"
          });
          console.log({
            accountBySdk,
            addressBySdk,
          });
        }}
      >
        crypto-hdkey (EVM)
      </Button>
    </>
  );
}

function HdKeyImportMultiAccounts() {
  /*
UR:CRYPTO-MULTI-ACCOUNTS/65-9/LPCSFPASCFAMFLCYDACPJYDNHDQDTAADDYOTADLECSDWYKCSFNYKAHYKAEWKAEWKAOCYHHNNCPLGAXAXAYCYRKDLHEJTASISGRIHKKJKJYJLJTIHBKJKHSIAIAJLKPJTJYDMJZIHIEIOIHJPHEJZINKOIHTAADDLOLAOWKAXHDCLAOWTWTSABTBYCXZCBTRHFEENNDNTGHJEHYADRPBGSAKTSNTAKPHDUOATZSGMGTGAPSAMTAADDYOTADLECSDWYKCSFNYKAMYKAEWKAEWKAOCYHHNNCPLGAXAXAYCYJEZEMDAXASISGRIHKKJKJYJLJTIHBKJKHSIAIAJLKPJTJYDMJZIHIEIOIHJPHEJZINKOIHTAADDLOLAOWKAXHDCLAXHKEEPLES
*/
  // const sdk = new KeystoneSDK();
  // const accountBySdk = sdk.parseMultiAccounts(ur);
  return <Button>crypto-multi-accounts (TODO)</Button>;
}

export function QRWalletGalleryImportAccount() {
  return (
    <Stack space="$2">
      <HdKeyImport />
      <HdKeyImportMultiAccounts />
    </Stack>
  );
}
