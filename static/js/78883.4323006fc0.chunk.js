(self.webpackChunkweb=self.webpackChunkweb||[]).push([[78883],{940916:(e,t,r)=>{"use strict";r.d(t,{G:()=>m});var n=r(482451),i=r.n(n),s=r(324586),a=r(586330),o=r(230414),u=r(507140),c=r(606777),d=r(401349),l=r(404727),p=r(180556),f=r(929296),y=r(195309),h=r(972715),v=r(901048).Buffer;function _createSuper(e){var t=_isNativeReflectConstruct();return function _createSuperInternal(){var r,n=(0,h.A)(e);if(t){var i=(0,h.A)(this).constructor;r=Reflect.construct(n,arguments,i)}else r=n.apply(this,arguments);return(0,y.A)(this,r)}}function _isNativeReflectConstruct(){try{var e=!Boolean.prototype.valueOf.call(Reflect.construct(Boolean,[],(function(){})))}catch(e){}return(_isNativeReflectConstruct=function(){return!!e})()}var g=function(e){(0,f.A)(ChainSigner,e);var t=_createSuper(ChainSigner);function ChainSigner(e,r,n){var i,s=(0,d.N)(n,{key:e,chainCode:v.alloc(32)},r).key.toString("hex");return(i=t.call(this,s,n)).encryptedPrivateKey=e,i.password=r,i.curve=n,i}var r,n=ChainSigner.prototype;return n.getPrvkey=function getPrvkey(){return Promise.resolve((0,d.Yc)(this.password,this.encryptedPrivateKey))},n.getPrvkeyHex=(r=(0,a.A)((function*(){return c.A.bytesToHex(yield this.getPrvkey())})),function getPrvkeyHex(){return r.apply(this,arguments)}),n.sign=function sign(e){var t=(0,d._S)(this.curve,this.encryptedPrivateKey,e,this.password);return"secp256k1"===this.curve?Promise.resolve([t.slice(0,-1),t[t.length-1]]):Promise.resolve([t,0])},(0,o.A)(ChainSigner)}(function(){function Verifier(e,t){this.curve=t,this.compressedPublicKey=v.from(e,"hex"),this.uncompressedPublicKey=(0,d.sA)(t,this.compressedPublicKey)}var e,t=Verifier.prototype;return t.getPubkey=function getPubkey(e){return Promise.resolve(e?this.compressedPublicKey:this.uncompressedPublicKey)},t.getPubkeyHex=(e=(0,a.A)((function*(e){return c.A.bytesToHex(yield this.getPubkey(e))})),function getPubkeyHex(t){return e.apply(this,arguments)}),t.verify=function verify(){return Promise.resolve(v.from([]))},t.verifySignature=function verifySignature({publicKey:e,digest:t,signature:r}){var n=c.A.toBuffer(e),i=c.A.toBuffer(t),s=c.A.toBuffer(r),{curve:a}=this,o=(0,d.MX)(a,n,i,s);return Promise.resolve(o)},(0,o.A)(Verifier)}());function ownKeys(e,t){var r=Object.keys(e);if(Object.getOwnPropertySymbols){var n=Object.getOwnPropertySymbols(e);t&&(n=n.filter((function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable}))),r.push.apply(r,n)}return r}function _objectSpread(e){for(var t=1;t<arguments.length;t++){var r=null!=arguments[t]?arguments[t]:{};t%2?ownKeys(Object(r),!0).forEach((function(t){(0,s.A)(e,t,r[t])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(r)):ownKeys(Object(r)).forEach((function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(r,t))}))}return e}var m=function(){function CoreChainApiBase(){}var e,t,r,n,s,f,y,h,v=CoreChainApiBase.prototype;return v.baseGetCurve=function baseGetCurve(e){switch(e){case"ed25519":return d.ev;case"secp256k1":return d.bI;case"nistp256":return d.OX;default:throw new u.He("Unsupported curve")}},v.baseCreateSigner=(e=(0,a.A)((function*({curve:e,privateKey:t,password:r}){if(void 0===r)throw new u.He("Software signing requires a password.");var n=c.A.toBuffer(t);return Promise.resolve(new g(n,r,e))})),function baseCreateSigner(t){return e.apply(this,arguments)}),v.baseGetSingleSigner=(t=(0,a.A)((function*({payload:e,curve:t}){var r=yield this.getPrivateKeys(e),n=e.account.path,i=r[n],s=e?.relPaths?.[0];if(!i&&s&&(i=r[[n,s].join("/")]),!i)throw new Error(`No private key found: ${n}`);return this.baseCreateSigner({curve:t,privateKey:i,password:e.password})})),function baseGetSingleSigner(e){return t.apply(this,arguments)}),v.baseGetPrivateKeys=(r=(0,a.A)((function*({payload:e,curve:t}){var{credentials:r,account:n,password:i,relPaths:s}=e,a={};if(r.hd&&r.imported)throw new u.He("getPrivateKeys ERROR: hd and imported credentials can NOT both set.");if(r.hd&&(a=yield this.baseGetPrivateKeysHd({curve:t,account:n,hdCredential:r.hd,password:i,relPaths:s})),r.imported){var{privateKey:o}=(0,d.VV)({password:i,credential:r.imported}),l=c.A.bytesToHex((0,d.w)(i,o));a[n.path]=l,a[""]=l}if(!Object.keys(a).length)throw new Error("No private keys found");return a})),function baseGetPrivateKeys(e){return r.apply(this,arguments)}),v.baseGetPrivateKeysHd=(n=(0,a.A)((function*({curve:e,password:t,account:r,relPaths:n,hdCredential:i}){var{path:s}=r,a=s.split("/"),o=n||[a.pop()],l=a.join("/");if(0===o.length)throw new u.He("getPrivateKeysHd ERROR: relPaths is empty.");return(0,d.Wu)(e,i,t,l,o).reduce((function(e,t){return _objectSpread(_objectSpread({},e),{},{[t.path]:c.A.bytesToHex(t.extendedKey.key)})}),{})})),function baseGetPrivateKeysHd(e){return n.apply(this,arguments)}),v.baseGetAddressesFromHd=(s=(0,a.A)((function*(e,t){var r=this,{curve:n,generateFrom:s}=t,{template:o,hdCredential:l,password:f,indexes:y}=e,{pathPrefix:h,pathSuffix:v}=(0,p.Ah)(o),g=y.map((function(e){return v.replace("{index}",e.toString())})),m="privateKey"===s,b=[],A=[];m?A=(0,d.Wu)(n,l,f,h,g):b=yield(0,d.MJ)({curveName:n,hdCredential:l,password:f,prefix:h,relPaths:g});var w=m?A:b;if(w.length!==y.length)throw new u.He("Unable to get publick key.");var P,C=yield Promise.all(w.map((P=(0,a.A)((function*(t){var n,s,{path:a,extendedKey:{key:o}}=t;if(m){var u=c.A.bytesToHex((0,d.Yc)(f,o));s=yield r.getAddressFromPrivate({networkInfo:e.networkInfo,privateKeyRaw:u,privateKeyInfo:t})}else n=o.toString("hex"),s=yield r.getAddressFromPublic({networkInfo:e.networkInfo,publicKey:n,publicKeyInfo:t});return i()({publicKey:n,path:a},s)})),function(e){return P.apply(this,arguments)})));return{addresses:C}})),function baseGetAddressesFromHd(e,t){return s.apply(this,arguments)}),v.baseGetCredentialsType=function baseGetCredentialsType({credentials:e}){if(e.hd&&e.imported)throw new u.He("getCredentialsType ERROR: hd and imported credentials can NOT both set.");if(e.hd)return l.ECoreCredentialType.hd;if(e.imported)return l.ECoreCredentialType.imported;throw new u.He("getCredentialsType ERROR: no credentials found")},v.baseGetDefaultPrivateKey=(f=(0,a.A)((function*(e){var t=yield this.getPrivateKeys(e),[r]=Object.values(t);return{privateKeyRaw:r}})),function baseGetDefaultPrivateKey(e){return f.apply(this,arguments)}),v.validateXpub=(y=(0,a.A)((function*(e){throw new u.MS})),function validateXpub(e){return y.apply(this,arguments)}),v.validateXprvt=(h=(0,a.A)((function*(e){throw new u.MS})),function validateXprvt(e){return h.apply(this,arguments)}),(0,o.A)(CoreChainApiBase)}()},478883:(e,t,r)=>{"use strict";r.r(t),r.d(t,{default:()=>o});var n=r(230414),i=r(929296),s=r(195309),a=r(972715);function _createSuper(e){var t=_isNativeReflectConstruct();return function _createSuperInternal(){var r,n=(0,a.A)(e);if(t){var i=(0,a.A)(this).constructor;r=Reflect.construct(n,arguments,i)}else r=n.apply(this,arguments);return(0,s.A)(this,r)}}function _isNativeReflectConstruct(){try{var e=!Boolean.prototype.valueOf.call(Reflect.construct(Boolean,[],(function(){})))}catch(e){}return(_isNativeReflectConstruct=function(){return!!e})()}var o=function(e){(0,i.A)(CoreChainHd,e);var t=_createSuper(CoreChainHd);function CoreChainHd(){return t.apply(this,arguments)}return(0,n.A)(CoreChainHd)}(r(561886).A)},561886:(e,t,r)=>{"use strict";r.d(t,{A:()=>b});var n=r(586330),i=r(230414),s=r(929296),a=r(195309),o=r(972715),u=r(495546),c=r.n(u),d=r(507140),l=r(606777),p=r(940916),f=r(401349),y=r(404727),h=r(677139),v=r(94233),g=r(901048).Buffer;function _createSuper(e){var t=_isNativeReflectConstruct();return function _createSuperInternal(){var r,n=(0,o.A)(e);if(t){var i=(0,o.A)(this).constructor;r=Reflect.construct(n,arguments,i)}else r=n.apply(this,arguments);return(0,a.A)(this,r)}}function _isNativeReflectConstruct(){try{var e=!Boolean.prototype.valueOf.call(Reflect.construct(Boolean,[],(function(){})))}catch(e){}return(_isNativeReflectConstruct=function(){return!!e})()}var m="ed25519",b=function(e){(0,s.A)(CoreChainSoftware,e);var t=_createSuper(CoreChainSoftware);function CoreChainSoftware(){return t.apply(this,arguments)}var r,a,o,u,p,b,A,w=CoreChainSoftware.prototype;return w.getExportedSecretKey=(r=(0,n.A)((function*(e){var{password:t,keyType:r}=e,{privateKeyRaw:n}=yield this.baseGetDefaultPrivateKey(e);if(!n)throw new Error("privateKeyRaw is required");if(r===y.ECoreApiExportedSecretKeyType.privateKey)return(0,f.Yc)(t,n).toString("hex");throw new Error(`SecretKey type not support: ${r}`)})),function getExportedSecretKey(e){return r.apply(this,arguments)}),w.getPrivateKeys=(a=(0,n.A)((function*(e){return this.baseGetPrivateKeys({payload:e,curve:m})})),function getPrivateKeys(e){return a.apply(this,arguments)}),w.signTransaction=(o=(0,n.A)((function*(e){var{unsignedTx:{rawTxUnsigned:t}}=e,r=e.unsignedTx.encodedTx,n=yield this.baseGetSingleSigner({payload:e,curve:m});if(!t)throw new d.He("rawTxUnsigned not found");var i=c().boc.Cell.oneFromBoc(t),s=yield i.hash(),[a]=yield n.sign(g.from(s)),o=(0,v.b1)({fromAddress:r.from,signingMessage:i,signature:a,stateInit:(0,v.uu)(r)});return{encodedTx:r,txid:"",rawTx:g.from(yield o.toBoc(!1)).toString("base64")}})),function signTransaction(e){return o.apply(this,arguments)}),w.signMessage=(u=(0,n.A)((function*(e){var t,r=e.unsignedMsg,n=r.payload.isProof?yield(0,v.R_)({message:r.message,timestamp:r.payload.timestamp,address:r.payload.address,appDomain:r.payload.appDomain}):yield(0,v.z3)({message:r.message,schemaCrc:null!=(t=r.payload.schemaCrc)?t:0,timestamp:r.payload.timestamp}),i=yield this.baseGetSingleSigner({payload:e,curve:m}),[s]=yield i.sign(n.bytes);return s.toString("hex")})),function signMessage(e){return u.apply(this,arguments)}),w.getAddressFromPrivate=(p=(0,n.A)((function*(e){var{privateKeyRaw:t}=e,r=l.A.toBuffer(t),n=this.baseGetCurve(m).publicFromPrivate(r);return this.getAddressFromPublic({publicKey:l.A.bytesToHex(n),networkInfo:e.networkInfo,addressEncoding:e.addressEncoding})})),function getAddressFromPrivate(e){return p.apply(this,arguments)}),w.getAddressFromPublic=(b=(0,n.A)((function*(e){var{publicKey:t,addressEncoding:r}=e;return{address:(yield(0,h.H7)(t,r)).nonBounceAddress,publicKey:t,addresses:{}}})),function getAddressFromPublic(e){return b.apply(this,arguments)}),w.getAddressesFromHd=(A=(0,n.A)((function*(e){var t,r=this,{addresses:i}=yield this.baseGetAddressesFromHd(e,{curve:m});return yield Promise.all(i.map((t=(0,n.A)((function*(t){var n=yield r.getAddressFromPublic({publicKey:t.publicKey,networkInfo:e.networkInfo,addressEncoding:e.addressEncoding});Object.assign(t,n)})),function(e){return t.apply(this,arguments)}))),{addresses:i}})),function getAddressesFromHd(e){return A.apply(this,arguments)}),(0,i.A)(CoreChainSoftware)}(p.G)},677139:(e,t,r)=>{"use strict";r.d(t,{Fe:()=>genAddressFromAddress,H7:()=>genAddressFromPublicKey,uu:()=>o.uu,b1:()=>o.b1});var n=r(586330),i=r(495546),s=r.n(i),a=r(901048).Buffer;function genAddressFromPublicKey(e){return _genAddressFromPublicKey.apply(this,arguments)}function _genAddressFromPublicKey(){return(_genAddressFromPublicKey=(0,n.A)((function*(e,t="v3R2"){var r=new(s().Wallets.all[t])(void 0,{publicKey:a.from(e,"hex")}),n=yield r.getAddress();return{normalAddress:n.toString(!1,!1,!1),nonBounceAddress:n.toString(!0,!0,!1),bounceAddress:n.toString(!0,!0,!0)}}))).apply(this,arguments)}function genAddressFromAddress(e){return _genAddressFromAddress.apply(this,arguments)}function _genAddressFromAddress(){return(_genAddressFromAddress=(0,n.A)((function*(e){var t=new(s().Address)(e);return{normalAddress:t.toString(!1,!1,!1),nonBounceAddress:t.toString(!0,!0,!1),bounceAddress:t.toString(!0,!0,!0)}}))).apply(this,arguments)}var o=r(94233)},94233:(e,t,r)=>{"use strict";r.d(t,{R_:()=>serializeProof,b1:()=>serializeSignedTx,uu:()=>getStateInitFromEncodedTx,z3:()=>serializeData});var n=r(586330),i=r(495546),s=r.n(i),a=r(401349),o=r(901048).Buffer;function serializeSignedTx({fromAddress:e,signingMessage:t,signature:r,stateInit:n}){var i=new(s().boc.Cell);i.bits.writeBytes(r),i.writeCell(t);var a=s().Contract.createExternalMessageHeader(e);return s().Contract.createCommonMsgInfo(a,n,i)}function getStateInitFromEncodedTx(e){var t=e.messages.find((function(e){return!!e.stateInit}));if(t&&t.stateInit)return s().boc.Cell.oneFromBoc(o.from(t.stateInit,"base64").toString("hex"))}function serializeData(e){return _serializeData.apply(this,arguments)}function _serializeData(){return(_serializeData=(0,n.A)((function*({message:e,schemaCrc:t,timestamp:r}){var n=o.alloc(12);n.writeUInt32BE(t,0),n.writeBigUInt64BE(BigInt(r),0);var i=s().boc.Cell.oneFromBoc(o.from(e,"base64").toString("hex")),a=o.concat([n,yield i.hash()]);return{cell:i,bytes:a}}))).apply(this,arguments)}function serializeProof(e){return _serializeProof.apply(this,arguments)}function _serializeProof(){return(_serializeProof=(0,n.A)((function*({address:e,appDomain:t,timestamp:r,message:n}){var i=o.from("ffff","hex");i=o.concat([i,o.from("ton-connect","utf-8")]);var u=o.from("ton-proof-item-v2/","utf-8"),c=new(s().Address)(e),d=o.alloc(4);d.writeUInt32BE(c.wc,0);var l=o.from(t,"utf-8"),p=o.alloc(4);p.writeUInt32LE(l.length,0);var f=o.alloc(8);f.writeBigUInt64LE(BigInt(r),0),u=o.concat([u,d,c.hashPart,p,l,f,o.from(n,"utf-8")]);var y=(0,a.sc)(u);return{msg:u,bytes:(0,a.sc)(o.concat([i,y]))}}))).apply(this,arguments)}},180556:(e,t,r)=>{"use strict";r.d(t,{Ac:()=>estimateTxSize,Ah:()=>slicePathTemplate,vN:()=>getUtxoAccountPrefixPath,zf:()=>getBIP44Path});var n=r(90366),i=r.n(n),s=r(928557);function slicePathTemplate(e){var[t,r]=e.split(s.h2);return{pathPrefix:t.slice(0,-1),pathSuffix:`{index}${r}`}}function getUtxoAccountPrefixPath({fullPath:e}){var t=e.split("/");return t.pop(),t.pop(),t.join("/")}function getBIP44Path(e,t){var r="";for(var[n,i]of Object.entries(e.addresses))if(i===t){r=n;break}return`${e.path}/${r}`}function estimateTxSize(e,t){return i().transactionBytes(e,t)}},90366:e=>{var t=10,r=41,n=107,i=9,s=25,a=10;function inputBytes(e){return r+(e.script?e.script.length:n)}function outputBytes(e){return e.script?a+e.script.length+(e.script.length>=74?2:1):i+(e.script?e.script.length:s)}function dustThreshold(e,t){return 3*inputBytes({})}function transactionBytes(e,r){return t+e.reduce((function(e,t){return e+inputBytes(t)}),0)+r.reduce((function(e,t){return e+outputBytes(t)}),0)}function uintOrNaN(e){return"number"!=typeof e?NaN:isFinite(e)?Math.floor(e)!==e||e<0?NaN:e:NaN}function sumOrNaN(e){return e.reduce((function(e,t){return e+uintOrNaN(t.value)}),0)}var o=outputBytes({});e.exports={dustThreshold,finalize:function finalize(e,t,r){var n=transactionBytes(e,t),i=r*(n+o),s=sumOrNaN(e)-(sumOrNaN(t)+i);s>dustThreshold()&&(t=t.concat({value:s}));var a=sumOrNaN(e)-sumOrNaN(t);return isFinite(a)?{inputs:e,outputs:t,fee:a}:{fee:r*n}},inputBytes,outputBytes,sumOrNaN,sumForgiving:function sumForgiving(e){return e.reduce((function(e,t){return e+(isFinite(t.value)?t.value:0)}),0)},transactionBytes,uintOrNaN}}}]);