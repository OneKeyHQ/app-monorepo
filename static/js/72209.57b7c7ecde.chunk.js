(self.webpackChunkweb=self.webpackChunkweb||[]).push([[72209],{940916:(e,t,r)=>{"use strict";r.d(t,{G:()=>b});var n=r(482451),i=r.n(n),o=r(324586),s=r(586330),a=r(230414),u=r(507140),c=r(606777),p=r(401349),f=r(404727),l=r(180556),y=r(929296),d=r(195309),h=r(972715),v=r(901048).Buffer;function _createSuper(e){var t=_isNativeReflectConstruct();return function _createSuperInternal(){var r,n=(0,h.A)(e);if(t){var i=(0,h.A)(this).constructor;r=Reflect.construct(n,arguments,i)}else r=n.apply(this,arguments);return(0,d.A)(this,r)}}function _isNativeReflectConstruct(){try{var e=!Boolean.prototype.valueOf.call(Reflect.construct(Boolean,[],(function(){})))}catch(e){}return(_isNativeReflectConstruct=function(){return!!e})()}var g=function(e){(0,y.A)(ChainSigner,e);var t=_createSuper(ChainSigner);function ChainSigner(e,r,n){var i,o=(0,p.N)(n,{key:e,chainCode:v.alloc(32)},r).key.toString("hex");return(i=t.call(this,o,n)).encryptedPrivateKey=e,i.password=r,i.curve=n,i}var r,n=ChainSigner.prototype;return n.getPrvkey=function getPrvkey(){return Promise.resolve((0,p.Yc)(this.password,this.encryptedPrivateKey))},n.getPrvkeyHex=(r=(0,s.A)((function*(){return c.A.bytesToHex(yield this.getPrvkey())})),function getPrvkeyHex(){return r.apply(this,arguments)}),n.sign=function sign(e){var t=(0,p._S)(this.curve,this.encryptedPrivateKey,e,this.password);return"secp256k1"===this.curve?Promise.resolve([t.slice(0,-1),t[t.length-1]]):Promise.resolve([t,0])},(0,a.A)(ChainSigner)}(function(){function Verifier(e,t){this.curve=t,this.compressedPublicKey=v.from(e,"hex"),this.uncompressedPublicKey=(0,p.sA)(t,this.compressedPublicKey)}var e,t=Verifier.prototype;return t.getPubkey=function getPubkey(e){return Promise.resolve(e?this.compressedPublicKey:this.uncompressedPublicKey)},t.getPubkeyHex=(e=(0,s.A)((function*(e){return c.A.bytesToHex(yield this.getPubkey(e))})),function getPubkeyHex(t){return e.apply(this,arguments)}),t.verify=function verify(){return Promise.resolve(v.from([]))},t.verifySignature=function verifySignature({publicKey:e,digest:t,signature:r}){var n=c.A.toBuffer(e),i=c.A.toBuffer(t),o=c.A.toBuffer(r),{curve:s}=this,a=(0,p.MX)(s,n,i,o);return Promise.resolve(a)},(0,a.A)(Verifier)}());function ownKeys(e,t){var r=Object.keys(e);if(Object.getOwnPropertySymbols){var n=Object.getOwnPropertySymbols(e);t&&(n=n.filter((function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable}))),r.push.apply(r,n)}return r}function _objectSpread(e){for(var t=1;t<arguments.length;t++){var r=null!=arguments[t]?arguments[t]:{};t%2?ownKeys(Object(r),!0).forEach((function(t){(0,o.A)(e,t,r[t])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(r)):ownKeys(Object(r)).forEach((function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(r,t))}))}return e}var b=function(){function CoreChainApiBase(){}var e,t,r,n,o,y,d,h,v=CoreChainApiBase.prototype;return v.baseGetCurve=function baseGetCurve(e){switch(e){case"ed25519":return p.ev;case"secp256k1":return p.bI;case"nistp256":return p.OX;default:throw new u.He("Unsupported curve")}},v.baseCreateSigner=(e=(0,s.A)((function*({curve:e,privateKey:t,password:r}){if(void 0===r)throw new u.He("Software signing requires a password.");var n=c.A.toBuffer(t);return Promise.resolve(new g(n,r,e))})),function baseCreateSigner(t){return e.apply(this,arguments)}),v.baseGetSingleSigner=(t=(0,s.A)((function*({payload:e,curve:t}){var r=yield this.getPrivateKeys(e),n=e.account.path,i=r[n],o=e?.relPaths?.[0];if(!i&&o&&(i=r[[n,o].join("/")]),!i)throw new Error(`No private key found: ${n}`);return this.baseCreateSigner({curve:t,privateKey:i,password:e.password})})),function baseGetSingleSigner(e){return t.apply(this,arguments)}),v.baseGetPrivateKeys=(r=(0,s.A)((function*({payload:e,curve:t}){var{credentials:r,account:n,password:i,relPaths:o}=e,s={};if(r.hd&&r.imported)throw new u.He("getPrivateKeys ERROR: hd and imported credentials can NOT both set.");if(r.hd&&(s=yield this.baseGetPrivateKeysHd({curve:t,account:n,hdCredential:r.hd,password:i,relPaths:o})),r.imported){var{privateKey:a}=(0,p.VV)({password:i,credential:r.imported}),f=c.A.bytesToHex((0,p.w)(i,a));s[n.path]=f,s[""]=f}if(!Object.keys(s).length)throw new Error("No private keys found");return s})),function baseGetPrivateKeys(e){return r.apply(this,arguments)}),v.baseGetPrivateKeysHd=(n=(0,s.A)((function*({curve:e,password:t,account:r,relPaths:n,hdCredential:i}){var{path:o}=r,s=o.split("/"),a=n||[s.pop()],f=s.join("/");if(0===a.length)throw new u.He("getPrivateKeysHd ERROR: relPaths is empty.");return(0,p.Wu)(e,i,t,f,a).reduce((function(e,t){return _objectSpread(_objectSpread({},e),{},{[t.path]:c.A.bytesToHex(t.extendedKey.key)})}),{})})),function baseGetPrivateKeysHd(e){return n.apply(this,arguments)}),v.baseGetAddressesFromHd=(o=(0,s.A)((function*(e,t){var r=this,{curve:n,generateFrom:o}=t,{template:a,hdCredential:f,password:y,indexes:d}=e,{pathPrefix:h,pathSuffix:v}=(0,l.Ah)(a),g=d.map((function(e){return v.replace("{index}",e.toString())})),b="privateKey"===o,P=[],w=[];b?w=(0,p.Wu)(n,f,y,h,g):P=yield(0,p.MJ)({curveName:n,hdCredential:f,password:y,prefix:h,relPaths:g});var A=b?w:P;if(A.length!==d.length)throw new u.He("Unable to get publick key.");var m,C=yield Promise.all(A.map((m=(0,s.A)((function*(t){var n,o,{path:s,extendedKey:{key:a}}=t;if(b){var u=c.A.bytesToHex((0,p.Yc)(y,a));o=yield r.getAddressFromPrivate({networkInfo:e.networkInfo,privateKeyRaw:u,privateKeyInfo:t})}else n=a.toString("hex"),o=yield r.getAddressFromPublic({networkInfo:e.networkInfo,publicKey:n,publicKeyInfo:t});return i()({publicKey:n,path:s},o)})),function(e){return m.apply(this,arguments)})));return{addresses:C}})),function baseGetAddressesFromHd(e,t){return o.apply(this,arguments)}),v.baseGetCredentialsType=function baseGetCredentialsType({credentials:e}){if(e.hd&&e.imported)throw new u.He("getCredentialsType ERROR: hd and imported credentials can NOT both set.");if(e.hd)return f.ECoreCredentialType.hd;if(e.imported)return f.ECoreCredentialType.imported;throw new u.He("getCredentialsType ERROR: no credentials found")},v.baseGetDefaultPrivateKey=(y=(0,s.A)((function*(e){var t=yield this.getPrivateKeys(e),[r]=Object.values(t);return{privateKeyRaw:r}})),function baseGetDefaultPrivateKey(e){return y.apply(this,arguments)}),v.validateXpub=(d=(0,s.A)((function*(e){throw new u.MS})),function validateXpub(e){return d.apply(this,arguments)}),v.validateXprvt=(h=(0,s.A)((function*(e){throw new u.MS})),function validateXprvt(e){return h.apply(this,arguments)}),(0,a.A)(CoreChainApiBase)}()},772209:(e,t,r)=>{"use strict";r.r(t),r.d(t,{default:()=>a});var n=r(230414),i=r(929296),o=r(195309),s=r(972715);function _createSuper(e){var t=_isNativeReflectConstruct();return function _createSuperInternal(){var r,n=(0,s.A)(e);if(t){var i=(0,s.A)(this).constructor;r=Reflect.construct(n,arguments,i)}else r=n.apply(this,arguments);return(0,o.A)(this,r)}}function _isNativeReflectConstruct(){try{var e=!Boolean.prototype.valueOf.call(Reflect.construct(Boolean,[],(function(){})))}catch(e){}return(_isNativeReflectConstruct=function(){return!!e})()}var a=function(e){(0,i.A)(CoreChainImported,e);var t=_createSuper(CoreChainImported);function CoreChainImported(){return t.apply(this,arguments)}return(0,n.A)(CoreChainImported)}(r(411736).A)},411736:(e,t,r)=>{"use strict";r.d(t,{A:()=>P});var n=r(324586),i=r(230414),o=r(929296),s=r(195309),a=r(972715),u=r(586330),c=r(89729),p=r(909115),f=r.n(p),l=r(401349),y=r(507140),d=r(606777),h=r(940916),v=r(404727),g=r(901048).Buffer;function ownKeys(e,t){var r=Object.keys(e);if(Object.getOwnPropertySymbols){var n=Object.getOwnPropertySymbols(e);t&&(n=n.filter((function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable}))),r.push.apply(r,n)}return r}function _objectSpread(e){for(var t=1;t<arguments.length;t++){var r=null!=arguments[t]?arguments[t]:{};t%2?ownKeys(Object(r),!0).forEach((function(t){(0,n.A)(e,t,r[t])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(r)):ownKeys(Object(r)).forEach((function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(r,t))}))}return e}function _createSuper(e){var t=_isNativeReflectConstruct();return function _createSuperInternal(){var r,n=(0,a.A)(e);if(t){var i=(0,a.A)(this).constructor;r=Reflect.construct(n,arguments,i)}else r=n.apply(this,arguments);return(0,s.A)(this,r)}}function _isNativeReflectConstruct(){try{var e=!Boolean.prototype.valueOf.call(Reflect.construct(Boolean,[],(function(){})))}catch(e){}return(_isNativeReflectConstruct=function(){return!!e})()}var b="secp256k1";function _signTransaction(){return(_signTransaction=(0,u.A)((function*(e,t){var r=e.encodedTx,[n,i]=yield t.sign(g.from(r.txID,"hex")),o={encodedTx:e.encodedTx,txid:r.txID,rawTx:JSON.stringify(_objectSpread(_objectSpread({},r),{},{signature:[g.concat([n,g.from([i])]).toString("hex")]}))};return Promise.resolve(o)}))).apply(this,arguments)}var P=function(e){(0,o.A)(CoreChainSoftware,e);var t=_createSuper(CoreChainSoftware);function CoreChainSoftware(){return t.apply(this,arguments)}var r,n,s,a,p,h,P,w=CoreChainSoftware.prototype;return w.getExportedSecretKey=(r=(0,u.A)((function*(e){var{password:t,keyType:r,credentials:n}=e,{privateKeyRaw:i}=yield this.baseGetDefaultPrivateKey(e);if(!i)throw new Error("privateKeyRaw is required");if(r===v.ECoreApiExportedSecretKeyType.privateKey)return(0,l.Yc)(t,i).toString("hex");throw new Error(`SecretKey type not support: ${r}`)})),function getExportedSecretKey(e){return r.apply(this,arguments)}),w.getPrivateKeys=(n=(0,u.A)((function*(e){return this.baseGetPrivateKeys({payload:e,curve:b})})),function getPrivateKeys(e){return n.apply(this,arguments)}),w.signTransaction=(s=(0,u.A)((function*(e){var{unsignedTx:t}=e;return function _signTransaction2(e,t){return _signTransaction.apply(this,arguments)}(t,yield this.baseGetSingleSigner({payload:e,curve:b}))})),function signTransaction(e){return s.apply(this,arguments)}),w.signMessage=(a=(0,u.A)((function*(){throw new y.MS})),function signMessage(){return a.apply(this,arguments)}),w.getAddressFromPrivate=(p=(0,u.A)((function*(e){var{privateKeyRaw:t}=e,r=d.A.toBuffer(t),n=this.baseGetCurve(b).publicFromPrivate(r);return this.getAddressFromPublic({publicKey:d.A.bytesToHex(n),networkInfo:e.networkInfo})})),function getAddressFromPrivate(e){return p.apply(this,arguments)}),w.getAddressFromPublic=(h=(0,u.A)((function*(e){var{publicKey:t}=e,r=function publicKeyToAddress(e){var t=(0,l.sA)(b,g.from(e,"hex"));return f().address.fromHex(`41${(0,c.keccak256)(t.slice(-64)).slice(-40)}`)}(t);return Promise.resolve({address:r,publicKey:t})})),function getAddressFromPublic(e){return h.apply(this,arguments)}),w.getAddressesFromHd=(P=(0,u.A)((function*(e){return this.baseGetAddressesFromHd(e,{curve:b})})),function getAddressesFromHd(e){return P.apply(this,arguments)}),(0,i.A)(CoreChainSoftware)}(h.G)},180556:(e,t,r)=>{"use strict";r.d(t,{Ac:()=>estimateTxSize,Ah:()=>slicePathTemplate,vN:()=>getUtxoAccountPrefixPath,zf:()=>getBIP44Path});var n=r(90366),i=r.n(n),o=r(928557);function slicePathTemplate(e){var[t,r]=e.split(o.h2);return{pathPrefix:t.slice(0,-1),pathSuffix:`{index}${r}`}}function getUtxoAccountPrefixPath({fullPath:e}){var t=e.split("/");return t.pop(),t.pop(),t.join("/")}function getBIP44Path(e,t){var r="";for(var[n,i]of Object.entries(e.addresses))if(i===t){r=n;break}return`${e.path}/${r}`}function estimateTxSize(e,t){return i().transactionBytes(e,t)}},90366:e=>{var t=10,r=41,n=107,i=9,o=25,s=10;function inputBytes(e){return r+(e.script?e.script.length:n)}function outputBytes(e){return e.script?s+e.script.length+(e.script.length>=74?2:1):i+(e.script?e.script.length:o)}function dustThreshold(e,t){return 3*inputBytes({})}function transactionBytes(e,r){return t+e.reduce((function(e,t){return e+inputBytes(t)}),0)+r.reduce((function(e,t){return e+outputBytes(t)}),0)}function uintOrNaN(e){return"number"!=typeof e?NaN:isFinite(e)?Math.floor(e)!==e||e<0?NaN:e:NaN}function sumOrNaN(e){return e.reduce((function(e,t){return e+uintOrNaN(t.value)}),0)}var a=outputBytes({});e.exports={dustThreshold,finalize:function finalize(e,t,r){var n=transactionBytes(e,t),i=r*(n+a),o=sumOrNaN(e)-(sumOrNaN(t)+i);o>dustThreshold()&&(t=t.concat({value:o}));var s=sumOrNaN(e)-sumOrNaN(t);return isFinite(s)?{inputs:e,outputs:t,fee:s}:{fee:r*n}},inputBytes,outputBytes,sumOrNaN,sumForgiving:function sumForgiving(e){return e.reduce((function(e,t){return e+(isFinite(t.value)?t.value:0)}),0)},transactionBytes,uintOrNaN}}}]);