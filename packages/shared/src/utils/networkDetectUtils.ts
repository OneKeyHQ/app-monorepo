/* eslint-disable spellcheck/spell-checker */
// Utilities for detecting whether an address belongs to a given network.

import { getPresetNetworks, presetNetworksMap } from '../config/presetNetworks';

import { generateUUID } from './miscUtils';

import type { IServerNetwork } from '../../types';

// 助记词	网络	派生规则	私钥1	公钥1	地址1
// 12	Akash	N/A	0x3ac84c5b051d55098e207e8bc120fa650d8be6692944e6518c6d67d1abd90b04	N/A	akash1l65dl2stwxk4w9gf0vt2mnxhst48ygyse55t6g
// 12	Alephium	N/A	N/A	N/A	17x6PcNB8odWBCVXkJnWRELBXEnFGve1BdpcbQU2BLndi
// 12	algorand	N/A	comic alter amused vendor hold food adapt ring evoke security current mandate plate market despair industry use under yard survey picnic odor jewel absent symbol	N/A	7ZVKIHADZGRZJ7A52B7DZTOP4JXAOPK2M2FQTXK3D3T3A2HFOPUOGKGAVM
// 12	Aptos	N/A	0x25cb5c737d8bff654fc62a6af4b00224f3a4b5c963a898a7e8ea9f08cbda5b2a	N/A	0x60e800a8839a86be1ca6c0b17ecb10f2a2af8b3b7c5f212bbeb64471c4f00bd8
// 12	Astar	N/A	0xc052cb9ba86a213302c9518890420f9493f3a00fde54c74582bcb46ad30ce846	N/A	aWDSucvebPdxdBp3i7SqnhAG7GuHvqm12dp7y624t5b1Xex
// 12	Babylon	N/A	0x3ac84c5b051d55098e207e8bc120fa650d8be6692944e6518c6d67d1abd90b04	N/A	bbn1l65dl2stwxk4w9gf0vt2mnxhst48ygysr3gaut
// 12	BCH	N/A	xprv9zKmn6V4XdvEwD1c8gW9funqQQV1Z6EckKjAt31WJPV9vccu4mMqsj1Qk4FbWTJZzH2WurGgaVAn4hnZuWd2uYm7jLfyEpwef5E2h2Xc53Y	xpub6DK8Bc1xN1UY9h65Ei3A33jZxSKVxYxU7YemgRR7rj28oQx3cJg6RXKtbLWiDpgQT8u9zQv4QEKUwq5Bj2xBN2ZmeFT7uNx1vv2BpFXy118	bitcoincash:qz6kmmtek6vvly474p65cz9n77xfd9tykutafetr5k
// 12	BenFen	N/A	0x81164a30cdd8552b2fdb8de0f7188b97c7e160099ecac7eb3fa4d7d8460f8e9a	N/A	BFC1c5404fc4c215d1f9d0630c61691b588bbd88fd4a2bcdc2fd74689720bb6cfb84820
// 12	BTC	Legacy	xprv9yh7er1pynFJCxmown6L9K9xZARVsXGF8JsD4rULzMR8YifQb31FA3ugMoC9E6XXfTapQxvKS6qMoSYrazeutw26Cm4xo54GTqkm2Rq1CbU	xpub6CgU4MYip9obRSrH3odLWT6h7CFzGyz6VXnosEsxYgx7RWzZ8aKVhrEAD2pQPqcsFDbBDkogETWd8RVeybGkKs7gakb8KyQdsUBqXhpiqRj	1AztpmzfQdpZNM5Yshczadx5pzcLfDTox7
// 12	BTC	Native SegWit	zprvAdLnmntBQG8yBz7ozABuv5NbrGzPoTMDxgZGyEdH6QCs2Ad9BXc5rm15vDJL6rdUPMz531C8xzuqzd6LTMxe7F11doAvm1eiJ3ohx5jx7ND	zpub6rL9BJR5EdhGQUCH6BivHDKLQJptCv55KuUsmd2tejjqtxxHj4vLQZKZmWj9NssjhELuU8s27d571yC6ndUmdYRnLWnbjXniFDdLVQbDyYo	bc1qjclx3t2ykepvcqegx8tmn3nwd5ahsswenrvd90
// 12	BTC	Nested SegWit	yprvAK1pWtDhs8mfVpomJb6eeBiJysWc9zaMXPgPS8ovnv7Dko28CGsoeAzFbcJZefteGnjbftxEJ2zZJ57D81KgeshBiWc4Fn3wsdgUig5PXhN	ypub6Y1AvPkbhWKxiJtEQcdf1Kf3XuM6ZTJCtcbzEXDYMFeCdbMGjpC4ByJjSvWzUC14vULqHj4JM9j1Y3CNMe4g6eaBVR98t5UHZ8yyRvhVb3D	38Xegnipu2RhZouctnGnwmDRk2bLXfDHf4
// 12	BTC	Taproot	xprv9z3f3zh1W5NWgJ64x7buzP32ChAhT2AxBDbg4DVQjhyJm7x5V5UmD7KsYNmxzZakidFZdyBB2rC6QK2sftr6MPH6XgAsDgfzvcHGKfWWbCW	xpub6D31TWDuLSvotnAY498vMWykkj1BrUtoYSXGrbu2J3WHdvHE2co1kueMPfdv4fngEMLp6rEiun2LFNBKoC5fGyahYG3R7wjoZQ8ezP5WTXa	bc1ppskree0erhqyptsx8hufkt98wxvuv6gla8hpep8euq6cex2k4h9svg2en3
// 12	cardano	N/A	xprv1pz8k3cag6yh8lhdzv8me3cjz6504z424catmccpkfre97qwmyay0rvxrfgyrffyc9w2p0tnh2rhjyl5nr5n2yl0kc45trt0zukajkhteg36tq6ukwpgxhcxjlhhm8cyaxyruptn8f2ml3fl4y3gq7qxqzqcqfu854y	N/A	addr1qyr8t5k9g7ggfsmfqwkf5gjcxtpag0xjkyctvnx0ljv8cxe0y0g30qkd85njeekrwsfxvt44z3r5drtgywdwnx0a8p5sak4p7t
// 12	Celestia	N/A	0x3ac84c5b051d55098e207e8bc120fa650d8be6692944e6518c6d67d1abd90b04	N/A	celestia1l65dl2stwxk4w9gf0vt2mnxhst48ygys99guel
// 12	Conflux	N/A	0x5f4c247c0fcd8430ccc2cbd2eba2def7b85860f7a353ab43f58bbb2249665d15	N/A	cfx:aapggywhe9bbab6g7swd9m6r0491g6z3ejup0bkug7
// 12	cosmos	N/A	0x3ac84c5b051d55098e207e8bc120fa650d8be6692944e6518c6d67d1abd90b04	N/A	cosmos1l65dl2stwxk4w9gf0vt2mnxhst48ygys50evrj
// 12	CronosPOS	N/A	0x3ac84c5b051d55098e207e8bc120fa650d8be6692944e6518c6d67d1abd90b04	N/A	cro1l65dl2stwxk4w9gf0vt2mnxhst48ygysv534lr
// 12	DOGE	N/A	dgpv58tkpgt8udMcqnJrCswRYNsJe8sY7VZkrwypFqD7PKTwN4Sdz4cLSULcvGdCF7cphd34zEYufT3D4aowgxMnsHomhgpL3aMtM5dG1NRFWeA	dgub8smnANp2Tn1x8dy1F7ZPfEQu6hFAwcbU9Ym2Qwc6BSWwv7ZLPqA75mkGVVDb6tGqHQS8NBMzQ3TGGvZrv7EjRqTeHidQHBwXioiTcWpvJ4g	D5UJ81u33vJBco3fMZxpaHrSrbwCyMejcY
// 12	Dynex	N/A	N/A	N/A	Xwo6CFYgd4TQEMhvgh9jy2XWdXiEQhd6DEdMAGWRWUNLJJKr1or8xjjKswVhgeWDTfeJeEXe5udsJehqvxaHGQvn13tnb32BX
// 12	ETH	bip44	0xf357470894ac56d21893d045001e207509bbeae7b9004d08ab099a60176c376a	N/A	0x4cf1495a7786cEbE16b92671e8Ff98bc710B0A83
// 12	ETH	ledger live	0xf357470894ac56d21893d045001e207509bbeae7b9004d08ab099a60176c376a	N/A	0x4cf1495a7786cEbE16b92671e8Ff98bc710B0A83
// 12	Fetch.ai 	N/A	0x3ac84c5b051d55098e207e8bc120fa650d8be6692944e6518c6d67d1abd90b04	N/A	fetch1l65dl2stwxk4w9gf0vt2mnxhst48ygys8jsgp9
// 12	Filecoin	N/A	7b2254797065223a22736563703235366b31222c22507269766174654b6579223a227050415a744c5344353451425039754c6b2b395350356e4150434f34473876312b4d63594b5666567175733d227d	N/A	f1qx24etmdkfpaqrxm5daj2cfe6ymu4eh5mbyamyy
// 12	Joystream	N/A	0xc052cb9ba86a213302c9518890420f9493f3a00fde54c74582bcb46ad30ce846	N/A	j4VtXaetok5FZaQbiqP71fHEshSeMpbiBhmm7FovUdbEG512F
// 12	juno	N/A	0x3ac84c5b051d55098e207e8bc120fa650d8be6692944e6518c6d67d1abd90b04	N/A	juno1l65dl2stwxk4w9gf0vt2mnxhst48ygysza6hyw
// 12	kaspa	Onekey	ae5ab015a709194d1c8bcc06892c13ac4ff4b18687714ec1e2cf7ca33d570773	N/A	kaspa:qpyzj30sk5jvrh0n6zxwgy8w7h3dnxxgy5yc5jz3eusp7g55wxcx6kcp6hhc9
// 12	kaspa	Official	ae5ab015a709194d1c8bcc06892c13ac4ff4b18687714ec1e2cf7ca33d570773	N/A	kaspa:qzx6wxwxxnvkwnvdcexsfpdf8mp6p9klklm92p39t8j6sz3qep5mgudpd43aq
// 12	Kusama	N/A	0xc052cb9ba86a213302c9518890420f9493f3a00fde54c74582bcb46ad30ce846	N/A	H9EfvziVimTVSyRL7UNi5ttKer28NxCSCyRGvA7gKJ8APBy
// 12	LTC	Legacy	Ltpv78KssZW51d5MEerJkXP6JfNGGCBbbhYdQD4w6KaJdHW7WsrG8GsqJ3Ccc6tNVcaMwLcBkYzApfh2Dx12gb67FGDTaCvRoKbTg4mFgWSnQ5J	Ltub2ZWDULvcFmcJrXZ918sUPFCUhksnfx7HUjAxmJLbZUHi7F3LTBvGJeJsrTw1kRfZPnYUEYTKPm35jfYGJAhA7Z1QtkR6BoiK1XeFrHjNr68	LYVggHGrbF1NxbKySUzkbUHQ6EmgzSo2UL
// 12	LTC	Native SegWit	zprvAcr9AQ7AMJRhe1TMXF3wAt2SyCfGHECx9Ruc6KXg2q5wjyFiGshPTo52yjFnE2HhyVrX15MmP4mwuwssE29kpa6daFRfsRprhDTPonGNwui	zpub6qqVZue4BfyzrVXpdGawY1yBXEVkggvoWeqCthwHbAcvcmarpR1e1bPWq3BZvd79kYUZ8NY91GoHegwob3VD2Uaww82S6jiCpb2oTUQNRfM	ltc1q5qzknn7arkxvwf53cy6dnjvx8w9ty5u4ujmprk
// 12	LTC	Nested SegWit	Mtpv7TRKRrj3u3BtgceHPeAYwW4mPAavSiaM3p4nmNxokDiwMLV1NKBJ5fUxW9WnchrS22CYJ7yLXqp8VeouyECYVejKARzRSPBsqKnRVjUCqh7	Mtub2tbf2e9b9BirJVM7eFew25typjH7Wy918LApSMj6gQWXwhg5hEDj6GbDkW7NT6AwTYvDo72FrmTsBZU8kF8vMquwqhPBxXFgDFVtJHypLBL	MRTehAWcZgZm6fnVj3kDzizaCtiybPHt3V
// 12	Manta Atlantic	N/A	0xc052cb9ba86a213302c9518890420f9493f3a00fde54c74582bcb46ad30ce846	N/A	dfb7vySxSVgWDnKvxTkJXVKEGunCDhs5vA6TMtM6Gc4X7Vtne
// 12	near	N/A	ed25519:F3GHuuNKq6CnkcpQkaHfv2nuw7EWjcZnfZ8c3bwhQePsiRBYoeKeEH2Zz6xKWimEf2N4koXE3AmSbjyBy7wFSJd	N/A	d7be27229b157122eae4e1329fabe67272dcb4ba186378f5f788f245cc1c10d2
// 12	Nervos	N/A	0xdae4fea05307de23c96125b5a514eb1991913dfbd863b599e804ebaa450bb44b	N/A	ckb1qyq9qqyurg2k9w8dvn8d62lsf89ca69rqv5qnwd9dc
// 12	Neurai	N/A	xprv9zHrJk3zbu6aXR5HrR7hnaJ7B4nbLZ4ZrAWDtwaqs31R8tK3ypLDoVGgdayCbdzJs8vFpnE1KRvZ5UUtWDg4pdgrsUpJ35gyXNYSUoBPAXq	xpub6DHCiFatSGesju9kxSei9iEqj6d5k1nRDPRphKzTRNYQ1geCXMeUMHbAUqNZAVcv3ZnFeQD2BSiYzQTgzQvdHHFKeigrMcrhtBhBgD2nhfd	NQGSM97dYfWXZtHu6zfN7kQwZcMz8wdbwq
// 12	nexa	N/A	66bbcedd3a66c7e110a9bce152c646d8c2d17c43783319c623e489bf86dafa47	N/A	nexa:nqtsq5g5e47yv33ek75g5j234acq43u8damwre2mp3zc2trf
// 12	Nostr	N/A	N/A	N/A	npub18y7frnjuwms9mah0llf928lpnfqa796pll4svh02fcqkufn02e8skypa2t
// 12	Osmosis	N/A	0x3ac84c5b051d55098e207e8bc120fa650d8be6692944e6518c6d67d1abd90b04	N/A	osmo1l65dl2stwxk4w9gf0vt2mnxhst48ygysu52u4q
// 12	Polkadot	N/A	0xc052cb9ba86a213302c9518890420f9493f3a00fde54c74582bcb46ad30ce846	N/A	15Zv9wuuj921BLAVX3iKxHN32gZS21hA4KsA3YsWkc79brEu
// 12	Ripple	N/A	0099FA332D42C7A99727D47BD0BB47F14655ACE7F64C56E795997011EECD348E7D	N/A	r9D1JTDPkWTZ9qfezpALSi2aiTytQ58Zy6
// 12	SCDO	N/A	N/A	N/A	1S01d8519174ea4064b80eae48fae0f6f50521eff1
// 12	Secret	N/A	0x3ac84c5b051d55098e207e8bc120fa650d8be6692944e6518c6d67d1abd90b04	N/A	secret1l65dl2stwxk4w9gf0vt2mnxhst48ygysk2d97w
// 12	SOL	bip44	2RBoeu3fhpNFZ5QdDSRZaRtnFMSUe4WjtXbnjZHijwWUzpz19Bxa8jBghq8mQexEXBzSAnGd3xsrwC3vWqr7NN21	N/A	FdrzyiRBdL1sNzPYbDdwgMWRfmBn9pS33uvn2vr7NNzH
// 12	SOL	ledger live	2fuk2nFbn2K7UKeLzjHJKUdc319LVHMBtR79BjM8v2vENYeoSM3gHqKtWBYxPVhKgdcf7yCNy5co8tc1hX24ZfH	N/A	9t17uwyDLNuhDnQGsjojEM8W37ey2kGkbDvdLNKoVW1Z
// 12	sui	N/A	0x644fedb8ebfec83d4a1cc983beb499048f8199bf72c8e8e57d5775603b8c5dd1	N/A	0xbfd0a6d5c3dd77bb27e1320e7ccc39d33f53056592f7165031d2893c07812bfe
// 12	TBTC	Legacy	tprv8fRswazqdbgVGW3ZVA7ziodfxNL3xDphbckQsBaWMKbZCqkCtYhqJaHbdKVkQDqFSWx4SWbi39NAkvejHZbMitjMYp2YibVuuYkTQ8SoWEz	tpubDC7v6135myNA9y5MNonb8DHnXPqz7Z1cAvMC9hcombPx3KzyWwXRV4uToUSTboto3JBpUfc6m4G7Pnj9MzGCGR3v6zCnJgpZzcgybw3WFGx	miDg8hbtpECMgje9jQRxhgvN9kQoA29DDm
// 12	TBTC	Native SegWit	vprv9KF3u9XUrrEGpz8v9PNA7iWJwaxG2aLqQAao1ykH5XCHs9TwBoD22YG7WAiwn6NhymqPhEq4tXufwA6eNHzjgPTYbZ7sRBQcwF2ZFyCCXer	vpub5YEQJf4NhDna3UDPFQuAUrT3VcnkS34gmPWPpN9tdrjGjwo5jLXGaLabMT5nxK8LboBz5KT17AGZJCrR1cHk1hprEEiHcYxHVYn79MMcu11	tb1qejyrvv8n4prmyyl7y8z20e3mcssyv9pgyyaqdw
// 12	TBTC	Nested SegWit	uprv91kHPF7vFcZmvs2gWw5occocgsdb7uCiJPhgiyw58tNcQaVoki9vqiTinq2sLgjy383Tfuwn8hsEUYK8Hr5y5Eabee78BqEv6QJMMj27tta	upub5Ejdnkep5z859M79cxcoykkMEuU5XMvZfcdHXNLghDubHNpxJFUBPWnCe4ZzgJyyXbMCZmUcPk2uioVdxc2iquW56kYFfiNNCAcqBHdBytp	2N76XJrCUurUstysYGyZqEysnJEK1d3m6aN
// 12	TBTC	Taproot	tprv8gkVsRsnRBrunsHp1RhHpXgsDPv7BRC3xeiE4tonXfpcQGNP1YEyiYHDe2q62aYuDsSQZY56RT6rQGt8UJ2uvShG1bRt3S4rSN4T9Mo9s8S	tpubDDSY1qv2ZZYagLKbu5MtDwLynRS3LkNxXxK1MQr5wwd1Ekd9dw4Zu2u5p9yr5E3pDzDV1otSWJiQYXcQQ7ppUYFiVpQ3xJMZK7ZwfSjahSY	tb1p7xnrmnq23tc3yrplqhu87xq3nm4rdfh8vp2fgawtzpu7dnml67esp8jlmf
// 12	Ton	N/A	e37632253d40d954f56ebf0593c56c6cf52ecd46dbcc40b055334cba18d8bc5e	N/A	UQB2EMBXWHRZxeltr_MJX0-2F5q7qUfMi59W2xXVak6X7Oh8
// 12	Tron	N/A	e777082ffadf85dbb56176c04add4cc104e244b3061260c8d4120619da80df25	N/A	THXNjn3TN6n58cD1Ry6mmzPzbgQiZ92whR
// 12	Neo N3	N/A	N/A	N/A	NaRAttMCnmEUBhHUQXtWnNgZyKaoifxx1q

/**
 * @deprecated This method uses regex pattern matching which may cause false positives.
 * Use vault validation instead by looping through all chains with real address validation.
 * See VerifyForm.tsx for the recommended implementation using backgroundApiProxy.serviceValidator.localValidateAddress()
 *
 * @deprecated 此方法使用正则表达式匹配，可能存在误判。
 * 应使用 vault 通过真实的地址验证循环检测所有链。
 * 参考 VerifyForm.tsx 中使用 backgroundApiProxy.serviceValidator.localValidateAddress() 的推荐实现方式
 */
async function _detectNetworkByAddress({
  address,
}: {
  address: string;
}): Promise<
  Array<{
    networkId: string;
    impl: string;
  }>
> {
  const a = address.trim();

  // Explicit-prefix networks
  if (/^bitcoincash:/i.test(a)) {
    return [
      {
        networkId: presetNetworksMap.bch.id,
        impl: presetNetworksMap.bch.impl,
      },
    ];
  }
  if (/^cfx:/i.test(a)) {
    return [
      {
        networkId: presetNetworksMap.cfx.id,
        impl: presetNetworksMap.cfx.impl,
      },
    ];
  }
  if (/^nexa:/i.test(a)) {
    return [
      {
        networkId: presetNetworksMap.nexa.id,
        impl: presetNetworksMap.nexa.impl,
      },
    ];
  }
  if (/^kaspa:/i.test(a)) {
    return [
      {
        networkId: presetNetworksMap.kaspa.id,
        impl: presetNetworksMap.kaspa.impl,
      },
    ];
  }

  // Cosmos family by bech32 hrp
  if (/^cosmos1[0-9a-z]+$/i.test(a)) {
    return [
      {
        networkId: presetNetworksMap.cosmoshub.id,
        impl: presetNetworksMap.cosmoshub.impl,
      },
    ];
  }
  if (/^osmo1[0-9a-z]+$/i.test(a)) {
    return [
      {
        networkId: presetNetworksMap.osmosis.id,
        impl: presetNetworksMap.osmosis.impl,
      },
    ];
  }
  if (/^juno1[0-9a-z]+$/i.test(a)) {
    return [
      {
        networkId: presetNetworksMap.juno.id,
        impl: presetNetworksMap.juno.impl,
      },
    ];
  }
  if (/^secret1[0-9a-z]+$/i.test(a)) {
    return [
      {
        networkId: presetNetworksMap.secret.id,
        impl: presetNetworksMap.secret.impl,
      },
    ];
  }
  if (/^cro1[0-9a-z]+$/i.test(a)) {
    return [
      {
        networkId: presetNetworksMap.cronosPosChain.id,
        impl: presetNetworksMap.cronosPosChain.impl,
      },
    ];
  }
  if (/^celestia1[0-9a-z]+$/i.test(a)) {
    return [
      {
        networkId: presetNetworksMap.celestia.id,
        impl: presetNetworksMap.celestia.impl,
      },
    ];
  }
  if (/^fetch1[0-9a-z]+$/i.test(a)) {
    return [
      {
        networkId: presetNetworksMap.fetchai.id,
        impl: presetNetworksMap.fetchai.impl,
      },
    ];
  }
  if (/^akash1[0-9a-z]+$/i.test(a)) {
    return [
      {
        networkId: presetNetworksMap.akash.id,
        impl: presetNetworksMap.akash.impl,
      },
    ];
  }

  // Nostr
  if (/^npub[0-9a-z]+$/i.test(a)) {
    return [
      {
        networkId: presetNetworksMap.nostr.id,
        impl: presetNetworksMap.nostr.impl,
      },
    ];
  }

  // CKB (Nervos)
  if (/^ckb1[0-9a-z]+$/i.test(a)) {
    return [
      {
        networkId: presetNetworksMap.ckb.id,
        impl: presetNetworksMap.ckb.impl,
      },
    ];
  }

  // BTC testnet (tb1..., m/n..., or 2... P2SH)
  if (
    // /^[mn][1-9A-HJ-NP-Za-km-z]{25,39}$/.test(a) ||
    // /^2[ac-hj-np-zAC-HJ-NP-Z1-9]{25,39}$/.test(a) ||
    /^tb1[qp][0-9a-z]+$/i.test(a)
  ) {
    return [
      {
        networkId: presetNetworksMap.tbtc.id,
        impl: presetNetworksMap.tbtc.impl,
      },
    ];
  }

  // BTC mainnet (bc1..., 1..., 3...)
  if (
    // /^[13][1-9A-HJ-NP-Za-km-z]{25,39}$/.test(a) ||
    /^bc1[0-9a-z]+$/i.test(a)
  ) {
    return [
      {
        networkId: presetNetworksMap.btc.id,
        impl: presetNetworksMap.btc.impl,
      },
    ];
  }

  // Litecoin
  if (
    // /^[LM][1-9A-HJ-NP-Za-km-z]{25,39}$/.test(a) ||
    /^ltc1[0-9a-z]+$/i.test(a)
  ) {
    return [
      {
        networkId: presetNetworksMap.ltc.id,
        impl: presetNetworksMap.ltc.impl,
      },
    ];
  }

  /*
  // Dogecoin
  if (/^D[1-9A-HJ-NP-Za-km-z]{25,34}$/.test(a)) {
    return [
      {
        networkId: presetNetworksMap.doge.id,
        impl: presetNetworksMap.doge.impl,
      },
    ];
  }

  // Filecoin
  if (/^f1[0-9a-z]+$/i.test(a)) {
    return [
      {
        networkId: presetNetworksMap.fil.id,
        impl: presetNetworksMap.fil.impl,
      },
    ];
  }

  // Ripple
  if (/^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(a)) {
    return [
      {
        networkId: presetNetworksMap.ripple.id,
        impl: presetNetworksMap.ripple.impl,
      },
    ];
  }

  // Cardano
  if (/^addr1[0-9a-z]+$/i.test(a)) {
    return [
      {
        networkId: presetNetworksMap.cardano.id,
        impl: presetNetworksMap.cardano.impl,
      },
    ];
  }

  // TRON (Base58, starts with T, 34 chars total)
  if (/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(a)) {
    return [
      {
        networkId: presetNetworksMap.tron.id,
        impl: presetNetworksMap.tron.impl,
      },
    ];
  }

  // NEAR (64 hex chars, no 0x prefix)
  if (/^[0-9a-fA-F]{64}$/.test(a)) {
    return [
      {
        networkId: presetNetworksMap.near.id,
        impl: presetNetworksMap.near.impl,
      },
    ];
  }

  // Sui / Aptos style (0x + 64 hex) - default to Aptos
  if (/^0x[0-9a-fA-F]{64}$/.test(a)) {
    return [
      {
        networkId: presetNetworksMap.aptos.id,
        impl: presetNetworksMap.aptos.impl,
      },
    ];
  }

  // Solana (base58, 32-44 chars) — heuristic catch-all after others
  if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(a)) {
    return [
      {
        networkId: presetNetworksMap.sol.id,
        impl: presetNetworksMap.sol.impl,
      },
    ];
  }

  // TON (typical URL-safe base64, starts with UQ)
  if (/^UQ[0-9A-Za-z_-]{43,47}$/.test(a)) {
    return [
      {
        networkId: presetNetworksMap.ton.id,
        impl: presetNetworksMap.ton.impl,
      },
    ];
  }
  */

  // EVM (0x + 40 hex)
  if (/^0x[0-9a-fA-F]{40}$/.test(a)) {
    return [
      {
        networkId: presetNetworksMap.eth.id,
        impl: presetNetworksMap.eth.impl,
      },
    ];
  }

  return [];
}

function buildDetectedNetwork(network: IServerNetwork): IDetectedNetwork {
  return {
    networkId: network.id,
    name: network.name,
    shortname: network.shortname,
    impl: network.impl,
  };
}

async function detectNetworkByPrivateKeyFn({
  privateKey,
}: {
  privateKey: string;
}): Promise<
  Array<{
    networkId: string;
    name: string;
    shortname: string;
    impl: string;
  }>
> {
  const pk = privateKey.trim();

  const buildSameImplResults = (network: IServerNetwork) => {
    const results = getPresetNetworks()
      .filter((n) => n.impl === network.impl)
      .sort((a) => (a.name === network.name ? -1 : 0))
      .map((n) => buildDetectedNetwork(n));
    return results;
  };

  // algorand ALGO
  if (pk.includes(' ') && pk.split(' ').length >= 12) {
    return [buildDetectedNetwork(presetNetworksMap.algo)];
  }

  // BTC Nested SegWit
  if (/^yprv[0-9A-Za-z]{107,}$/.test(pk)) {
    return [buildDetectedNetwork(presetNetworksMap.btc)];
  }

  // BTC Legacy / BTC Taproot / BCH
  if (/^xprv[0-9A-Za-z]{107,149}$/.test(pk)) {
    return [
      buildDetectedNetwork(presetNetworksMap.btc),
      buildDetectedNetwork(presetNetworksMap.bch),
      buildDetectedNetwork(presetNetworksMap.neurai),
    ];
  }

  // Cardano ADA (xprv1...)
  if (/^xprv1[0-9a-z]{150,}$/.test(pk)) {
    return [buildDetectedNetwork(presetNetworksMap.cardano)];
  }

  // BTC Native SegWit
  // LTC Native SegWit
  if (/^zprv[0-9A-Za-z]{107,}$/.test(pk)) {
    return [
      buildDetectedNetwork(presetNetworksMap.btc),
      buildDetectedNetwork(presetNetworksMap.ltc),
    ];
  }

  // TBTC
  if (
    /^tprv[0-9A-Za-z]{107,}$/.test(pk) || // TBTC Legacy / TBTC Taproot
    /^vprv[0-9A-Za-z]{107,}$/.test(pk) || // TBTC Native SegWit
    /^uprv[0-9A-Za-z]{107,}$/.test(pk) // TBTC Nested SegWit
  ) {
    return [buildDetectedNetwork(presetNetworksMap.tbtc)];
  }

  // LTC
  if (
    /^Ltpv[0-9A-Za-z]{107,}$/.test(pk) || // LTC Legacy
    /^Mtpv[0-9A-Za-z]{107,}$/.test(pk) // LTC Nested SegWit
  ) {
    return [buildDetectedNetwork(presetNetworksMap.ltc)];
  }

  // DOGE
  if (/^dgpv[0-9A-Za-z]{107,}$/.test(pk)) {
    return [buildDetectedNetwork(presetNetworksMap.doge)];
  }

  // 0x + 64 hex chars (MANY chains use this format)
  // Default to ETH, but could be: Cosmos family, Polkadot family, Aptos, Sui,
  // Conflux, BenFen, Nervos, and many others
  if (/^0x[0-9a-fA-F]{64}$/.test(pk)) {
    return [
      ...buildSameImplResults(presetNetworksMap.eth),
      ...buildSameImplResults(presetNetworksMap.cosmoshub),
      ...buildSameImplResults(presetNetworksMap.assethubPolkadot),
      buildDetectedNetwork(presetNetworksMap.kaspa),
      buildDetectedNetwork(presetNetworksMap.aptos),
      buildDetectedNetwork(presetNetworksMap.sui),
      buildDetectedNetwork(presetNetworksMap.cfx),
      buildDetectedNetwork(presetNetworksMap.benfen),
      buildDetectedNetwork(presetNetworksMap.ckb), // Nervos
    ];
  }

  // 64 hex chars without 0x (could be: Ton, Tron, Kaspa, Nexa, etc.)
  if (/^[0-9a-fA-F]{64}$/.test(pk)) {
    return [
      buildDetectedNetwork(presetNetworksMap.ton),
      buildDetectedNetwork(presetNetworksMap.tron),
      buildDetectedNetwork(presetNetworksMap.kaspa),
      buildDetectedNetwork(presetNetworksMap.nexa),
    ];
  }

  // Solana Base58 (typically 87-88 chars)
  if (/^[1-9A-HJ-NP-Za-km-z]{87,88}$/.test(pk)) {
    return [buildDetectedNetwork(presetNetworksMap.sol)];
  }

  // Filecoin (long hex JSON string)
  if (/^[0-9a-fA-F]{150,}$/.test(pk)) {
    return [buildDetectedNetwork(presetNetworksMap.fil)];
  }

  // Near (ed25519:...)
  if (/^ed25519:[0-9A-Za-z]{87,}$/.test(pk)) {
    return [buildDetectedNetwork(presetNetworksMap.near)];
  }

  // Ripple (66 hex chars, uppercase, no 0x)
  if (/^[0-9A-F]{66}$/.test(pk)) {
    return [buildDetectedNetwork(presetNetworksMap.ripple)];
  }

  return [];
}
export type IDetectedNetwork = {
  networkId: string;
  name: string;
  shortname: string;
  impl: string;
};
export type IDetectedNetworkGroupItem = {
  uuid: string;
  impl: string;
  networks: Array<IDetectedNetwork>;
};
export type IDetectedNetworkGroup = {
  [impl: string]: IDetectedNetworkGroupItem;
};
async function detectNetworkByPrivateKey({
  privateKey,
}: {
  privateKey: string;
}): Promise<{
  networks: Array<IDetectedNetwork>;
  groupedByImpl: IDetectedNetworkGroup;
}> {
  const networks = await detectNetworkByPrivateKeyFn({ privateKey });
  const groupedByImpl: IDetectedNetworkGroup = {};
  networks.forEach((network) => {
    if (!groupedByImpl[network.impl]) {
      groupedByImpl[network.impl] = {
        networks: [],
        uuid: generateUUID(),
        impl: network.impl,
      };
    }
    groupedByImpl[network.impl].networks.push(network);
  });

  return { networks, groupedByImpl };
}

export default {
  detectNetworkByPrivateKey,
  buildDetectedNetwork,
};
