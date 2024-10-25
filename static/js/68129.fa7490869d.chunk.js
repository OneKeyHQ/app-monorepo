"use strict";(self.webpackChunkweb=self.webpackChunkweb||[]).push([[68129],{389587:(e,t,r)=>{r.d(t,{K:()=>n});var n=80},82506:(e,t,r)=>{r.d(t,{d:()=>useDebounce});var n=r(578104);function useDebounce(e,t,r){var[a]=(0,n.d7)(e,t,r);return a}},471230:(e,t,r)=>{r.d(t,{YG:()=>h,U9:()=>a.U});r(490343),r(791088),r(392097);var n=r(498356);r(831085);var a=r(952954),o=r(324586),i=r(586330),s=r(514041),l=r(259227),c=r(318822),d=(r(334439),r(663522)),u=r(584186),f=r(610421),m=r(131397),p=r(621591);function ownKeys(e,t){var r=Object.keys(e);if(Object.getOwnPropertySymbols){var n=Object.getOwnPropertySymbols(e);t&&(n=n.filter((function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable}))),r.push.apply(r,n)}return r}function _objectSpread(e){for(var t=1;t<arguments.length;t++){var r=null!=arguments[t]?arguments[t]:{};t%2?ownKeys(Object(r),!0).forEach((function(t){(0,o.A)(e,t,r[t])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(r)):ownKeys(Object(r)).forEach((function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(r,t))}))}return e}var b=0,g=!1,y=!1;var h=(0,s.memo)((function OnboardingOnMountCmp(){var e=(0,m.t1)(),t=(0,n.A)(),r=(0,p.D)(),[a,o]=(0,l.useV4migrationPersistAtom)(),h=a?.downgradeWarningConfirmed;(0,s.useRef)(h).current=h;var v=(0,s.useCallback)((0,i.A)((function*(){(yield f.A.serviceV4Migration.checkShouldMigrateV4OnMount())&&(g||(g=!0,yield f.A.serviceV4Migration.migrateBaseSettings()))})),[]),w=(0,s.useCallback)((0,i.A)((function*({checkingV4Migration:t}={}){try{if(t)if(yield f.A.serviceV4Migration.checkShouldMigrateV4OnMount()){if(yield v(),yield u.A.wait(600),!y){y=!0,yield r.navigateToV4MigrationPage({isAutoStartOnMount:!0});var n=Date.now();n-b>3e3&&(b=n,o((function(e){return _objectSpread(_objectSpread({},e),{},{v4migrationAutoStartCount:(e.v4migrationAutoStartCount||0)+1})})))}return}}catch(e){}if(!(0,m.p1)()){var{isOnboardingDone:a}=yield f.A.serviceOnboarding.isOnboardingDone();a||d.Ay.isWebDappMode||e({isFullModal:!0})}})),[v,o,e,r]),k=(0,s.useCallback)((0,i.A)((function*(){yield w({checkingV4Migration:!0})})),[w,v,o]);return(0,s.useEffect)((function(){}),[]),(0,s.useEffect)((function(){}),[o]),(0,s.useEffect)((function(){}),[t]),(0,s.useEffect)((function(){}),[r]),(0,s.useEffect)((function(){k()}),[k]),(0,s.useEffect)((function(){var fn=function(){w({checkingV4Migration:!1})};return c.iL.on(c.Tu.WalletClear,fn),function(){c.iL.off(c.Tu.WalletClear,fn)}}),[w]),null}))},68129:(e,t,r)=>{r.r(t),r.d(t,{default:()=>I});var n=r(586330),a=r(514041),o=r(908867),i=r(490343),s=r(610421),l=r(325809),c=r(575995),d=r(660395),u=r(370968),f=r(389587),m=r(498356),p=r(82506),b=r(911998),g=r(162616),y=r(834015),h=r(625931),v=r(181447),w=r(334439),k=r(948675),A=r(714191),E=r(471230),x=r(831085),j=function(e){return e.Address="Address",e.PublicKey="PublicKey",e}(j||{}),FormDeriveTypeInput=function({networkId:e,deriveInfoItems:t,fieldName:r}){var n=(0,o.A)();return(0,x.jsx)(i.Stack,{mt:"$2",children:(0,x.jsx)(i.Form.Field,{label:n.formatMessage({id:w.ETranslations.derivation_path}),name:r,children:(0,x.jsx)(c.l$,{networkId:e,enabledItems:t,renderTrigger:function({label:e,onPress:t}){return(0,x.jsxs)(i.Stack,{testID:"derive-type-input",userSelect:"none",flexDirection:"row",px:"$3.5",py:"$2.5",borderWidth:1,borderColor:"$borderStrong",borderRadius:"$3",$gtMd:{px:"$3",py:"$1.5",borderRadius:"$2"},borderCurve:"continuous",hoverStyle:{bg:"$bgHover"},pressStyle:{bg:"$bgActive"},onPress:t,children:[(0,x.jsx)(i.SizableText,{flex:1,children:e}),(0,x.jsx)(i.Icon,{name:"ChevronDownSmallOutline",color:"$iconSubdued",mr:"$-0.5"})]})}})})})};function ImportAddress(){var e=(0,o.A)(),t=(0,i.useMedia)(),r=(0,m.A)(),{result:c}=(0,b.yk)((0,n.A)((function*(){var e=yield s.A.serviceNetwork.getPublicKeyExportOrWatchingAccountEnabledNetworks(),t=e.map((function(e){return e.network.id})),r=e.filter((function(e){return e.publicKeyExportEnabled})).map((function(e){return e.network.id})),n=e.filter((function(e){return e.watchingAccountEnabled})).map((function(e){return e.network.id}));return{networkIds:t,publicKeyExportEnabled:new Set(r),watchingAccountEnabled:new Set(n)}})),[],{initResult:{networkIds:[],publicKeyExportEnabled:new Set([]),watchingAccountEnabled:new Set([])}}),A=(0,g.z$)(),[I,M]=(0,a.useState)(j.Address),{activeAccount:{network:S}}=(0,d.w)({num:0}),{onPasteClearText:_}=(0,i.useClipboard)(),T=(0,i.useForm)({values:{networkId:S?.id&&S.id!==(0,h.V)().onekeyall?S?.id:(0,h.V)().btc,deriveType:void 0,publicKeyValue:"",addressValue:{raw:"",resolved:void 0},accountName:""},mode:"onChange",reValidateMode:"onBlur"}),{setValue:O,control:V}=T,[P,C]=(0,a.useState)(),K=(0,a.useRef)(!1),F=(0,i.useFormWatch)({control:V,name:"networkId"}),D=(0,i.useFormWatch)({control:V,name:"publicKeyValue"}),N=(0,i.useFormWatch)({control:V,name:"addressValue"}),$=(0,i.useFormWatch)({control:V,name:"accountName"}),W=(0,p.d)(D.trim(),600),R=(0,p.d)($?.trim()||"",600),z=(0,a.useCallback)((0,n.A)((function*(){if(R)try{yield s.A.serviceAccount.ensureAccountNameNotDuplicate({name:R,walletId:v.Hk}),T.clearErrors("accountName")}catch(e){T.setError("accountName",{message:e?.message})}else T.clearErrors("accountName");if(O("deriveType",void 0),W&&F){var e=yield s.A.servicePassword.encodeSensitiveText({text:W});try{if(!c.publicKeyExportEnabled.has(F))throw new Error(`Network not supported: ${F}`);var t=yield s.A.serviceAccount.validateGeneralInputOfImporting({input:e,networkId:F,validateXpub:!0});C(t)}catch(e){C({isValid:!1})}}else C(void 0)})),[R,O,W,F,T,c.publicKeyExportEnabled]);(0,a.useEffect)((function(){(0,n.A)((function*(){try{K.current=!0,yield z()}finally{K.current=!1}}))()}),[z]);var H,{start:B}=(0,y.A)(),U=(T.watch("deriveType"),(0,a.useMemo)((function(){return!Object.values(T.formState.errors).length&&(I===j.Address?!N.pending&&T.formState.isValid:P?.isValid)}),[I,N.pending,P,T.formState])),L=(0,a.useMemo)((function(){return F&&c.publicKeyExportEnabled.has(F)}),[F,c.publicKeyExportEnabled]),q=(0,a.useMemo)((function(){return I===j.PublicKey&&L}),[I,L]);return(0,x.jsxs)(i.Page,{scrollEnabled:!0,children:[(0,x.jsx)(i.Page.Header,{title:e.formatMessage({id:w.ETranslations.global_import_address})}),(0,x.jsxs)(i.Page.Body,{px:"$5",children:[(0,x.jsxs)(i.Form,{form:T,children:[(0,x.jsx)(i.Form.Field,{label:e.formatMessage({id:w.ETranslations.global_network}),name:"networkId",children:(0,x.jsx)(l.YS,{networkIds:c.networkIds})}),L?(0,x.jsx)(i.SegmentControl,{fullWidth:!0,value:I,onChange:function(e){M(e)},options:[{label:e.formatMessage({id:w.ETranslations.global_address}),value:j.Address,testID:"import-address-address"},{label:e.formatMessage({id:w.ETranslations.global_public_key}),value:j.PublicKey,testID:"import-address-publicKey"}]}):null,q?(0,x.jsxs)(x.Fragment,{children:[(0,x.jsx)(i.Form.Field,{label:e.formatMessage({id:w.ETranslations.global_public_key}),name:"publicKeyValue",children:(0,x.jsx)(i.Input,{secureTextEntry:!1,placeholder:e.formatMessage({id:w.ETranslations.form_public_key_placeholder}),testID:"import-address-input",size:t.gtMd?"medium":"large",onPaste:_,addOns:[{iconName:"ScanOutline",onPress:(H=(0,n.A)((function*(){var e=yield B({handlers:[],autoHandleResult:!1});T.setValue("publicKeyValue",e.raw)})),function onPress(){return H.apply(this,arguments)})}]})}),P?.deriveInfoItems?(0,x.jsx)(FormDeriveTypeInput,{fieldName:"deriveType",networkId:T.getValues().networkId||"",deriveInfoItems:P?.deriveInfoItems||[]}):null,(0,x.jsx)(x.Fragment,{children:P&&!P?.isValid&&W?(0,x.jsx)(i.SizableText,{size:"$bodyMd",color:"$textCritical",children:e.formatMessage({id:w.ETranslations.form_public_key_error_invalid})}):null})]}):null,q?null:(0,x.jsx)(x.Fragment,{children:(0,x.jsx)(i.Form.Field,{label:e.formatMessage({id:w.ETranslations.global_address}),name:"addressValue",rules:{validate:(0,u.j)({defaultErrorMessage:e.formatMessage({id:w.ETranslations.form_address_error_invalid})})},children:(0,x.jsx)(u.N,{placeholder:e.formatMessage({id:w.ETranslations.form_address_placeholder}),networkId:null!=F?F:"",testID:"import-address-input"})})}),(0,x.jsx)(i.Form.Field,{label:e.formatMessage({id:w.ETranslations.form_enter_account_name}),name:"accountName",children:(0,x.jsx)(i.Input,{maxLength:f.K,placeholder:e.formatMessage({id:w.ETranslations.form_enter_account_name_placeholder})})})]}),(0,x.jsx)(E.U9,{list:[{title:e.formatMessage({id:w.ETranslations.faq_watched_account}),description:e.formatMessage({id:w.ETranslations.faq_watched_account_desc})}]}),null]}),(0,x.jsx)(i.Page.Footer,{confirmButtonProps:{disabled:!U},onConfirm:(0,n.A)((function*(){var t;yield T.handleSubmit((t=(0,n.A)((function*(t){var n,a,o,l,c=q?{name:t.accountName,input:null!=(n=t.publicKeyValue)?n:"",networkId:null!=(a=t.networkId)?a:"",deriveType:t.deriveType,shouldCheckDuplicateName:!0}:{name:t.accountName,input:null!=(o=t.addressValue.resolved)?o:"",networkId:null!=(l=t.networkId)?l:"",shouldCheckDuplicateName:!0},d=yield s.A.serviceAccount.addWatchingAccount(c),u=d?.accounts?.[0]?.id;u&&i.Toast.success({title:e.formatMessage({id:w.ETranslations.global_success})}),A.current.updateSelectedAccountForSingletonAccount({num:0,networkId:t.networkId,walletId:v.Hk,othersWalletAccountId:u}),r.popStack(),k.U.account.wallet.importWallet({importMethod:"address"})})),function(e){return t.apply(this,arguments)}))()}))})]})}const I=function ImportAddressPage(){return(0,x.jsx)(l.b8,{config:{sceneName:A.Zs.home},enabledNum:[0],children:(0,x.jsx)(ImportAddress,{})})}}}]);