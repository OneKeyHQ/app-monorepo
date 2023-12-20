/* eslint-disable @typescript-eslint/no-unused-vars */
import { CKDPriv, CKDPub, revealableSeedFromMnemonic, verify } from './index';

import BigNumber from 'bignumber.js';
import elliptic from 'elliptic';

import {
  IncorrectPassword,
  InvalidMnemonic,
} from '@onekeyhq/shared/src/errors';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';

import { decrypt, encrypt } from './encryptors/aes256';
import { sha256 } from './hash';

import type { ICurveName } from '../types';

// yarn jest packages/core/src/secret/index.test.ts
const halfNs: Record<string, BigNumber> = {
  // eslint-disable-next-line new-cap
  secp256k1: new BigNumber(new elliptic.ec('secp256k1').nh.toString()),
  // eslint-disable-next-line new-cap
  nistp256: new BigNumber(new elliptic.ec('p256').nh.toString()),
};

function isSignatureCanonical(curve: ICurveName, signature: Buffer): boolean {
  const halfN = halfNs[curve];
  if (typeof halfN === 'undefined') {
    // Not ecdsa.
    return true;
  }
  const s = new BigNumber(`0x${signature.slice(32, 64).toString('hex')}`);
  return s.lte(halfN);
}

const bip32TestVectors = [
  // Test vectors from SLIP-0010.
  // https://github.com/satoshilabs/slips/blob/master/slip-0010.md
  {
    // Test vector 1 for secp256k1
    curveName: 'secp256k1',
    seed: '000102030405060708090a0b0c0d0e0f',
    path: 'm/0h/1/2h/2/1000000000',
    keys: [
      {
        chainCode:
          '873dff81c02f525623fd1fe5167eac3a55a049de3d314bb42ee227ffed37d508',
        private:
          'e8f32e723decf4051aefac8e2c93c9c5b214313817cdb01a1494b917c8436b35',
        public:
          '0339a36013301597daef41fbe593a02cc513d0b55527ec2df1050e2e8ff49c85c2',
      },
      {
        chainCode:
          '47fdacbd0f1097043b78c63c20c34ef4ed9a111d980047ad16282c7ae6236141',
        private:
          'edb2e14f9ee77d26dd93b4ecede8d16ed408ce149b6cd80b0715a2d911a0afea',
        public:
          '035a784662a4a20a65bf6aab9ae98a6c068a81c52e4b032c0fb5400c706cfccc56',
      },
      {
        chainCode:
          '2a7857631386ba23dacac34180dd1983734e444fdbf774041578e9b6adb37c19',
        private:
          '3c6cb8d0f6a264c91ea8b5030fadaa8e538b020f0a387421a12de9319dc93368',
        public:
          '03501e454bf00751f24b1b489aa925215d66af2234e3891c3b21a52bedb3cd711c',
      },
      {
        chainCode:
          '04466b9cc8e161e966409ca52986c584f07e9dc81f735db683c3ff6ec7b1503f',
        private:
          'cbce0d719ecf7431d88e6a89fa1483e02e35092af60c042b1df2ff59fa424dca',
        public:
          '0357bfe1e341d01c69fe5654309956cbea516822fba8a601743a012a7896ee8dc2',
      },
      {
        chainCode:
          'cfb71883f01676f587d023cc53a35bc7f88f724b1f8c2892ac1275ac822a3edd',
        private:
          '0f479245fb19a38a1954c5c7c0ebab2f9bdfd96a17563ef28a6a4b1a2a764ef4',
        public:
          '02e8445082a72f29b75ca48748a914df60622a609cacfce8ed0e35804560741d29',
      },
      {
        chainCode:
          'c783e67b921d2beb8f6b389cc646d7263b4145701dadd2161548a8b078e65e9e',
        private:
          '471b76e389e528d6de6d816857e012c5455051cad6660850e58372a6c3e6e7c8',
        public:
          '022a471424da5e657499d1ff51cb43c47481a03b1e77f951fe64cec9f5a48f7011',
      },
    ],
  },
  {
    // Test vector 1 for nist256p1
    curveName: 'nistp256',
    seed: '000102030405060708090a0b0c0d0e0f',
    path: 'm/0h/1/2h/2/1000000000',
    keys: [
      {
        chainCode:
          'beeb672fe4621673f722f38529c07392fecaa61015c80c34f29ce8b41b3cb6ea',
        private:
          '612091aaa12e22dd2abef664f8a01a82cae99ad7441b7ef8110424915c268bc2',
        public:
          '0266874dc6ade47b3ecd096745ca09bcd29638dd52c2c12117b11ed3e458cfa9e8',
      },
      {
        chainCode:
          '3460cea53e6a6bb5fb391eeef3237ffd8724bf0a40e94943c98b83825342ee11',
        private:
          '6939694369114c67917a182c59ddb8cafc3004e63ca5d3b84403ba8613debc0c',
        public:
          '0384610f5ecffe8fda089363a41f56a5c7ffc1d81b59a612d0d649b2d22355590c',
      },
      {
        chainCode:
          '4187afff1aafa8445010097fb99d23aee9f599450c7bd140b6826ac22ba21d0c',
        private:
          '284e9d38d07d21e4e281b645089a94f4cf5a5a81369acf151a1c3a57f18b2129',
        public:
          '03526c63f8d0b4bbbf9c80df553fe66742df4676b241dabefdef67733e070f6844',
      },
      {
        chainCode:
          '98c7514f562e64e74170cc3cf304ee1ce54d6b6da4f880f313e8204c2a185318',
        private:
          '694596e8a54f252c960eb771a3c41e7e32496d03b954aeb90f61635b8e092aa7',
        public:
          '0359cf160040778a4b14c5f4d7b76e327ccc8c4a6086dd9451b7482b5a4972dda0',
      },
      {
        chainCode:
          'ba96f776a5c3907d7fd48bde5620ee374d4acfd540378476019eab70790c63a0',
        private:
          '5996c37fd3dd2679039b23ed6f70b506c6b56b3cb5e424681fb0fa64caf82aaa',
        public:
          '029f871f4cb9e1c97f9f4de9ccd0d4a2f2a171110c61178f84430062230833ff20',
      },
      {
        chainCode:
          'b9b7b82d326bb9cb5b5b121066feea4eb93d5241103c9e7a18aad40f1dde8059',
        private:
          '21c4f269ef0a5fd1badf47eeacebeeaa3de22eb8e5b0adcd0f27dd99d34d0119',
        public:
          '02216cd26d31147f72427a453c443ed2cde8a1e53c9cc44e5ddf739725413fe3f4',
      },
    ],
  },
  {
    // Test vector 1 for ed25519
    curveName: 'ed25519',
    seed: '000102030405060708090a0b0c0d0e0f',
    path: 'm/0h/1h/2h/2h/1000000000h',
    keys: [
      {
        chainCode:
          '90046a93de5380a72b5e45010748567d5ea02bbf6522f979e05c0d8d8ca9fffb',
        private:
          '2b4be7f19ee27bbf30c667b642d5f4aa69fd169872f8fc3059c08ebae2eb19e7',
        public:
          '00a4b2856bfec510abab89753fac1ac0e1112364e7d250545963f135f2a33188ed',
      },
      {
        chainCode:
          '8b59aa11380b624e81507a27fedda59fea6d0b779a778918a2fd3590e16e9c69',
        private:
          '68e0fe46dfb67e368c75379acec591dad19df3cde26e63b93a8e704f1dade7a3',
        public:
          '008c8a13df77a28f3445213a0f432fde644acaa215fc72dcdf300d5efaa85d350c',
      },
      {
        chainCode:
          'a320425f77d1b5c2505a6b1b27382b37368ee640e3557c315416801243552f14',
        private:
          'b1d0bad404bf35da785a64ca1ac54b2617211d2777696fbffaf208f746ae84f2',
        public:
          '001932a5270f335bed617d5b935c80aedb1a35bd9fc1e31acafd5372c30f5c1187',
      },
      {
        chainCode:
          '2e69929e00b5ab250f49c3fb1c12f252de4fed2c1db88387094a0f8c4c9ccd6c',
        private:
          '92a5b23c0b8a99e37d07df3fb9966917f5d06e02ddbd909c7e184371463e9fc9',
        public:
          '00ae98736566d30ed0e9d2f4486a64bc95740d89c7db33f52121f8ea8f76ff0fc1',
      },
      {
        chainCode:
          '8f6d87f93d750e0efccda017d662a1b31a266e4a6f5993b15f5c1f07f74dd5cc',
        private:
          '30d1dc7e5fc04c31219ab25a27ae00b50f6fd66622f6e9c913253d6511d1e662',
        public:
          '008abae2d66361c879b900d204ad2cc4984fa2aa344dd7ddc46007329ac76c429c',
      },
      {
        chainCode:
          '68789923a0cac2cd5a29172a475fe9e0fb14cd6adb5ad98a3fa70333e7afa230',
        private:
          '8f94d394a8e8fd6b1bc2f3f49f5c47e385281d5c17e65324b0f62483e37e8793',
        public:
          '003c24da049451555d51a7014a37337aa4e12d41e485abccfa46b47dfb2af54b7a',
      },
    ],
  },
  {
    // Test vector 2 for secp256k1
    curveName: 'secp256k1',
    seed: 'fffcf9f6f3f0edeae7e4e1dedbd8d5d2cfccc9c6c3c0bdbab7b4b1aeaba8a5a29f9c999693908d8a8784817e7b7875726f6c696663605d5a5754514e4b484542',
    path: 'm/0/2147483647h/1/2147483646h/2',
    keys: [
      {
        chainCode:
          '60499f801b896d83179a4374aeb7822aaeaceaa0db1f85ee3e904c4defbd9689',
        private:
          '4b03d6fc340455b363f51020ad3ecca4f0850280cf436c70c727923f6db46c3e',
        public:
          '03cbcaa9c98c877a26977d00825c956a238e8dddfbd322cce4f74b0b5bd6ace4a7',
      },
      {
        chainCode:
          'f0909affaa7ee7abe5dd4e100598d4dc53cd709d5a5c2cac40e7412f232f7c9c',
        private:
          'abe74a98f6c7eabee0428f53798f0ab8aa1bd37873999041703c742f15ac7e1e',
        public:
          '02fc9e5af0ac8d9b3cecfe2a888e2117ba3d089d8585886c9c826b6b22a98d12ea',
      },
      {
        chainCode:
          'be17a268474a6bb9c61e1d720cf6215e2a88c5406c4aee7b38547f585c9a37d9',
        private:
          '877c779ad9687164e9c2f4f0f4ff0340814392330693ce95a58fe18fd52e6e93',
        public:
          '03c01e7425647bdefa82b12d9bad5e3e6865bee0502694b94ca58b666abc0a5c3b',
      },
      {
        chainCode:
          'f366f48f1ea9f2d1d3fe958c95ca84ea18e4c4ddb9366c336c927eb246fb38cb',
        private:
          '704addf544a06e5ee4bea37098463c23613da32020d604506da8c0518e1da4b7',
        public:
          '03a7d1d856deb74c508e05031f9895dab54626251b3806e16b4bd12e781a7df5b9',
      },
      {
        chainCode:
          '637807030d55d01f9a0cb3a7839515d796bd07706386a6eddf06cc29a65a0e29',
        private:
          'f1c7c871a54a804afe328b4c83a1c33b8e5ff48f5087273f04efa83b247d6a2d',
        public:
          '02d2b36900396c9282fa14628566582f206a5dd0bcc8d5e892611806cafb0301f0',
      },
      {
        chainCode:
          '9452b549be8cea3ecb7a84bec10dcfd94afe4d129ebfd3b3cb58eedf394ed271',
        private:
          'bb7d39bdb83ecf58f2fd82b6d918341cbef428661ef01ab97c28a4842125ac23',
        public:
          '024d902e1a2fc7a8755ab5b694c575fce742c48d9ff192e63df5193e4c7afe1f9c',
      },
    ],
  },
  {
    // Test vector 2 for nist256p1
    curveName: 'nistp256',
    seed: 'fffcf9f6f3f0edeae7e4e1dedbd8d5d2cfccc9c6c3c0bdbab7b4b1aeaba8a5a29f9c999693908d8a8784817e7b7875726f6c696663605d5a5754514e4b484542',
    path: 'm/0/2147483647h/1/2147483646h/2',
    keys: [
      {
        chainCode:
          '96cd4465a9644e31528eda3592aa35eb39a9527769ce1855beafc1b81055e75d',
        private:
          'eaa31c2e46ca2962227cf21d73a7ef0ce8b31c756897521eb6c7b39796633357',
        public:
          '02c9e16154474b3ed5b38218bb0463e008f89ee03e62d22fdcc8014beab25b48fa',
      },
      {
        chainCode:
          '84e9c258bb8557a40e0d041115b376dd55eda99c0042ce29e81ebe4efed9b86a',
        private:
          'd7d065f63a62624888500cdb4f88b6d59c2927fee9e6d0cdff9cad555884df6e',
        public:
          '039b6df4bece7b6c81e2adfeea4bcf5c8c8a6e40ea7ffa3cf6e8494c61a1fc82cc',
      },
      {
        chainCode:
          'f235b2bc5c04606ca9c30027a84f353acf4e4683edbd11f635d0dcc1cd106ea6',
        private:
          '96d2ec9316746a75e7793684ed01e3d51194d81a42a3276858a5b7376d4b94b9',
        public:
          '02f89c5deb1cae4fedc9905f98ae6cbf6cbab120d8cb85d5bd9a91a72f4c068c76',
      },
      {
        chainCode:
          '7c0b833106235e452eba79d2bdd58d4086e663bc8cc55e9773d2b5eeda313f3b',
        private:
          '974f9096ea6873a915910e82b29d7c338542ccde39d2064d1cc228f371542bbc',
        public:
          '03abe0ad54c97c1d654c1852dfdc32d6d3e487e75fa16f0fd6304b9ceae4220c64',
      },
      {
        chainCode:
          '5794e616eadaf33413aa309318a26ee0fd5163b70466de7a4512fd4b1a5c9e6a',
        private:
          'da29649bbfaff095cd43819eda9a7be74236539a29094cd8336b07ed8d4eff63',
        public:
          '03cb8cb067d248691808cd6b5a5a06b48e34ebac4d965cba33e6dc46fe13d9b933',
      },
      {
        chainCode:
          '3bfb29ee8ac4484f09db09c2079b520ea5616df7820f071a20320366fbe226a7',
        private:
          'bb0a77ba01cc31d77205d51d08bd313b979a71ef4de9b062f8958297e746bd67',
        public:
          '020ee02e18967237cf62672983b253ee62fa4dd431f8243bfeccdf39dbe181387f',
      },
    ],
  },
  {
    // Test vector 2 for ed25519
    curveName: 'ed25519',
    seed: 'fffcf9f6f3f0edeae7e4e1dedbd8d5d2cfccc9c6c3c0bdbab7b4b1aeaba8a5a29f9c999693908d8a8784817e7b7875726f6c696663605d5a5754514e4b484542',
    path: 'm/0h/2147483647h/1h/2147483646h/2h',
    keys: [
      {
        chainCode:
          'ef70a74db9c3a5af931b5fe73ed8e1a53464133654fd55e7a66f8570b8e33c3b',
        private:
          '171cb88b1b3c1db25add599712e36245d75bc65a1a5c9e18d76f9f2b1eab4012',
        public:
          '008fe9693f8fa62a4305a140b9764c5ee01e455963744fe18204b4fb948249308a',
      },
      {
        chainCode:
          '0b78a3226f915c082bf118f83618a618ab6dec793752624cbeb622acb562862d',
        private:
          '1559eb2bbec5790b0c65d8693e4d0875b1747f4970ae8b650486ed7470845635',
        public:
          '0086fab68dcb57aa196c77c5f264f215a112c22a912c10d123b0d03c3c28ef1037',
      },
      {
        chainCode:
          '138f0b2551bcafeca6ff2aa88ba8ed0ed8de070841f0c4ef0165df8181eaad7f',
        private:
          'ea4f5bfe8694d8bb74b7b59404632fd5968b774ed545e810de9c32a4fb4192f4',
        public:
          '005ba3b9ac6e90e83effcd25ac4e58a1365a9e35a3d3ae5eb07b9e4d90bcf7506d',
      },
      {
        chainCode:
          '73bd9fff1cfbde33a1b846c27085f711c0fe2d66fd32e139d3ebc28e5a4a6b90',
        private:
          '3757c7577170179c7868353ada796c839135b3d30554bbb74a4b1e4a5a58505c',
        public:
          '002e66aa57069c86cc18249aecf5cb5a9cebbfd6fadeab056254763874a9352b45',
      },
      {
        chainCode:
          '0902fe8a29f9140480a00ef244bd183e8a13288e4412d8389d140aac1794825a',
        private:
          '5837736c89570de861ebc173b1086da4f505d4adb387c6a1b1342d5e4ac9ec72',
        public:
          '00e33c0f7d81d843c572275f287498e8d408654fdf0d1e065b84e2e6f157aab09b',
      },
      {
        chainCode:
          '5d70af781f3a37b829f0d060924d5e960bdc02e85423494afc0b1a41bbe196d4',
        private:
          '551d333177df541ad876a60ea71f00447931c0a9da16f227c11ea080d7391b8d',
        public:
          '0047150c75db263559a70d5778bf36abbab30fb061ad69f69ece61a72b0cfa4fc0',
      },
    ],
  },
  {
    // Test derivation retry for nist256p1
    curveName: 'nistp256',
    seed: '000102030405060708090a0b0c0d0e0f',
    path: 'm/28578h/33941',
    keys: [
      {
        chainCode:
          'beeb672fe4621673f722f38529c07392fecaa61015c80c34f29ce8b41b3cb6ea',
        private:
          '612091aaa12e22dd2abef664f8a01a82cae99ad7441b7ef8110424915c268bc2',
        public:
          '0266874dc6ade47b3ecd096745ca09bcd29638dd52c2c12117b11ed3e458cfa9e8',
      },
      {
        chainCode:
          'e94c8ebe30c2250a14713212f6449b20f3329105ea15b652ca5bdfc68f6c65c2',
        private:
          '06f0db126f023755d0b8d86d4591718a5210dd8d024e3e14b6159d63f53aa669',
        public:
          '02519b5554a4872e8c9c1c847115363051ec43e93400e030ba3c36b52a3e70a5b7',
      },
      {
        chainCode:
          '9e87fe95031f14736774cd82f25fd885065cb7c358c1edf813c72af535e83071',
        private:
          '092154eed4af83e078ff9b84322015aefe5769e31270f62c3f66c33888335f3a',
        public:
          '0235bfee614c0d5b2cae260000bb1d0d84b270099ad790022c1ae0b2e782efe120',
      },
    ],
  },
  {
    // Test seed retry for nist256p1
    curveName: 'nistp256',
    seed: 'a7305bc8df8d0951f0cb224c0e95d7707cbdf2c6ce7e8d481fec69c7ff5e9446',
    path: 'm',
    keys: [
      {
        chainCode:
          '7762f9729fed06121fd13f326884c82f59aa95c57ac492ce8c9654e60efd130c',
        private:
          '3b8c18469a4634517d6d0b65448f8e6c62091b45540a1743c5846be55d47d88f',
        public:
          '0383619fadcde31063d8c5cb00dbfe1713f3e6fa169d8541a798752a1c1ca0cb20',
      },
    ],
  },
];
const bip39TestVectors = [
  // https://github.com/trezor/python-mnemonic/blob/master/vectors.json
  // The passphrase "TREZOR" is used for all vectors.
  {
    entropy: '00000000000000000000000000000000',
    mnemonic:
      'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
    seed: 'c55257c360c07c72029aebc1b53c05ed0362ada38ead3e3e9efa3708e53495531f09a6987599d18264c1e1c92f2cf141630c7a3c4ab7c81b2f001698e7463b04',
  },
  {
    entropy: '7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f',
    mnemonic:
      'legal winner thank year wave sausage worth useful legal winner thank yellow',
    seed: '2e8905819b8723fe2c1d161860e5ee1830318dbf49a83bd451cfb8440c28bd6fa457fe1296106559a3c80937a1c1069be3a3a5bd381ee6260e8d9739fce1f607',
  },
  {
    entropy: '80808080808080808080808080808080',
    mnemonic:
      'letter advice cage absurd amount doctor acoustic avoid letter advice cage above',
    seed: 'd71de856f81a8acc65e6fc851a38d4d7ec216fd0796d0a6827a3ad6ed5511a30fa280f12eb2e47ed2ac03b5c462a0358d18d69fe4f985ec81778c1b370b652a8',
  },
  {
    entropy: 'ffffffffffffffffffffffffffffffff',
    mnemonic: 'zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo wrong',
    seed: 'ac27495480225222079d7be181583751e86f571027b0497b5b5d11218e0a8a13332572917f0f8e5a589620c6f15b11c61dee327651a14c34e18231052e48c069',
  },
  {
    entropy: '000000000000000000000000000000000000000000000000',
    mnemonic:
      'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon agent',
    seed: '035895f2f481b1b0f01fcf8c289c794660b289981a78f8106447707fdd9666ca06da5a9a565181599b79f53b844d8a71dd9f439c52a3d7b3e8a79c906ac845fa',
  },
  {
    entropy: '7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f',
    mnemonic:
      'legal winner thank year wave sausage worth useful legal winner thank year wave sausage worth useful legal will',
    seed: 'f2b94508732bcbacbcc020faefecfc89feafa6649a5491b8c952cede496c214a0c7b3c392d168748f2d4a612bada0753b52a1c7ac53c1e93abd5c6320b9e95dd',
  },
  {
    entropy: '808080808080808080808080808080808080808080808080',
    mnemonic:
      'letter advice cage absurd amount doctor acoustic avoid letter advice cage absurd amount doctor acoustic avoid letter always',
    seed: '107d7c02a5aa6f38c58083ff74f04c607c2d2c0ecc55501dadd72d025b751bc27fe913ffb796f841c49b1d33b610cf0e91d3aa239027f5e99fe4ce9e5088cd65',
  },
  {
    entropy: 'ffffffffffffffffffffffffffffffffffffffffffffffff',
    mnemonic:
      'zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo when',
    seed: '0cd6e5d827bb62eb8fc1e262254223817fd068a74b5b449cc2f667c3f1f985a76379b43348d952e2265b4cd129090758b3e3c2c49103b5051aac2eaeb890a528',
  },
  {
    entropy: '0000000000000000000000000000000000000000000000000000000000000000',
    mnemonic:
      'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon art',
    seed: 'bda85446c68413707090a52022edd26a1c9462295029f2e60cd7c4f2bbd3097170af7a4d73245cafa9c3cca8d561a7c3de6f5d4a10be8ed2a5e608d68f92fcc8',
  },
  {
    entropy: '7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f',
    mnemonic:
      'legal winner thank year wave sausage worth useful legal winner thank year wave sausage worth useful legal winner thank year wave sausage worth title',
    seed: 'bc09fca1804f7e69da93c2f2028eb238c227f2e9dda30cd63699232578480a4021b146ad717fbb7e451ce9eb835f43620bf5c514db0f8add49f5d121449d3e87',
  },
  {
    entropy: '8080808080808080808080808080808080808080808080808080808080808080',
    mnemonic:
      'letter advice cage absurd amount doctor acoustic avoid letter advice cage absurd amount doctor acoustic avoid letter advice cage absurd amount doctor acoustic bless',
    seed: 'c0c519bd0e91a2ed54357d9d1ebef6f5af218a153624cf4f2da911a0ed8f7a09e2ef61af0aca007096df430022f7a2b6fb91661a9589097069720d015e4e982f',
  },
  {
    entropy: 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
    mnemonic:
      'zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo vote',
    seed: 'dd48c104698c30cfe2b6142103248622fb7bb0ff692eebb00089b32d22484e1613912f0a5b694407be899ffd31ed3992c456cdf60f5d4564b8ba3f05a69890ad',
  },
  {
    entropy: '9e885d952ad362caeb4efe34a8e91bd2',
    mnemonic:
      'ozone drill grab fiber curtain grace pudding thank cruise elder eight picnic',
    seed: '274ddc525802f7c828d8ef7ddbcdc5304e87ac3535913611fbbfa986d0c9e5476c91689f9c8a54fd55bd38606aa6a8595ad213d4c9c9f9aca3fb217069a41028',
  },
  {
    entropy: '6610b25967cdcca9d59875f5cb50b0ea75433311869e930b',
    mnemonic:
      'gravity machine north sort system female filter attitude volume fold club stay feature office ecology stable narrow fog',
    seed: '628c3827a8823298ee685db84f55caa34b5cc195a778e52d45f59bcf75aba68e4d7590e101dc414bc1bbd5737666fbbef35d1f1903953b66624f910feef245ac',
  },
  {
    entropy: '68a79eaca2324873eacc50cb9c6eca8cc68ea5d936f98787c60c7ebc74e6ce7c',
    mnemonic:
      'hamster diagram private dutch cause delay private meat slide toddler razor book happy fancy gospel tennis maple dilemma loan word shrug inflict delay length',
    seed: '64c87cde7e12ecf6704ab95bb1408bef047c22db4cc7491c4271d170a1b213d20b385bc1588d9c7b38f1b39d415665b8a9030c9ec653d75e65f847d8fc1fc440',
  },
  {
    entropy: 'c0ba5a8e914111210f2bd131f3d5e08d',
    mnemonic:
      'scheme spot photo card baby mountain device kick cradle pact join borrow',
    seed: 'ea725895aaae8d4c1cf682c1bfd2d358d52ed9f0f0591131b559e2724bb234fca05aa9c02c57407e04ee9dc3b454aa63fbff483a8b11de949624b9f1831a9612',
  },
  {
    entropy: '6d9be1ee6ebd27a258115aad99b7317b9c8d28b6d76431c3',
    mnemonic:
      'horn tenant knee talent sponsor spell gate clip pulse soap slush warm silver nephew swap uncle crack brave',
    seed: 'fd579828af3da1d32544ce4db5c73d53fc8acc4ddb1e3b251a31179cdb71e853c56d2fcb11aed39898ce6c34b10b5382772db8796e52837b54468aeb312cfc3d',
  },
  {
    entropy: '9f6a2878b2520799a44ef18bc7df394e7061a224d2c33cd015b157d746869863',
    mnemonic:
      'panda eyebrow bullet gorilla call smoke muffin taste mesh discover soft ostrich alcohol speed nation flash devote level hobby quick inner drive ghost inside',
    seed: '72be8e052fc4919d2adf28d5306b5474b0069df35b02303de8c1729c9538dbb6fc2d731d5f832193cd9fb6aeecbc469594a70e3dd50811b5067f3b88b28c3e8d',
  },
  {
    entropy: '23db8160a31d3e0dca3688ed941adbf3',
    mnemonic:
      'cat swing flag economy stadium alone churn speed unique patch report train',
    seed: 'deb5f45449e615feff5640f2e49f933ff51895de3b4381832b3139941c57b59205a42480c52175b6efcffaa58a2503887c1e8b363a707256bdd2b587b46541f5',
  },
  {
    entropy: '8197a4a47f0425faeaa69deebc05ca29c0a5b5cc76ceacc0',
    mnemonic:
      'light rule cinnamon wrap drastic word pride squirrel upgrade then income fatal apart sustain crack supply proud access',
    seed: '4cbdff1ca2db800fd61cae72a57475fdc6bab03e441fd63f96dabd1f183ef5b782925f00105f318309a7e9c3ea6967c7801e46c8a58082674c860a37b93eda02',
  },
  {
    entropy: '066dca1a2bb7e8a1db2832148ce9933eea0f3ac9548d793112d9a95c9407efad',
    mnemonic:
      'all hour make first leader extend hole alien behind guard gospel lava path output census museum junior mass reopen famous sing advance salt reform',
    seed: '26e975ec644423f4a4c4f4215ef09b4bd7ef924e85d1d17c4cf3f136c2863cf6df0a475045652c57eb5fb41513ca2a2d67722b77e954b4b3fc11f7590449191d',
  },
  {
    entropy: 'f30f8c1da665478f49b001d94c5fc452',
    mnemonic:
      'vessel ladder alter error federal sibling chat ability sun glass valve picture',
    seed: '2aaa9242daafcee6aa9d7269f17d4efe271e1b9a529178d7dc139cd18747090bf9d60295d0ce74309a78852a9caadf0af48aae1c6253839624076224374bc63f',
  },
  {
    entropy: 'c10ec20dc3cd9f652c7fac2f1230f7a3c828389a14392f05',
    mnemonic:
      'scissors invite lock maple supreme raw rapid void congress muscle digital elegant little brisk hair mango congress clump',
    seed: '7b4a10be9d98e6cba265566db7f136718e1398c71cb581e1b2f464cac1ceedf4f3e274dc270003c670ad8d02c4558b2f8e39edea2775c9e232c7cb798b069e88',
  },
  {
    entropy: 'f585c11aec520db57dd353c69554b21a89b20fb0650966fa0a9d6f74fd989d8f',
    mnemonic:
      'void come effort suffer camp survey warrior heavy shoot primary clutch crush open amazing screen patrol group space point ten exist slush involve unfold',
    seed: '01f5bced59dec48e362f2c45b5de68b9fd6c92c6634f44d6d40aab69056506f0e35524a518034ddc1192e1dacd32c1ed3eaa3c3b131c88ed8e7e54c49a5d0998',
  },
];

const password = 'onekey';
const xPrvTest = {
  chainCode: Buffer.alloc(32),
  key: encrypt(password, Buffer.alloc(32)),
};

const xPubTest = {
  chainCode: Buffer.alloc(32),
  key: Buffer.alloc(33),
};

function publicKeyToString(curveName: ICurveName, publicKey: Buffer): string {
  if (curveName === 'ed25519') {
    return `00${publicKey.toString('hex')}`;
  }
  return publicKey.toString('hex');
}

test('Wrong length of ECDSA signature', () => {
  expect(
    verify('secp256k1', Buffer.from(''), Buffer.from(''), Buffer.from('')),
  ).toStrictEqual(false);
});

test('Child index is not int', () => {
  expect(() => {
    CKDPriv('secp256k1', xPrvTest, 1.1, password);
  }).toThrow(new Error('Invalid index.'));
});

test('Child index too big', () => {
  expect(() => {
    CKDPriv('secp256k1', xPrvTest, 2 ** 32, password);
  }).toThrow(new Error('Overflowed.'));
  expect(() => {
    CKDPub('secp256k1', xPubTest, 2 ** 32);
  }).toThrow(new Error('Invalid index.'));
});

test('(ECDSA) CKDPub failed for hardened index', () => {
  const index = 2 ** 31;
  expect(() => {
    CKDPub('secp256k1', xPubTest, index);
  }).toThrow(new Error(`Can't derive public key for index ${index}.`));
});

test('Normal CKDPriv is not supported for ed25519', () => {
  expect(() => {
    CKDPriv('ed25519', xPrvTest, 1, password);
  }).toThrow(new Error('Only hardened CKDPriv is supported for ed25519.'));
});

test('CKDPub is not supported for ed25519', () => {
  expect(() => {
    CKDPub('ed25519', xPubTest, 0);
  }).toThrow(new Error('CKDPub is not supported for ed25519.'));
});

test('Normal encryption/decryption', () => {
  const data = Buffer.from('deadbeef', 'hex');
  expect(decrypt(password, encrypt(password, data))).toStrictEqual(data);
});

test('Incorrect password', () => {
  expect(() => {
    decrypt(password + password, encrypt(password, Buffer.from('')));
  }).toThrow(IncorrectPassword);
});

test('Incorrect mnemonic checksum', () => {
  expect(() => {
    revealableSeedFromMnemonic(
      'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon',
      'whatever password',
    );
  }).toThrow(InvalidMnemonic);
});

test('Incorrect mnemonic', () => {
  expect(() => {
    revealableSeedFromMnemonic(
      'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon',
      'whatever password',
    );
  }).toThrow(InvalidMnemonic);
});

test('sha256', () => {
  let hashBuffer = sha256(bufferUtils.toBuffer('hd-1--1', 'utf-8'));
  let hash = bufferUtils.bytesToHex(hashBuffer);
  expect(hash).toBe(
    '8aaf059c0c662d850ba4be656a127a7e9e5412b1e472a2919962da3d321a4ea6',
  );

  hashBuffer = sha256(bufferUtils.toBuffer('hd-1--0', 'utf-8'));
  hash = bufferUtils.bytesToHex(hashBuffer);
  expect(hash).toBe(
    'c804881858e8a43235e9f6ec4e8b50c611657397e75905471360ededa208e4b4',
  );
});
