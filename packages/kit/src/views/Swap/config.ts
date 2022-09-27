import { getFiatEndpoint } from '@onekeyhq/engine/src/endpoint';
import { OnekeyNetwork } from '@onekeyhq/engine/src/presets/networkIds';

import { Provider } from './typings';

export const swftcCustomerSupportUrl =
  'https://www.bangwo8.com/osp2016/im/pc/index.php?vendorID=782460&uid=&customSource=onekey';

export const enabledNetworkIds: string[] = [
  OnekeyNetwork.btc,
  OnekeyNetwork.eth,
  OnekeyNetwork.bsc,
  OnekeyNetwork.polygon,
  OnekeyNetwork.trx,
  OnekeyNetwork.sol,
  OnekeyNetwork.heco,
  OnekeyNetwork.optimism,
  OnekeyNetwork.xdai,
  OnekeyNetwork.fantom,
  OnekeyNetwork.arbitrum,
  OnekeyNetwork.celo,
  OnekeyNetwork.avalanche,
  OnekeyNetwork.aurora,
  OnekeyNetwork.near,
  OnekeyNetwork.etc,
  OnekeyNetwork.teth,
  OnekeyNetwork.ethw,
  OnekeyNetwork.etf,
];

export const zeroXServerEndpoints: Record<string, string> = {
  get [OnekeyNetwork.eth]() {
    return `${getFiatEndpoint()}/0x/quote?chainID=ethereum`;
  },
  get [OnekeyNetwork.teth]() {
    return `${getFiatEndpoint()}/0x/quote?chainID=ropsten`;
  },
  get [OnekeyNetwork.bsc]() {
    return `${getFiatEndpoint()}/0x/quote?chainID=bsc`;
  },
  get [OnekeyNetwork.polygon]() {
    return `${getFiatEndpoint()}/0x/quote?chainID=polygon`;
  },
  get [OnekeyNetwork.fantom]() {
    return `${getFiatEndpoint()}/0x/quote?chainID=fantom`;
  },
  get [OnekeyNetwork.avalanche]() {
    return `${getFiatEndpoint()}/0x/quote?chainID=avalanche`;
  },
  get [OnekeyNetwork.celo]() {
    return `${getFiatEndpoint()}/0x/quote?chainID=celo`;
  },
  get [OnekeyNetwork.optimism]() {
    return `${getFiatEndpoint()}/0x/quote?chainID=optimism`;
  },
};

const serverURL = 'https://0x.onekey.so';
export const quoterServerEndpoints: Record<string, string> = {
  [OnekeyNetwork.heco]: `${serverURL}/swap/v1/quote`,
};

export const estimatedTime: Record<string, number> = {
  [OnekeyNetwork.eth]: 60,
  [OnekeyNetwork.teth]: 15,
  [OnekeyNetwork.bsc]: 30,
  [OnekeyNetwork.polygon]: 30,
  [OnekeyNetwork.fantom]: 30,
  [OnekeyNetwork.avalanche]: 30,
  [OnekeyNetwork.celo]: 60,
  [OnekeyNetwork.optimism]: 60,
  [OnekeyNetwork.heco]: 15,
  [OnekeyNetwork.okt]: 15,
};

export const networkProviderInfos: Record<string, Provider[]> = {
  [OnekeyNetwork.okt]: [
    {
      name: 'CherrySwap',
      logoUrl: 'https://common.onekey-asset.com/logo/CherrySwap.png',
    },
  ],
  [OnekeyNetwork.heco]: [
    {
      name: 'MDex',
      logoUrl: 'https://common.onekey-asset.com/logo/MdexSwap.png',
    },
  ],
  [OnekeyNetwork.xdai]: [
    {
      name: 'HoneySwap',
      logoUrl: 'https://common.onekey-asset.com/logo/HoneySwap.png',
    },
  ],
};

export const swftOnlyNetwork: string[] = [
  OnekeyNetwork.trx,
  OnekeyNetwork.near,
  OnekeyNetwork.etc,
  OnekeyNetwork.ethw,
  OnekeyNetwork.etf,
];

export const networkSupportedTokens: Record<string, string[]> = {
  [OnekeyNetwork.eth]: [
    '0x0bb217E40F8a5Cb79Adf04E1aAb60E5abd0dfC1e',
    '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    '0xdac17f958d2ee523a2206206994597c13d831ec7',
    '0x4d224452801aced8b2f0aebe155379bb5d594381',
    '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    '0x6B175474E89094C44Da98b954EedeAC495271d0F',
    '0x6f259637dcd74c767781e37bc6133cd6a68aa161',
    '0x75231f58b43240c9718dd58b4967c5114342a86c',
    '0x7D1AfA7B718fb893dB30A3aBc0Cfc608AaCfeBB0',
    '0x7a58c0be72be218b41c608b7fe7c5bb630736c71',
    '0x0000000000085d4780B73119b644AE5ecd22b376',
    '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984',
    '0x6b3595068778dd592e39a122f4f5a5cf09c90fe2',
    '0x3b484b82567a09e2588a13d54d032153f0c0aee0',
    '0x91Af0fBB28ABA7E31403Cb457106Ce79397FD4E6',
    '0xbbc2ae13b23d715c30720f079fcd9b4a74093505',
    '0x4a220e6096b25eadb88358cb44068a3248254675',
    '0x4734Baf528766ec4C420A6C13f8DBa7bB1920181',
    '0x8f8221afbb33998d8584a2b05749ba73c37a938a',
    '0x0258F474786DdFd37ABCE6df6BBb1Dd5dfC4434a',
    '0xa0246c9032bC3A600820415aE600c6388619A14D',
    '0xcdf7028ceab81fa0c6971208e83fa7872994bee5',
    '0xde7d85157d9714eadf595045cc12ca4a5f3e2adb',
    '0x514910771af9ca656af840dff83e8264ecf986ca',
    '0x27ad8e47c48063b209fa5ca14c8c46ece49b82d2',
    '0xBA50933C268F567BDC86E1aC131BE072C6B0b71a',
    '0xaa8d0e9A26853D51613ca75729CDE2564913BCfb',
    '0x0d02755a5700414b26ff040e1de35d337df56218',
    '0x4dc3643dbc642b72c158e7f3d2ff232df61cb6ce',
    '0xba11d00c5f74255f56a5e366f4f77f5a186d7f55',
    '0x15D4c048F83bd7e37d49eA4C83a07267Ec4203dA',
    '0x0c10bf8fcb7bf5412187a595ab97a3609160b5c6',
    '0xc00e94cb662c3520282e6f5717214004a7f26888',
    '0xba100000625a3754423978a60c9317c58a424e3d',
    '0x1559fa1b8f28238fd5d76d9f434ad86fd20d1559',
    '0x0bc529c00c6401aef6d220be8c6ea1667f6ad93e',
    '0xa1d0E215a23d7030842FC67cE582a6aFa3CCaB83',
    '0x0316EB71485b0Ab14103307bf65a021042c6d380',
    '0x081131434f93063751813c619ecca9c4dc7862a3',
    '0xef3a930e1ffffacd2fc13434ac81bd278b0ecc8d',
    '0x3ab6ed69ef663bd986ee59205ccad8a20f98b4c2',
    '0x08d967bb0134f2d07f7cfb6e246680c53927dd30',
    '0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9',
    '0x1A4b46696b2bB4794Eb3D4c26f1c55F9170fa4C5',
    '0x1796ae0b0fa4862485106a0de9b654efe301d0b2',
    '0x9be89d2a4cd102d8fecc6bf9da793be995c22541',
    '0x27702a26126e0b3702af63ee09ac4d1a084ef628',
    '0x579cea1889991f68acc35ff5c3dd0621ff29b0c9',
    '0xb98d4c97425d9908e66e53a6fdf673acca0be986',
    '0xb6ca7399b4f9ca56fc27cbff44f4d2e4eef1fc81',
    '0x7dd9c5cba05e151c895fde1cf355c9a1d5da6429',
    '0x362bc847A3a9637d3af6624EeC853618a43ed7D2',
    '0xaae3cf9968d26925bdb73ce3864e0084a20f4687',
    '0x2791BfD60D232150Bff86b39B7146c0eaAA2BA81',
    '0xf293d23bf2cdc05411ca0eddd588eb1977e8dcd4',
    '0xf5581dfefd8fb0e4aec526be659cfab1f8c781da',
    '0x4b1e80cac91e2216eeb63e29b957eb91ae9c2be8',
    '0xd533a949740bb3306d119cc777fa900ba034cd52',
    '0x74232704659ef37c08995e386a2e26cc27a8d7b1',
    '0x0abdace70d3790235af448c88547603b945604ea',
    '0xe5f166c0d8872b68790061317bb6cca04582c912',
    '0xF433089366899D83a9f26A773D59ec7eCF30355e',
    '0x4691937a7508860f876c9c0a2a617e7d9e945d4b',
    '0x30df7d7ee52c1b03cd009e656f00ab875adceed2',
    '0x0f5d2fb29fb7d3cfee444a200298f468908cc942',
    '0x111111111117dc0aa78b770fa6a738034120c302',
    '0x3845badade8e6dff049820680d1f14bd3903a5d0',
    '0xc18360217d8f7ab5e7c516566761ea12ce7f9d72',
    '0x8E870D67F660D95d5be530380D0eC0bd388289E1',
    '0x7db5af2b9624e1b3b4bb69d6debd9ad1016a58ac',
    '0xa1faa113cbe53436df28ff0aee54275c13b40975',
    '0xbb0e17ef65f82ab018d8edd776e8dd940327b28b',
    '0x3F382DbD960E3a9bbCeaE22651E88158d2791550',
    '0xf629cbd94d3791c9250152bd8dfbdf380e2a3b9c',
    '0xc4c7ea4fab34bd9fb9a5e1b1a98df76e26e6407c',
    '0x32a7c02e79c4ea1008dd6564b35f131428673c41',
    '0x26a604DFFE3ddaB3BEE816097F81d3C4a2A4CF97',
    '0xac51066d7bec65dc4589368da368b212745d63e8',
    '0x973e52691176d36453868d9d86572788d27041a9',
    '0x6de037ef9ad2725eb40118bb1702ebb27e4aeb24',
    '0xf57e7e7c23978c3caec3c3548e3d615c346e79ff',
    '0xc434b27736a6882d33094d34792999702860a13c',
    '0xb62132e35a6c13ee1ee0f84dc5d40bad8d815206',
    '0x5cf04716ba20127f1e2297addcf4b5035000c9eb',
    '0x95ad61b0a150d79219dcf64e1e6cc01f0b64c4ce',
    '0x23880b70e1a31889384956c7270962ec4579358f',
    '0xf4d2888d29D722226FafA5d9B24F9164c092421E',
    '0x58f7345b5295e43aa454911571f13be186655be9',
    '0x7D1AfA7B718fb893dB30A3aBc0Cfc608AaCfeBB0',
    '0xd241d7b5cb0ef9fc79d9e4eb9e21f5e209f52f7d',
    '0x2a9bdcff37ab68b95a53435adfd8892e86084f93',
    '0x607F4C5BB672230e8672085532f7e901544a7375',
    '0x2C974B2d0BA1716E644c1FC59982a89DDD2fF724',
    '0x595832F8FC6BF59c85C527fEC3740A1b7a361269',
    '0x16CC8367055aE7e9157DBcB9d86Fd6CE82522b31',
    '0xe41d2489571d322189246dafa5ebde1f4699f498',
    '0xd26114cd6EE289AccF82350c8d8487fedB8A0C07',
    '0x0d8775f648430679a709e98d2b0cb6250d2887ef',
    '0x744d70fdbe2ba4cf95131626614a1763df805b9e',
    '0xe0b7927c4af23765cb51314a0e0521a9645f0e2a',
    '0x11eeF04c884E24d9B7B4760e7476D06ddF797f36',
    '0x419d0d8bdd9af5e606ae2232ed285aff190e711b',
    '0x1f573d6fb3f13d689ff844b4ce37794d79a7ff1c',
    '0x0f8c45b896784a1e408526b9300519ef8660209c',
    '0x41e5560054824ea6b0732e656e3ad64e20e94e45',
    '0xfe5f141bf94fe84bc28ded0ab966c16b17490657',
    '0x66186008C1050627F979d464eABb258860563dbE',
    '0x4824A7b64E3966B0133f4f4FFB1b9D6bEb75FFF7',
    '0x048fe49be32adfc9ed68c37d32b5ec9df17b3603',
    '0x624d520bab2e4ad83935fa503fb130614374e850',
    '0x056fd409e1d7a124bd7017459dfea2f387b6d5cd',
    '0xa66daa57432024023db65477ba87d4e7f5f95213',
    '0x9064c91e51d7021A85AD96817e1432aBf6624470',
    '0xb6f43025b29196af2dddd69b0a58afba079cd600',
    '0x4Fabb145d64652a948d72533023f6E7A623C7C53',
    '0xdf574c24545e5ffecb9a659c229253d4111d87e1',
  ],
  [OnekeyNetwork.btc]: ['0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'],
  [OnekeyNetwork.bsc]: [
    '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    '0x55d398326f99059ff775485246999027b3197955',
    '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
    '0x2170ed0880ac9a755fd29b2688956bd959f933f8',
    '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
    '0x1af3f329e8be154074d8769d1ffa4ee058b1dbc3',
    '0xe64e30276c2f826febd3784958d6da7b55dfbad3',
    '0xC6759a4Fc56B3ce9734035a56B36e8637c45b77E',
    '0x755f34709e369d37c6fa52808ae84a32007d1155',
    '0xb0d502e938ed5f4df2e681fe6e419ff29631d62b',
    '0x8f0528ce5ef7b51152a59745befdd91d97091d2f',
    '0x3019BF2a2eF8040C242C9a4c5c4BD4C81678b2A1',
    '0x51ba0b044d96c3abfca52b64d733603ccc4f0d4d',
    '0x728c5bac3c3e370e372fc4671f9ef6916b814d8b',
    '0x8855cfba493d8a22f924a5ce1b06efbcea68ffec',
    '0x5d3AfBA1924aD748776E4Ca62213BF7acf39d773',
    '0x69b14e8D3CEBfDD8196Bfe530954A0C226E5008E',
    '0x53e562b9b7e5e94b81f10e96ee70ad06df3d2657',
    '0x6855f7bb6287F94ddcC8915E37e73a3c9fEe5CF3',
    '0xc28ea768221f67b6a1fd33e6aa903d4e42f6b177',
    '0x0328a69b363a16f66810b23cb0b8d32abadb203d',
    '0xaec945e04baf28b135fa7c640f624f8d90f1c3a6',
    '0x3Dde01a467f99E58f996de835058C767A3edd2AC',
    '0xbd2949f67dcdc549c6ebe98696449fa79d988a9f',
    '0xac41fb8013c0b63588fc63997785a5d79e73eb28',
    '0xad29abb318791d579433d831ed122afeaf29dcfe',
    '0xe4Cc45Bb5DBDA06dB6183E8bf016569f40497Aa5',
    '0x6d3a160b86edcd46d8f9bba25c2f88cccade19fc',
    '0xa84373988ead7ec5440a1a06792ea52bfdb3b048',
    '0xd17479997f34dd9156deef8f95a52d81d265be9c',
    '0x1ce0c2827e2ef14d5c4f29a091d735a204794041',
    '0x12bb890508c125661e03b09ec06e404bc9289040',
    '0x383094a91Ef2767Eed2B063ea40465670bf1C83f',
    '0xf50B0a35EfdF8F247625E2A0695D56a63b30B7ff',
    '0xfa5d78d4517d2c5ccbad2e56fa8fc321d6544f2b',
    '0x9CD7bc7D83F31224d8CD9d8dbc9Bd453Cd64A81e',
    '0x82190d28E710ea9C029D009FaD951c6F1d803BB3',
    '0xbee5e147e6e40433ff0310f5ae1a66278bc8d678',
    '0x7130d2a12b9bcbfae4f2634d864a1ee1ce3ead9c',
    '0x54017fda0ff8f380ccef600147a66d2e262d6b17',
    '0x46d502fac9aea7c5bc7b13c8ec9d02378c33d36f',
    '0xc6f509274fcc1f485644167cb911fd0c61545e6c',
    '0xD1FdF57241df3C36dad469060caC9f1ea2eE7585',
    '0x20de22029ab63cf9A7Cf5fEB2b737Ca1eE4c82A6',
    '0xe9e7cea3dedca5984780bafc599bd69add087d56',
    '0x7859b01bbf675d67da8cd128a50d155cd881b576',
    '0x6679eb24f59dfe111864aec72b443d1da666b360',
    '0x961C8c0B1aaD0c0b10a51FeF6a867E3091BCef17',
    '0xD74b782E05AA25c50e7330Af541d46E18f36661C',
    '0x8C851d1a123Ff703BD1f9dabe631b69902Df5f97',
    '0x6a7a68397b47ecaab4bb3acd7c710be8e906e4ce',
    '0xfe3af7376e412a377358d5894c790bb3e00d0dc1',
    '0x4b7bf20baae7f04abea55b49c0ffbc31758a05a4',
    '0xe74c273ab62169656df1dd146f40e26baef5b057',
    '0x13A637026dF26F846D55ACC52775377717345c06',
    '0x56083560594E314b5cDd1680eC6a493bb851BBd8',
    '0x8b298c5fbf0a8d4cd65ae524c8792b8cdfd9fbe9',
    '0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82',
    '0xbf5140a22578168fd562dccf235e5d43a02ce9b1',
    '0xf8a0bf9cf54bb92f17374d9e9a321e6a111a51bd',
    '0x7083609fce4d1d8dc0c979aab8c869ea2c873402',
    '0x767b28a30e3a15dcece7bff7a020adfde9d19cf8',
    '0xAC51066d7bEC65Dc4589368da368b212745d63E8',
    '0x3203c9e46ca618c8c1ce5dc67e7e9d75f5da2377',
    '0x4d5ac5cc4f8abdf2ec2cb986c00c382369f787d4',
    '0xeca41281c24451168a37211f0bc2b8645af45092',
    '0x4c4da68d45f23e38ec8407272ee4f38f280263c0',
    '0xaff9084f2374585879e8b434c399e29e80cce635',
    '0x935a544bf5816e3a7c13db2efe3009ffda0acda2',
    '0x668db7aa38eac6b40c9d13dbe61361dc4c4611d1',
    '0x8443f091997f06a61670b735ed92734f5628692f',
    '0x5f4bde007dc06b867f86ebfe4802e34a1ffeed63',
    '0x557dd6700e66818af340cce17fd4508ced81fbc1',
    '0xba2ae424d960c26247dd6c32edc70b295c744c43',
    '0xc26EaFC627624baDf990f8d30116892eD204DB51',
    '0x42981d0bfbAf196529376EE702F2a9Eb9092fcB5',
    '0x9f589e3eabe42ebc94a44727b3f3531c0c877809',
    '0xe3d478fe8e8f55f7e9b2b55cf25868edc9f924d8',
    '0xc62ef0d8e137499833abb05dee47007d2b334ba6',
    '0xac0c8da4a4748d8d821a0973d00b157aa78c473d',
    '0x92da405b6771c9Caa7988A41dd969a73d10A3cc6',
    '0x7E1CCEeD4b908303a4262957aBd536509e7af54f',
    '0x7fb56b618463e404a9ca203b135bad468289ea2b',
    '0x7283dfa2d8d7e277b148cc263b5d8ae02f1076d3',
    '0x8337b6fe7a3198fb864ffbde97dda88cfdccbd96',
    '0xE942C48044FB1C7f4C9eB456f6097fa4A1A17B8f',
    '0xC3387E4285e9F80A7cFDf02B4ac6cdF2476A528A',
    '0x9159f30f1c3f0317b0a2d6bc176f29266be790ee',
    '0x65d9033cff96782394dAB5dbEf17Fa771bbe1732',
    '0x5941f87eb62737ec5ebbecab3e373c40fe40566b',
    '0x43acedd39ba4b0bfccd92897fce617fb90a971d8',
    '0x4ae80e0414a188f91debfb9e71c67153bfbe5f9e',
  ],
  [OnekeyNetwork.heco]: [
    '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    '0xa71edc38d189767582c38a3145b5873052c3e47a',
    '0x9362bbef4b8313a8aa9f0c9808b80577aa26b73b',
    '0x0298c2b32eae4da002a15f36fdf7615bea3da047',
    '0x329dda64Cbc4DFD5FA5072b447B3941CE054ebb3',
    '0xe55b3fb96bb83fbd483170eaecc39a8159cb253a',
    '0xd5f9bdc2e6c8ee0484a6293ce7fa97d96a5e1012',
    '0x25d2e80cb6b86881fd7e07dd263fb79f4abe033c',
    '0xa2c49cee16a5e5bdefde931107dc1fae9f7773e3',
    '0x22c54ce8321a4015740ee1109d9cbc25815c46e6',
    '0x7fc7b1c464f16f8ccc20b17eb95231a8bab8b7f4',
    '0x40280e26a572745b1152a54d1d44f365daa51618',
    '0x1b625dd82aeb3aac21398ea9933fbd56e9652383',
  ],
  [OnekeyNetwork.okt]: [
    '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    '0x382bb369d343125bfb2117af9c149795c6c65c50',
    '0xc946daf81b08146b1c7a8da2a851ddf2b3eaaf85',
    '0xdf54b6c6195ea4d948d03bfd818d365cf175cfc2',
    '0x59d226bb0a4d74274d4354ebb6a0e1a1aa5175b6',
    '0xabc732f6f69a519f6d508434481376b6221eb7d5',
    '0x12bb890508c125661e03b09ec06e404bc9289040',
  ],
  [OnekeyNetwork.polygon]: [
    '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    '0xc2132d05d31c914a87c6611c10748aeb04b58e8f',
    '0x2791bca1f2de4661ed88a30c99a7a9449aa84174',
    '0xc004e2318722ea2b15499d6375905d75ee5390b8',
    '0xf868939ee81f04f463010bc52eab91c0839ef08c',
    '0x23e8b6a3f6891254988b84da3738d2bfe5e703b9',
    '0xaaa5b9e6c589642f98a1cda99b9d024b8407285a',
    //
    '0x8f3cf7ad23cd3cadbd9735aff958023239c6a063',
    '0x7ceb23fd6bc0add59e62ac25578270cff1b9f619',
    '0x1bfd67037b42cf73acf2047067bd4f2c47d9bfd6',
  ],
  [OnekeyNetwork.fantom]: [
    '0x5C4FDfc5233f935f20D2aDbA572F770c2E377Ab0',
    '0x74E23dF9110Aa9eA0b6ff2fAEE01e740CA1c642e',
    '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    '0x841fad6eae12c286d1fd18d1d525dffa75c7effe',
    '0x8d11ec38a3eb5e956b052f67da8bdc9bef8abf3e',
    '0x04068da6c83afcfa0e13ba15a6696662335d5b75',
    '0x049d68029688eabf473097a2fc38ef61633a3c7a',
    '0x59d07a115fe3ffe5db3d52029d43cc0ef5e9ba08',
  ],
  [OnekeyNetwork.arbitrum]: [
    '0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9',
    '0xff970a61a04b1ca14834a43f5de4533ebddb5cc8',
    '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    //
    '0xda10009cbd5d07dd0cecc66161fc93d7c9000da1',
    '0x82af49447d8a07e3bd95bd0d56f35241523fbab1',
    '0x2f2a2543b76a4166549f7aab2e75bef0aefc5b0f',
  ],
  [OnekeyNetwork.optimism]: [
    '0x4200000000000000000000000000000000000042',
    //
    '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    '0x4200000000000000000000000000000000000006',
    '0xda10009cbd5d07dd0cecc66161fc93d7c9000da1',
    '0x94b008aa00579c1307b0ef2c499ad98a8ce58e58',
    '0x68f180fcce6836688e9084f035309e29bf0a2095',
    '0x7f5c764cbc14f9669b88837ca1490cca17c31607',
  ],
  [OnekeyNetwork.sol]: [
    '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
  ],
  [OnekeyNetwork.avalanche]: [
    '0xc7198437980c041c805a1edcba50c1ce5db95118',
    '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    '0xa7d7079b0fead91f3e65f86e8915cb59c1a4c664',
    '0x60781c2586d68229fde47564546784ab3faca982',
    '0xd586e7f844cea2f87f50152665bcbc2c279d8d70',
    '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
    '0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7',
    '0x6e84a6216ea6dacc71ee8e6b0a5b7322eebc0fdd',
    '0x83a283641C6B4DF383BCDDf807193284C84c5342',
  ],
  [OnekeyNetwork.celo]: [
    '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    //
    '0xef4229c8c3250C675F21BCefa42f58EfbfF6002a',
    '0x765DE816845861e75A25fCA122bb6898B8B1282a',
    '0x471EcE3750Da237f93B8E339c536989b8978a438',
  ],
  [OnekeyNetwork.trx]: [
    'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
    '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    'TMwFHYXLJaRUPeW6421aqXL4ZEzPRFGkGT',
    'TPbbHx2ztzYoJS12S4BkyhNjRBH9i7539r',
    'TPYmHEhy5n8TCEfYGqW2rPxsghSfzghPDn',
    'TCFLL5dx5ZJdKnWuesXxi1VPwjLVmWZZy9',
    'TTVEm9hmj3BvUiRjGHJQb8RVBvMyoNPq7G',
    'TEkxiTehnzSmSe2XqrBj4w32RUN966rdz8',
    'TLa2f6VPqDgRE67v1736s7bJ8Ray5wYjU7',
    'TUpMhErZL2fhh4sVNULAbNKLokS4GjC1F4',
    'TAFjULxiVgT4qWk6UZwjqwZXTSaGaqnVp4',
  ],
  [OnekeyNetwork.near]: ['0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'],
  [OnekeyNetwork.etc]: ['0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'],
  [OnekeyNetwork.etf]: ['0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'],
  [OnekeyNetwork.ethw]: ['0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'],
};

export const tokenReservedValues: Record<string, number> = {
  [OnekeyNetwork.eth]: 0.01,
  [OnekeyNetwork.bsc]: 0.01,
  [OnekeyNetwork.polygon]: 0.03,
  [OnekeyNetwork.btc]: 0,
};
