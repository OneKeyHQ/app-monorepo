(self.webpackChunkweb=self.webpackChunkweb||[]).push([[61647],{940916:(e,t,r)=>{"use strict";r.d(t,{G:()=>w});var n=r(482451),i=r.n(n),o=r(324586),a=r(586330),s=r(230414),c=r(507140),u=r(606777),d=r(401349),p=r(404727),l=r(180556),f=r(929296),h=r(195309),v=r(972715),g=r(901048).Buffer;function _createSuper(e){var t=_isNativeReflectConstruct();return function _createSuperInternal(){var r,n=(0,v.A)(e);if(t){var i=(0,v.A)(this).constructor;r=Reflect.construct(n,arguments,i)}else r=n.apply(this,arguments);return(0,h.A)(this,r)}}function _isNativeReflectConstruct(){try{var e=!Boolean.prototype.valueOf.call(Reflect.construct(Boolean,[],(function(){})))}catch(e){}return(_isNativeReflectConstruct=function(){return!!e})()}var y=function(e){(0,f.A)(ChainSigner,e);var t=_createSuper(ChainSigner);function ChainSigner(e,r,n){var i,o=(0,d.N)(n,{key:e,chainCode:g.alloc(32)},r).key.toString("hex");return(i=t.call(this,o,n)).encryptedPrivateKey=e,i.password=r,i.curve=n,i}var r,n=ChainSigner.prototype;return n.getPrvkey=function getPrvkey(){return Promise.resolve((0,d.Yc)(this.password,this.encryptedPrivateKey))},n.getPrvkeyHex=(r=(0,a.A)((function*(){return u.A.bytesToHex(yield this.getPrvkey())})),function getPrvkeyHex(){return r.apply(this,arguments)}),n.sign=function sign(e){var t=(0,d._S)(this.curve,this.encryptedPrivateKey,e,this.password);return"secp256k1"===this.curve?Promise.resolve([t.slice(0,-1),t[t.length-1]]):Promise.resolve([t,0])},(0,s.A)(ChainSigner)}(function(){function Verifier(e,t){this.curve=t,this.compressedPublicKey=g.from(e,"hex"),this.uncompressedPublicKey=(0,d.sA)(t,this.compressedPublicKey)}var e,t=Verifier.prototype;return t.getPubkey=function getPubkey(e){return Promise.resolve(e?this.compressedPublicKey:this.uncompressedPublicKey)},t.getPubkeyHex=(e=(0,a.A)((function*(e){return u.A.bytesToHex(yield this.getPubkey(e))})),function getPubkeyHex(t){return e.apply(this,arguments)}),t.verify=function verify(){return Promise.resolve(g.from([]))},t.verifySignature=function verifySignature({publicKey:e,digest:t,signature:r}){var n=u.A.toBuffer(e),i=u.A.toBuffer(t),o=u.A.toBuffer(r),{curve:a}=this,s=(0,d.MX)(a,n,i,o);return Promise.resolve(s)},(0,s.A)(Verifier)}());function ownKeys(e,t){var r=Object.keys(e);if(Object.getOwnPropertySymbols){var n=Object.getOwnPropertySymbols(e);t&&(n=n.filter((function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable}))),r.push.apply(r,n)}return r}function _objectSpread(e){for(var t=1;t<arguments.length;t++){var r=null!=arguments[t]?arguments[t]:{};t%2?ownKeys(Object(r),!0).forEach((function(t){(0,o.A)(e,t,r[t])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(r)):ownKeys(Object(r)).forEach((function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(r,t))}))}return e}var w=function(){function CoreChainApiBase(){}var e,t,r,n,o,f,h,v,g=CoreChainApiBase.prototype;return g.baseGetCurve=function baseGetCurve(e){switch(e){case"ed25519":return d.ev;case"secp256k1":return d.bI;case"nistp256":return d.OX;default:throw new c.He("Unsupported curve")}},g.baseCreateSigner=(e=(0,a.A)((function*({curve:e,privateKey:t,password:r}){if(void 0===r)throw new c.He("Software signing requires a password.");var n=u.A.toBuffer(t);return Promise.resolve(new y(n,r,e))})),function baseCreateSigner(t){return e.apply(this,arguments)}),g.baseGetSingleSigner=(t=(0,a.A)((function*({payload:e,curve:t}){var r=yield this.getPrivateKeys(e),n=e.account.path,i=r[n],o=e?.relPaths?.[0];if(!i&&o&&(i=r[[n,o].join("/")]),!i)throw new Error(`No private key found: ${n}`);return this.baseCreateSigner({curve:t,privateKey:i,password:e.password})})),function baseGetSingleSigner(e){return t.apply(this,arguments)}),g.baseGetPrivateKeys=(r=(0,a.A)((function*({payload:e,curve:t}){var{credentials:r,account:n,password:i,relPaths:o}=e,a={};if(r.hd&&r.imported)throw new c.He("getPrivateKeys ERROR: hd and imported credentials can NOT both set.");if(r.hd&&(a=yield this.baseGetPrivateKeysHd({curve:t,account:n,hdCredential:r.hd,password:i,relPaths:o})),r.imported){var{privateKey:s}=(0,d.VV)({password:i,credential:r.imported}),p=u.A.bytesToHex((0,d.w)(i,s));a[n.path]=p,a[""]=p}if(!Object.keys(a).length)throw new Error("No private keys found");return a})),function baseGetPrivateKeys(e){return r.apply(this,arguments)}),g.baseGetPrivateKeysHd=(n=(0,a.A)((function*({curve:e,password:t,account:r,relPaths:n,hdCredential:i}){var{path:o}=r,a=o.split("/"),s=n||[a.pop()],p=a.join("/");if(0===s.length)throw new c.He("getPrivateKeysHd ERROR: relPaths is empty.");return(0,d.Wu)(e,i,t,p,s).reduce((function(e,t){return _objectSpread(_objectSpread({},e),{},{[t.path]:u.A.bytesToHex(t.extendedKey.key)})}),{})})),function baseGetPrivateKeysHd(e){return n.apply(this,arguments)}),g.baseGetAddressesFromHd=(o=(0,a.A)((function*(e,t){var r=this,{curve:n,generateFrom:o}=t,{template:s,hdCredential:p,password:f,indexes:h}=e,{pathPrefix:v,pathSuffix:g}=(0,l.Ah)(s),y=h.map((function(e){return g.replace("{index}",e.toString())})),w="privateKey"===o,b=[],P=[];w?P=(0,d.Wu)(n,p,f,v,y):b=yield(0,d.MJ)({curveName:n,hdCredential:p,password:f,prefix:v,relPaths:y});var x=w?P:b;if(x.length!==h.length)throw new c.He("Unable to get publick key.");var k,A=yield Promise.all(x.map((k=(0,a.A)((function*(t){var n,o,{path:a,extendedKey:{key:s}}=t;if(w){var c=u.A.bytesToHex((0,d.Yc)(f,s));o=yield r.getAddressFromPrivate({networkInfo:e.networkInfo,privateKeyRaw:c,privateKeyInfo:t})}else n=s.toString("hex"),o=yield r.getAddressFromPublic({networkInfo:e.networkInfo,publicKey:n,publicKeyInfo:t});return i()({publicKey:n,path:a},o)})),function(e){return k.apply(this,arguments)})));return{addresses:A}})),function baseGetAddressesFromHd(e,t){return o.apply(this,arguments)}),g.baseGetCredentialsType=function baseGetCredentialsType({credentials:e}){if(e.hd&&e.imported)throw new c.He("getCredentialsType ERROR: hd and imported credentials can NOT both set.");if(e.hd)return p.ECoreCredentialType.hd;if(e.imported)return p.ECoreCredentialType.imported;throw new c.He("getCredentialsType ERROR: no credentials found")},g.baseGetDefaultPrivateKey=(f=(0,a.A)((function*(e){var t=yield this.getPrivateKeys(e),[r]=Object.values(t);return{privateKeyRaw:r}})),function baseGetDefaultPrivateKey(e){return f.apply(this,arguments)}),g.validateXpub=(h=(0,a.A)((function*(e){throw new c.MS})),function validateXpub(e){return h.apply(this,arguments)}),g.validateXprvt=(v=(0,a.A)((function*(e){throw new c.MS})),function validateXprvt(e){return v.apply(this,arguments)}),(0,s.A)(CoreChainApiBase)}()},681092:(e,t,r)=>{"use strict";r.d(t,{A:()=>E});var n=r(586330),i=r(230414),o=r(929296),a=r(195309),s=r(972715),c=r(167612),u=r(826412),d=r(236989),p=r.n(d),l=r(529848),f=r.n(l),h=r(377820),v=r(557503),g=r(928557),y=r(507140),w=r(948675),b=r(825145),P=r(606777),x=r(161024),k=r(940916),A=r(401349),C=r(404727),m=r(180556),S=r(824116),T=r(305719),K=r(901048).Buffer;function _createSuper(e){var t=_isNativeReflectConstruct();return function _createSuperInternal(){var r,n=(0,s.A)(e);if(t){var i=(0,s.A)(this).constructor;r=Reflect.construct(n,arguments,i)}else r=n.apply(this,arguments);return(0,a.A)(this,r)}}function _isNativeReflectConstruct(){try{var e=!Boolean.prototype.valueOf.call(Reflect.construct(Boolean,[],(function(){})))}catch(e){}return(_isNativeReflectConstruct=function(){return!!e})()}var B="secp256k1",validator=function(e,t,r){return(0,A.MX)(B,e,t,r)},bip0322Hash=function(e){var{sha256:t}=c.Et,r=t(K.from("BIP0322-signed-message"));return t(K.concat([r,r,K.from(e)])).toString("hex")},E=function(e){(0,o.A)(CoreChainSoftwareBtc,e);var t=_createSuper(CoreChainSoftwareBtc);function CoreChainSoftwareBtc(){return t.apply(this,arguments)}var r,a,s,d,l,k,E,R,F,I,H,N,O,X,_,U,M,j,G,D,V=CoreChainSoftwareBtc.prototype;return V.getCoinName=(r=(0,n.A)((function*({network:e}){return Promise.resolve(e.isTestnet?"TEST":"BTC")})),function getCoinName(e){return r.apply(this,arguments)}),V.getXpubRegex=(a=(0,n.A)((function*({btcForkNetwork:e}){return e.networkChainCode===v.Tv.btc.code?"^[xyz]pub":e.networkChainCode===v.Tv.tbtc.code||e.networkChainCode===v.Tv.sbtc.code?"^[tuv]pub":""})),function getXpubRegex(e){return a.apply(this,arguments)}),V.getXprvtRegex=(s=(0,n.A)((function*({btcForkNetwork:e}){return e.networkChainCode===v.Tv.btc.code?"^[xyz]prv":e.networkChainCode===v.Tv.tbtc.code||e.networkChainCode===v.Tv.sbtc.code?"^[tuv]prv":""})),function getXprvtRegex(e){return s.apply(this,arguments)}),V.validateXprvt=(d=(0,n.A)((function*(e){var{xprvt:t,btcForkNetwork:r}=e;return Promise.resolve((0,S.validateBtcXprvt)({xprvt:t,regex:yield this.getXprvtRegex({btcForkNetwork:r})}))})),function validateXprvt(e){return d.apply(this,arguments)}),V.validateXpub=(l=(0,n.A)((function*(e){var{xpub:t,btcForkNetwork:r}=e;return Promise.resolve((0,S.validateBtcXpub)({xpub:t,regex:yield this.getXpubRegex({btcForkNetwork:r})}))})),function validateXpub(e){return l.apply(this,arguments)}),V.decodeAddress=function decodeAddress(e){return e},V.encodeAddress=function encodeAddress(e){return e},V.getPsbt=function getPsbt({network:e}){return new c.iL({network:e})},V.getExportedSecretKey=(k=(0,n.A)((function*(e){var{account:t,keyType:r,addressEncoding:n,networkInfo:i,password:o,credentials:a}=e,{privateKeyRaw:s}=yield this.baseGetDefaultPrivateKey(e);if(!s)throw new Error("privateKeyRaw is required");if(r===C.ECoreApiExportedSecretKeyType.xprvt){if(a.hd){if(!n)throw new Error("addressEncoding is required");if(!t.xpub)throw new Error("xpub is required");var c=(0,S.getBtcForkNetwork)(i?.networkChainCode),u=(0,S.getBtcForkVersionBytesByAddressEncoding)({addressEncoding:n,btcForkNetwork:c}).private;if(!u)throw new Error("xprvVersionBytes not found");return f().encode(K.from(f().decode(t.xpub)).fill((0,S.btcForkVersionBytesToBuffer)({versionBytes:u}),0,4).fill(K.concat([K.from([0]),(0,A.Yc)(o,s)]),45,78))}if(a.imported)return f().encode((0,A.Yc)(o,s))}throw new Error(`SecretKey type not support: ${r}`)})),function getExportedSecretKey(e){return k.apply(this,arguments)}),V.getAddressFromPublic=(E=(0,n.A)((function*(e){var{networkInfo:t,publicKey:r,addressEncoding:n}=e,i=(0,S.getBtcForkNetwork)(t.networkChainCode),o=r,{addresses:a,xpubSegwit:s}=yield this.getAddressFromXpub({network:i,xpub:o,relativePaths:["0/0"],addressEncoding:n});return{address:a["0/0"],publicKey:"",xpub:o,xpubSegwit:s,addresses:a}})),function getAddressFromPublic(e){return E.apply(this,arguments)}),V.getAddressFromXpub=(R=(0,n.A)((function*({network:e,xpub:t,relativePaths:r,addressEncoding:n}){return(0,S.getAddressFromXpub)({curve:B,network:e,xpub:t,relativePaths:r,addressEncoding:n,encodeAddress:this.encodeAddress.bind(this)})})),function getAddressFromXpub(e){return R.apply(this,arguments)}),V.buildSignersMap=(F=(0,n.A)((function*({payload:e}){var{password:t}=e,r=yield this.getPrivateKeysInFullPath({payload:e}),n=e?.btcExtraInfo?.pathToAddresses,i={};for(var[o,a]of Object.entries(r)){var s=n?.[o]?.address;if(!s)throw new Error("getSignersMap ERROR: address is required, is privateKeys including fullPath?");var c=yield this.buildSignerBtc({privateKey:a,password:t});i[s]=c}return i})),function buildSignersMap(e){return F.apply(this,arguments)}),V.buildSignerBtc=function buildSignerBtc({privateKey:e,password:t}){return this.baseCreateSigner({curve:B,privateKey:e,password:t})},V.getBitcoinSignerPro=(I=(0,n.A)((function*({network:e,signer:t,input:r}){var i,o=yield t.getPubkey(!0);if((0,u.isTaprootInput)(r)){var a=!0;if(r.tapLeafScript&&r.tapLeafScript?.length>0&&!r.tapMerkleRoot&&r.tapLeafScript.forEach((function(e){e.controlBlock&&e.script&&(a=!1)})),r.tapInternalKey){var s=yield t.getPrvkey();return(0,S.tweakSigner)(s,o,{network:e,needTweak:a})}}return{publicKey:o,sign:(i=(0,n.A)((function*(e){var[r]=yield t.sign(e);return r})),function sign(e){return i.apply(this,arguments)})}})),function getBitcoinSignerPro(e){return I.apply(this,arguments)}),V.packTransactionToPSBT=(H=(0,n.A)((function*({network:e,signers:t,payload:r}){var i,o=this,{unsignedTx:a,btcExtraInfo:s}=r,c=yield(0,T.U7)({network:e,unsignedTx:a,btcExtraInfo:s,getPsbt:function(e){return o.getPsbt({network:e.network})},buildInputMixinInfo:(i=(0,n.A)((function*({address:e}){var r=o.pickSigner(t,e);return Promise.resolve({pubkey:yield r.getPubkey(!0)})})),function buildInputMixinInfo(e){return i.apply(this,arguments)})});return c})),function packTransactionToPSBT(e){return H.apply(this,arguments)}),V.appendImportedRelPathPrivateKeys=function appendImportedRelPathPrivateKeys({privateKeys:e,password:t,relPaths:r}){var n=new A.UV(K.from("Bitcoin seed"),A.bI),i=e[""],o=(0,A.Yc)(t,P.A.toBuffer(i)),a={chainCode:o.slice(13,45),key:o.slice(46,78)},s={};return r?.forEach((function(r){var i=r.split("/"),o="",c=a;i.forEach((function(e){if(o=o.length>0?`${o}/${e}`:e,void 0===s[o]){var t=e.endsWith("'")?parseInt(e.slice(0,-1),10)+2**31:parseInt(e,10),r=n.CKDPriv(c,t);s[o]=r}c=s[o]})),e[r]=P.A.bytesToHex((0,A.w)(t,s[r].key))})),e},V.getPrivateKeysInFullPath=(N=(0,n.A)((function*({payload:e}){var t=(0,b.wT)(e.btcExtraInfo),r=yield this.getPrivateKeys(e),n=!!e.credentials.imported,{pathToAddresses:i}=t,o=(0,b.wT)(e.networkInfo.networkImpl),a={};for(var[s,{address:c,relPath:u}]of Object.entries(i)){var d=n?u:s,p=r[d];if(o===g.Jj&&(p||(p=r[d.replace("m/86'/0'/","m/86'/1'/")]),p||(p=r[d.replace("m/86'/1'/","m/86'/0'/")])),c!=c)throw new Error("addressFromPrivateKey and utxoAddress not matched");if(!p)throw new Error(`privateKey not found: ${c} ${s}`);a[s]=p}return a})),function getPrivateKeysInFullPath(e){return N.apply(this,arguments)}),V.signBip322MessageSimple=(O=(0,n.A)((function*({encodedTx:e,account:t,message:r,signers:n,psbtNetwork:i}){(0,S.initBitcoinEcc)();var o=(0,S.validateBtcAddress)({address:t.address,network:i});if(!o.isValid)throw new Error("Invalid address");var a=[C.EAddressEncodings.P2WPKH,C.EAddressEncodings.P2TR];if(!o.encoding||o.encoding&&!a.includes(o.encoding))throw new y.Jz;var s=c.hl.toOutputScript(t.address,i),u=K.from("0000000000000000000000000000000000000000000000000000000000000000","hex"),d=K.concat([K.from("0020","hex"),K.from(bip0322Hash(r),"hex")]),p=new c.ZX;p.version=0,p.addInput(u,4294967295,0,d),p.addOutput(s,0);var l=new c.iL;l.setVersion(0),l.addInput({hash:p.getHash(),index:0,sequence:0,witnessUtxo:{script:s,value:0}}),l.addOutput({script:K.from("6a","hex"),value:0});var f=(0,S.getInputsToSignFromPsbt)({psbt:l,psbtNetwork:i,account:t,isBtcWalletProvider:!1});yield this.signPsbt({encodedTx:e,psbt:l,signers:n,inputsToSign:f,network:i}),f.forEach((function(e){l.finalizeInput(e.index)}));var v=l.extractTransaction(),g=(0,h.encode)(v.ins[0].witness.length);return K.concat([g,...v.ins[0].witness.map((function(e){return t=e,K.concat([(0,h.encode)(t.byteLength),t]);var t}))])})),function signBip322MessageSimple(e){return O.apply(this,arguments)}),V.signPsbt=(X=(0,n.A)((function*({encodedTx:e,network:t,psbt:r,signers:n,inputsToSign:i,signOnly:o}){for(var a=0,s=i.length;a<s;a+=1){var u=i[a],d=this.pickSigner(n,u.address),p=yield this.getBitcoinSignerPro({network:t,signer:d,input:r.data.inputs[u.index]});yield r.signInputAsync(u.index,p,u.sighashTypes)}var l="",f=c.iL.fromHex(r.toHex(),{network:t});return i.forEach((function(e){f.finalizeInput(e.index)})),o||(l=f.extractTransaction().toHex()),{encodedTx:e,txid:"",rawTx:l,psbtHex:r.toHex(),finalizedPsbtHex:f.toHex()}})),function signPsbt(e){return X.apply(this,arguments)}),V.getPrivateKeys=(_=(0,n.A)((function*(e){var{password:t,relPaths:r}=e,n=!!e.credentials.imported,i=yield this.baseGetPrivateKeys({payload:e,curve:B});return n&&this.appendImportedRelPathPrivateKeys({privateKeys:i,password:t,relPaths:r}),i})),function getPrivateKeys(e){return _.apply(this,arguments)}),V.getAddressFromPrivate=(U=(0,n.A)((function*(e){var{privateKeyRaw:t,networkInfo:r,addressEncoding:n}=e,i=(0,S.getBtcForkNetwork)(r.networkChainCode),{xpub:o}=(0,S.getBtcXpubFromXprvt)({privateKeyRaw:t,network:i}),a=(0,S.getPublicKeyFromXpub)({xpub:o,network:i,relPath:"0/0"}),s=n,c="0/0",{addresses:u,xpubSegwit:d}=yield this.getAddressFromXpub({network:i,xpub:o,relativePaths:[c],addressEncoding:s}),{[c]:p}=u;return Promise.resolve({publicKey:a,xpub:o,xpubSegwit:d,relPath:c,address:p,addresses:u})})),function getAddressFromPrivate(e){return U.apply(this,arguments)}),V.getAddressesFromHd=(M=(0,n.A)((function*(e){var t=this;w.U.account.accountCreatePerf.getAddressesFromHdBtc();var{template:r,hdCredential:i,password:o,indexes:a,networkInfo:{networkChainCode:s},addressEncoding:c}=e,{pathPrefix:u}=(0,m.Ah)(r),d=a.map((function(e){return`${e.toString()}'`}));w.U.account.accountCreatePerf.batchGetPublicKeysBtc();var p=yield(0,A.MJ)({curveName:B,hdCredential:i,password:o,prefix:u,relPaths:d});if(w.U.account.accountCreatePerf.batchGetPublicKeysBtcDone(),p.length!==a.length)throw new y.He("Unable to get publick key.");if(!s)throw new Error("networkChainCode is required");var l=(0,S.getBtcForkNetwork)(s),{public:h}=(l.segwitVersionBytes||{})[c]||l.bip32;w.U.account.accountCreatePerf.mnemonicFromEntropy();var v=yield(0,A.i9)({hdCredential:i,password:o});w.U.account.accountCreatePerf.mnemonicFromEntropyDone(),w.U.account.accountCreatePerf.mnemonicToSeed();var g=yield(0,A.bk)({mnemonic:v});w.U.account.accountCreatePerf.mnemonicToSeedDone(),w.U.account.accountCreatePerf.seedToRootBip32();var b=(0,S.getBitcoinBip32)().fromSeed(g);w.U.account.accountCreatePerf.seedToRootBip32Done();var P,x=[K.from(h.toString(16).padStart(8,"0"),"hex"),K.from([3])],k=yield Promise.all(p.map((P=(0,n.A)((function*(e,r){var{path:n,parentFingerPrint:s,extendedKey:u}=e;w.U.account.accountCreatePerf.bip32DerivePath();var d=b.derivePath(`${n}/0/0`);w.U.account.accountCreatePerf.derivePathKeyPair();var p=(0,S.getBitcoinECPair)().fromWIF(d.toWIF()).publicKey.toString("hex");w.U.account.accountCreatePerf.keypairToXpub();var h=f().encode(K.concat([...x,s,K.from((a[r]+2**31).toString(16).padStart(8,"0"),"hex"),u.chainCode,u.key]));w.U.account.accountCreatePerf.keypairToXpubDone();var v="0/0",g=[v];w.U.account.accountCreatePerf.xpubToAddress();var{addresses:y,xpubSegwit:P}=yield t.getAddressFromXpub({network:l,xpub:h,relativePaths:g,addressEncoding:c});w.U.account.accountCreatePerf.xpubToAddressDone();var{[v]:k}=y;return w.U.account.accountCreatePerf.xpubToSegwit(),P=yield(0,S.buildBtcXpubSegwitAsync)({xpub:h,addressEncoding:c,hdAccountPayload:{curveName:B,hdCredential:i,password:o,path:n}}),w.U.account.accountCreatePerf.xpubToSegwitDone(),{address:k,publicKey:p,path:n,relPath:v,xpub:h,xpubSegwit:P,addresses:{[v]:k}}})),function(e,t){return P.apply(this,arguments)})));return w.U.account.accountCreatePerf.getAddressesFromHdBtcDone(),{addresses:k}})),function getAddressesFromHd(e){return M.apply(this,arguments)}),V.signTransaction=(j=(0,n.A)((function*(e){var{unsignedTx:t,networkInfo:{networkChainCode:r},relPaths:n,signOnly:i}=e,o=t.encodedTx,{psbtHex:a,inputsToSign:s}=o;if(!n?.length)throw new Error("BTC sign transaction need relPaths");var u=(0,S.getBtcForkNetwork)(r),d=yield this.buildSignersMap({payload:e});if(a&&s){c.iL;var p=c.iL.fromHex(a,{network:u}),l=(p.data.inputs[0].witnessScript,p.data.inputs[0].witnessUtxo?.script),f=c.KT;try{var h=f.p2tr({output:l,network:u});h?.pubkey?.toString("hex")}catch(e){}try{var v=c.KT.p2pkh({output:l,network:u});v?.pubkey?.toString("hex")}catch(e){}try{var g=c.KT.p2sh({output:l,network:u});g?.pubkey?.toString("hex")}catch(e){}try{var y=c.KT.p2wpkh({output:l,network:u});y?.pubkey?.toString("hex")}catch(e){}try{var w=c.KT.p2wsh({output:l,network:u});w?.pubkey?.toString("hex")}catch(e){}return this.signPsbt({encodedTx:t.encodedTx,network:u,psbt:p,signers:d,inputsToSign:s,signOnly:i})}for(var b=yield this.packTransactionToPSBT({network:u,signers:d,payload:e}),P=0;P<o.inputs.length;++P){var{address:x}=o.inputs[P],k=this.pickSigner(d,x),A=b.data.inputs[0],C=yield this.getBitcoinSignerPro({signer:k,input:A,network:u});yield b.signInputAsync(P,C)}var{txid:m,rawTx:T}=yield this.extractPsbtToSignedTx({psbt:b});return{encodedTx:t.encodedTx,txid:m,rawTx:T,psbtHex:void 0}})),function signTransaction(e){return j.apply(this,arguments)}),V.extractPsbtToSignedTx=(G=(0,n.A)((function*({psbt:e}){var t;e.validateSignaturesOfAllInputs(validator);try{t=e.finalizeAllInputs().extractTransaction()}catch(e){throw e}var r={txid:t.getId(),rawTx:t.toHex()};return Promise.resolve(r)})),function extractPsbtToSignedTx(e){return G.apply(this,arguments)}),V.pickSigner=function pickSigner(e,t){var r=e[t];if(!r)throw new Error(`BTC signer not found: ${t}`);return r},V.signMessage=(D=(0,n.A)((function*(e){var{account:t,networkInfo:{networkChainCode:r},relPaths:n}=e;if(!n?.length)throw new Error("BTC sign message need relPaths");var i=e.unsignedMsg,o=(0,S.getBtcForkNetwork)(r),a=yield this.buildSignersMap({payload:e});if(i.type===x.nc.BIP322_SIMPLE){var s=yield this.signBip322MessageSimple({encodedTx:null,account:t,message:i.message,signers:a,psbtNetwork:o});return P.A.bytesToHex(s)}var c=this.pickSigner(a,t.address),u=yield c.getPrvkey(),d=(0,S.getBitcoinECPair)().fromPrivateKey(u,{network:o}),l=i.sigOptions||{segwitType:"p2wpkh"},f=p().sign(i.message,(0,b.wT)(d.privateKey),d.compressed,l);return P.A.bytesToHex(f)})),function signMessage(e){return D.apply(this,arguments)}),(0,i.A)(CoreChainSoftwareBtc)}(k.G)},215230:(e,t,r)=>{"use strict";r.r(t),r.d(t,{default:()=>s});var n=r(230414),i=r(929296),o=r(195309),a=r(972715);function _createSuper(e){var t=_isNativeReflectConstruct();return function _createSuperInternal(){var r,n=(0,a.A)(e);if(t){var i=(0,a.A)(this).constructor;r=Reflect.construct(n,arguments,i)}else r=n.apply(this,arguments);return(0,o.A)(this,r)}}function _isNativeReflectConstruct(){try{var e=!Boolean.prototype.valueOf.call(Reflect.construct(Boolean,[],(function(){})))}catch(e){}return(_isNativeReflectConstruct=function(){return!!e})()}var s=function(e){(0,i.A)(CoreChainHd,e);var t=_createSuper(CoreChainHd);function CoreChainHd(){return t.apply(this,arguments)}return(0,n.A)(CoreChainHd)}(r(610859).A)},610859:(e,t,r)=>{"use strict";r.d(t,{A:()=>d});var n=r(586330),i=r(230414),o=r(85018),a=r(929296),s=r(195309),c=r(972715),u=r(167612);function _createSuper(e){var t=_isNativeReflectConstruct();return function _createSuperInternal(){var r,n=(0,c.A)(e);if(t){var i=(0,c.A)(this).constructor;r=Reflect.construct(n,arguments,i)}else r=n.apply(this,arguments);return(0,s.A)(this,r)}}function _isNativeReflectConstruct(){try{var e=!Boolean.prototype.valueOf.call(Reflect.construct(Boolean,[],(function(){})))}catch(e){}return(_isNativeReflectConstruct=function(){return!!e})()}var d=function(e){(0,a.A)(CoreChainSoftware,e);var t=_createSuper(CoreChainSoftware);function CoreChainSoftware(){return t.apply(this,arguments)}var r,s,d,p=CoreChainSoftware.prototype;return p.getCoinName=(r=(0,n.A)((function*(){return Promise.resolve("NEURAI")})),function getCoinName(){return r.apply(this,arguments)}),p.getXpubRegex=(s=(0,n.A)((function*(){return"^xpub"})),function getXpubRegex(){return s.apply(this,arguments)}),p.getXprvtRegex=(d=(0,n.A)((function*(){return"^xprv"})),function getXprvtRegex(){return d.apply(this,arguments)}),p.getPsbt=function getPsbt({network:e}){return new u.iL({network:e,maximumFeeRate:e.maximumFeeRate})},p.signMessage=function signMessage(e){return(0,o.A)((0,c.A)(CoreChainSoftware.prototype),"signMessage",this).call(this,e)},p.signTransaction=function signTransaction(e){return(0,o.A)((0,c.A)(CoreChainSoftware.prototype),"signTransaction",this).call(this,e)},p.getPrivateKeys=function getPrivateKeys(e){return(0,o.A)((0,c.A)(CoreChainSoftware.prototype),"getPrivateKeys",this).call(this,e)},p.getAddressFromPrivate=function getAddressFromPrivate(e){return(0,o.A)((0,c.A)(CoreChainSoftware.prototype),"getAddressFromPrivate",this).call(this,e)},p.getAddressFromPublic=function getAddressFromPublic(e){return(0,o.A)((0,c.A)(CoreChainSoftware.prototype),"getAddressFromPublic",this).call(this,e)},p.getAddressesFromHd=function getAddressesFromHd(e){return(0,o.A)((0,c.A)(CoreChainSoftware.prototype),"getAddressesFromHd",this).call(this,e)},(0,i.A)(CoreChainSoftware)}(r(681092).A)},180556:(e,t,r)=>{"use strict";r.d(t,{Ac:()=>estimateTxSize,Ah:()=>slicePathTemplate,vN:()=>getUtxoAccountPrefixPath,zf:()=>getBIP44Path});var n=r(90366),i=r.n(n),o=r(928557);function slicePathTemplate(e){var[t,r]=e.split(o.h2);return{pathPrefix:t.slice(0,-1),pathSuffix:`{index}${r}`}}function getUtxoAccountPrefixPath({fullPath:e}){var t=e.split("/");return t.pop(),t.pop(),t.join("/")}function getBIP44Path(e,t){var r="";for(var[n,i]of Object.entries(e.addresses))if(i===t){r=n;break}return`${e.path}/${r}`}function estimateTxSize(e,t){return i().transactionBytes(e,t)}},879314:()=>{}}]);