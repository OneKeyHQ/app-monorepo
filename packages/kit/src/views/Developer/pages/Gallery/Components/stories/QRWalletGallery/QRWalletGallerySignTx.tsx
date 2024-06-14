import Common, { Chain, Hardfork } from '@ethereumjs/common';
import {
  FeeMarketEIP1559Transaction,
  Transaction,
  TransactionFactory,
} from '@ethereumjs/tx';
import { URDecoder, UREncoder } from '@ngraveio/bc-ur';
import { networks as BitcoinJsNetworks, Psbt } from 'bitcoinjs-lib';
import { isEqual } from 'lodash';

import { Button, Dialog, Input, QRCode } from '@onekeyhq/components';
import {
  buildPsbt,
  decodedPsbt,
} from '@onekeyhq/core/src/chains/btc/sdkBtc/providerUtils';
import type { IEncodedTxBtc } from '@onekeyhq/core/src/chains/btc/types';
import { packUnsignedTxForSignEvm } from '@onekeyhq/core/src/chains/evm/sdkEvm';
import type { IEncodedTxEvm } from '@onekeyhq/core/src/chains/evm/types';
import { EAddressEncodings } from '@onekeyhq/core/src/types';
import useScanQrCode from '@onekeyhq/kit/src/views/ScanQrCode/hooks/useScanQrCode';
import {
  AirGapEthSignRequestEvm,
  AirGapRegistryTypesEvm,
  EAirGapDataTypeEvm,
  EAirGapURType,
  airGapUrUtils,
  getAirGapSdk,
} from '@onekeyhq/qr-wallet-sdk';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';
import hexUtils from '@onekeyhq/shared/src/utils/hexUtils';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';

import type { FeeMarketEIP1559TxData } from '@ethereumjs/tx';

const txShared = {
  to: '0x02bA7fd1b0aCdd0E4F8c6DA7C4bA8Fd7F963bA50',
  gasLimit: '0x8a10',
  maxPriorityFeePerGas: '0x128ed',
  maxFeePerGas: '0x1d1ac',
  data: '0x',
  nonce: '0x1',
  value: '0x12a05f200',
  chainId: '0x1',
  // https://github.com/MetaMask/core/blob/main/packages/transaction-controller/src/types.ts#L860
  type: '0x2', // legacy = '0x0',  accessList = '0x1',  feeMarket = '0x2',
};
const encodedTx: IEncodedTxEvm = {
  from: '0x02bA7fd1b0aCdd0E4F8c6DA7C4bA8Fd7F963bA50',
  ...txShared,
};
const txParams: FeeMarketEIP1559TxData = {
  ...txShared,
};

export function QRWalletGallerySignTx() {
  const { start: startScan } = useScanQrCode();

  return (
    <>
      <Button
        onPress={() => {
          const { digest, serializedTx, serializedTxWithout0x } =
            packUnsignedTxForSignEvm({
              encodedTx,
            });

          const common = new Common({
            chain: Chain.Mainnet,
            hardfork: Hardfork.London,
          });
          const legacyTx = Transaction.fromTxData(txParams, { common });
          const eip1559Tx = FeeMarketEIP1559Transaction.fromTxData(txParams, {
            common,
          });
          const unsignedMessage = Buffer.from(
            eip1559Tx.getMessageToSign(false),
          ).toString('hex');

          const eip1559Tx2 = FeeMarketEIP1559Transaction.fromTxData(txParams);
          const unsignedMessage2 = Buffer.from(
            eip1559Tx2.getMessageToSign(false),
          ).toString('hex');

          // EthSignRequest.constructETHRequest({
          const ethSignRequest = {
            requestId: generateUUID(),
            signData: serializedTxWithout0x,
            // dataType: KeystoneEthereumSDK.DataType.transaction, // legacy tx
            dataType: EAirGapDataTypeEvm.typedTransaction, // EIP-1559 tx
            path: "m/44'/60'/0'/0/0",
            // xfp: 'caeff70f',
            xfp: 'aaaff70f', // master fingerprint, should save to wallet
            chainId: 1,
            origin: 'MetaMask',
          };
          const sdk = getAirGapSdk();
          const ethSignRequestType = AirGapRegistryTypesEvm.ETH_SIGN_REQUEST;
          const ethSignResponseType = EAirGapURType.EthSignature;
          const ethSignResponseType2 = AirGapRegistryTypesEvm.ETH_SIGNATURE;
          const urData = sdk.eth.generateSignRequest(ethSignRequest);
          const qrUri = UREncoder.encodeSinglePart(urData).toUpperCase();

          //
          const animatedEncoder = new UREncoder(urData, 200, 0);
          const part = animatedEncoder.nextPart(); // animatedQrPart

          console.log({
            ur: {
              type: urData.type,
              cbor: urData.cbor.toString('hex'),
              uri: qrUri,
            },
            unsignedMessage,
            unsignedMessage2,
            serializedTx,
            serializedTxWithout0x,
            digest,
          });
          const qrUri2 = `UR:ETH-SIGN-REQUEST/OLADTPDAGDVSASKKYLZTPYFWWNRFCFDYLFLBCACYDRAOHDDTAOVDETDSLRPRTIHYAELRPRTIHYAELFGMAYMWAORDLBTTPFPSUTBAGWLKJNOSSSRDMYTSYTIARDGDLALARTAXAAAACSETAHTAADDYOEADLECSDWYKCSFNYKAEYKAEWKAEWKAOCYSGWSYLBSAMGHAORDLBTTPFPSUTBAGWLKJNOSSSRDMYTSYTIARDGDOTCPLFMK`;
          const qrUri3 = `UR:ETH-SIGN-REQUEST/ONADTPDAGDJSCLGYFYYLIMFDLEQDVLCAYKCAEHKPPSAOHDCTFEKSHSJNJOJZIHCXHNJOIHJPJKJLJTHSJZHEJKINIOJTHNCXJNIHJKJKHSIOIHAXAXAHTAADDYOEADLECSDWYKCSFNYKAEYKAEWKAOWKAOCYSGWSYLBSAMGHGHUEDPFWTOECTKIMDEAHWMUYHPKKGRIDGAAHNYKGHFONOXBE`;
          const decodedUr = URDecoder.decode(qrUri);
          const decodedSignRequest = AirGapEthSignRequestEvm.fromCBOR(
            decodedUr.cbor,
          );
          console.log({
            qrUri,
            decodedUr,
            decodedSignRequest,
            decodedSignRequestInfo: {
              xfp: decodedSignRequest.getSourceFingerprint().toString('hex'),
              path: decodedSignRequest.getDerivationPath(),
            },
          });
          Dialog.show({
            title: qrUri,
            renderContent: <QRCode size={300} value={qrUri} drawType="line" />,
          });
        }}
      >
        eth-sign-request (EVM signTx EIP-1559 )
      </Button>
      <Button>eth-sign-request (EVM signTx legacy TODO)</Button>
      <Button>eth-sign-request (EVM personal_sign TODO)</Button>
      <Button>eth-sign-request (EVM signTypedData_v1 v3 v4 TODO)</Button>

      <Button
        onPress={async () => {
          const sdk = getAirGapSdk();
          const tx = {
            'inputs': [
              {
                'address':
                  'bc1pw8tt6lrnkwva9l3twexqzl857pgga9uq570nmgemvhfr7c5hhlkq33puph',
                'path': "m/86'/0'/0'/0/0",
                'vout': 1,
                'txid':
                  '606b35ac8b72a7e04faaabf28a31e6df7526f8316ecddc9a66997c9cfbd7914c',
                'value': '84744',
              },
            ],
            'outputs': [
              {
                'address':
                  'bc1pw8tt6lrnkwva9l3twexqzl857pgga9uq570nmgemvhfr7c5hhlkq33puph',
                'value': '34000',
              },
              {
                'address':
                  'bc1pw8tt6lrnkwva9l3twexqzl857pgga9uq570nmgemvhfr7c5hhlkq33puph',
                'value': '45000',
                'payload': { 'isCharge': true, 'bip44Path': "m/86'/0'/0'/0/0" },
              },
            ],
            'fee': '5744',
          };
          const psbt2 = await buildPsbt({
            network: BitcoinJsNetworks.bitcoin,
            unsignedTx: { encodedTx: tx as IEncodedTxBtc },
            btcExtraInfo: {
              inputAddressesEncodings: [
                EAddressEncodings.P2TR,
                EAddressEncodings.P2TR,
              ],
              pathToAddresses: {},
              addressToPath: {},
            },
            buildInputMixinInfo: () =>
              Promise.resolve({
                pubkey: bufferUtils.toBuffer(
                  '0286211e179c218d3dfd345271f92fcaa95d2d7491ee3d44db2da016f17953b71b',
                  'hex',
                ),
                bip32Derivation: [
                  {
                    leafHashes: [],
                    pubkey: bufferUtils.toBuffer(
                      '0286211e179c218d3dfd345271f92fcaa95d2d7491ee3d44db2da016f17953b71b',
                      'hex',
                    ),
                    masterFingerprint: bufferUtils.toBuffer('fc885a5e', 'hex'),
                    path: "m/86'/0'/0'/0/0",
                  },
                ],
              }),
          });
          const psbtHex2 = psbt2.toHex();
          const txDecoded2 = decodedPsbt({
            psbt: psbt2,
            psbtNetwork: BitcoinJsNetworks.bitcoin,
          });
          const psbtHex1 =
            '70736274ff01008902000000014c91d7fb9c7c99669adccd6e31f82675dfe6318af2abaa4fe0a7728bac356b600100000000ffffffff02b80b00000000000022512071d6bd7c73b399d2fe2b764c017cf4f0508e9780a79f3da33b65d23f6297bfec202a01000000000022512071d6bd7c73b399d2fe2b764c017cf4f0508e9780a79f3da33b65d23f6297bfec000000000001012b084b01000000000022512071d6bd7c73b399d2fe2b764c017cf4f0508e9780a79f3da33b65d23f6297bfec01172086211e179c218d3dfd345271f92fcaa95d2d7491ee3d44db2da016f17953b71b000000';
          const psbt = Psbt.fromHex(psbtHex1, {
            network: BitcoinJsNetworks.bitcoin,
          });
          const txDecoded1 = decodedPsbt({
            psbt,
            psbtNetwork: BitcoinJsNetworks.bitcoin,
          });
          const ur = sdk.btc.generatePSBT(psbt2.toBuffer());

          console.log({
            psbt,
            psbt2,
            tx,
            psbtHexEquals: psbtHex1 === psbtHex2,
            psbtHex1,
            txDecoded1,
            psbtHex2,
            txDecoded2,
            txDecodedEquals: isEqual(txDecoded1, txDecoded2),
            singleUri: airGapUrUtils.urToQrcode(ur).single,
          });

          Dialog.show({
            title: 'PSBT QRCode',
            renderContent: (
              <QRCode
                size={300}
                valueUr={airGapUrUtils.urToJson({ ur })}
                drawType="animated"
              />
            ),
          });
        }}
      >
        btc signPSBT
      </Button>

      <Input />
      <Button
        onPress={async () => {
          /*
            UR:ETH-SIGNATURE/OTADTPDAGDTOFNGRPKSBMNFXJERSCMGLZOSOPMWEFRAOHDFPOLDEOSHEEOGOONVDIHNBUOTDLRGLLRDAFGADSKHYADZMLPCWSEMNKOJZJTDWDPWPKGSGHDVSVLJLCAEMDTSSKGCPRLSFATMSEHKKGYWDDKEOIMCNMNBSJOJLIEAATLWPAEAXIYGWJTIHGRIHKKLGENRKKT
            */
          const sdk = getAirGapSdk();
          const urDecoder = airGapUrUtils.createAnimatedURDecoder();

          //   const scanResult = await startScan(false);
          //   urDecoder?.receivePart?.(scanResult.raw || '');
          //   console.log(scanResult);

          urDecoder?.receivePart?.(
            'UR:ETH-SIGNATURE/OTADTPDAGDTOFNGRPKSBMNFXJERSCMGLZOSOPMWEFRAOHDFPOLDEOSHEEOGOONVDIHNBUOTDLRGLLRDAFGADSKHYADZMLPCWSEMNKOJZJTDWDPWPKGSGHDVSVLJLCAEMDTSSKGCPRLSFATMSEHKKGYWDDKEOIMCNMNBSJOJLIEAATLWPAEAXIYGWJTIHGRIHKKLGENRKKT',
          );

          const ur = await urDecoder?.promiseResultUR;
          const sig = sdk.eth.parseSignature(ur);

          const { signature } = sig;
          const r = signature.slice(0, 64);
          const s = signature.slice(64, 64 + 64);
          const v = signature.slice(64 + 64);

          const typedTx = TransactionFactory.fromTxData({
            ...txShared,
            type: txShared.type,
            r: hexUtils.addHexPrefix(r),
            s: hexUtils.addHexPrefix(s),
            v: hexUtils.addHexPrefix(v),
          });
          const txid = hexUtils.addHexPrefix(typedTx.hash().toString('hex'));
          const rawTx = hexUtils.addHexPrefix(
            typedTx.serialize().toString('hex'),
          );
          console.log({ sig, ur, txid, rawTx });
        }}
      >
        eth-signature (EVM scan sign result)
      </Button>
    </>
  );
}
