"use strict";(self.webpackChunkweb=self.webpackChunkweb||[]).push([[21732],{82506:(e,n,t)=>{t.d(n,{d:()=>useDebounce});var r=t(578104);function useDebounce(e,n,t){var[o]=(0,r.d7)(e,n,t);return o}},278484:(e,n,t)=>{t.d(n,{wI:()=>DAppAccountListItem,ZY:()=>DAppAccountListStandAloneItem,X1:()=>DAppAccountListStandAloneItemForHomeScene,VV:()=>WalletConnectAccountTriggerList});var r=t(460986),o=t.n(r),c=t(324586),s=t(586330),a=t(514041),i=t(908867),u=t(17617),d=t(490343),l=t(610421),p=t(325809),g=t(237532),m=t(24284),A=t(911998),f=t(162616),S=t(226952),h=t(334439),y=(t(663522),t(584186)),_=t(714191),b=t(82506);var x=t(831085);function ownKeys(e,n){var t=Object.keys(e);if(Object.getOwnPropertySymbols){var r=Object.getOwnPropertySymbols(e);n&&(r=r.filter((function(n){return Object.getOwnPropertyDescriptor(e,n).enumerable}))),t.push.apply(t,r)}return t}function _objectSpread(e){for(var n=1;n<arguments.length;n++){var t=null!=arguments[n]?arguments[n]:{};n%2?ownKeys(Object(t),!0).forEach((function(n){(0,c.A)(e,n,t[n])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(t)):ownKeys(Object(t)).forEach((function(n){Object.defineProperty(e,n,Object.getOwnPropertyDescriptor(t,n))}))}return e}function DAppAccountListInitFromHome({num:e,shouldSyncFromHome:n}){var[,t]=(0,f.K7)(),r=(0,f.z$)();return(0,a.useEffect)((function(){return(0,s.A)((function*(){try{t((function(n){return _objectSpread(_objectSpread({},n),{},{[e]:{isLoading:!0}})})),yield y.A.wait(600),n&&(yield r.current.syncFromScene({from:{sceneName:_.Zs.home,sceneNum:0},num:e}))}finally{n&&(yield y.A.wait(300)),t((function(n){return _objectSpread(_objectSpread({},n),{},{[e]:{isLoading:!1}})}))}}))(),function(){t((function(n){return _objectSpread(_objectSpread({},n),{},{[e]:{isLoading:!1}})}))}}),[r,e,t,n]),null}function DAppAccountListItem({num:e,handleAccountChanged:n,readonly:t,networkReadonly:r,compressionUiMode:o,initFromHome:c,beforeShowTrigger:s,skeletonRenderDuration:i}){!function useHandleDiscoveryAccountChanged({num:e,handleAccountChanged:n}){var{activeAccount:t}=(0,f.LH)({num:e}),{selectedAccount:r}=(0,f.wz)({num:e}),o=(0,b.d)(t,200),c=(0,b.d)(r,200),s=(0,a.useRef)(t),i=(0,a.useRef)(r);(0,a.useEffect)((function(){s.current=t,i.current=r}),[t,r]),(0,a.useEffect)((function(){n&&(o.isOthersWallet&&o.account?.id===c.othersWalletAccountId||o.indexedAccount?.id===c.indexedAccountId)&&n({activeAccount:s.current,selectedAccount:i.current},e)}),[o,c,n,e])}({num:e,handleAccountChanged:n});var l=Boolean(c&&!t);return(0,x.jsxs)(x.Fragment,{children:[(0,x.jsxs)(d.YGroup,{bg:"$bg",borderRadius:"$3",borderColor:"$borderSubdued",borderWidth:u.A.hairlineWidth,separator:(0,x.jsx)(d.Divider,{}),disabled:t,children:[(0,x.jsx)(d.YGroup.Item,{children:(0,x.jsx)(p.jY,{num:e,beforeShowTrigger:s,disabled:r||t,loadingDuration:0})}),(0,x.jsx)(d.YGroup.Item,{children:(0,x.jsx)(g.Up,{num:e,compressionUiMode:o,beforeShowTrigger:s,loadingDuration:0})})]}),(0,x.jsx)(DAppAccountListInitFromHome,{num:e,shouldSyncFromHome:l})]})}function DAppAccountListStandAloneItem({readonly:e,handleAccountChanged:n,onConnectedAccountInfoChanged:t}){var r=(0,i.A)(),{serviceDApp:c,serviceNetwork:u}=l.A,{$sourceInfo:g}=(0,m.A)(),{result:f}=(0,A.yk)((0,s.A)((function*(){var e,n;if(!g?.origin||!g.scope)return{accountSelectorNum:null,networkIds:null};var t=(0,S.zg)(g.scope),r=t?(yield u.getNetworkIdsByImpls({impls:t})).networkIds:null,o=yield c.getConnectedAccountsInfo({origin:g.origin,scope:null!=(e=g.scope)?e:"",isWalletConnectRequest:g.isWalletConnectRequest});return Array.isArray(o)&&o.length>0&&"number"==typeof o[0]?.num?{accountSelectorNum:o[0].num,networkIds:r,existConnectedAccount:!0}:{accountSelectorNum:yield c.getAccountSelectorNum({origin:g.origin,scope:null!=(n=g.scope)?n:"",isWalletConnectRequest:g.isWalletConnectRequest}),networkIds:r,existConnectedAccount:!1}})),[g?.origin,g?.scope,g?.isWalletConnectRequest,c,u]);return(0,a.useEffect)((function(){o()(f?.accountSelectorNum)&&t&&t({num:f.accountSelectorNum,existConnectedAccount:f.existConnectedAccount})}),[f?.accountSelectorNum,f?.existConnectedAccount,t]),(0,x.jsxs)(d.YStack,{gap:"$2",testID:"DAppAccountListStandAloneItem",children:[(0,x.jsx)(d.SizableText,{size:"$headingMd",color:"$text",children:r.formatMessage({id:h.ETranslations.global_accounts})}),"number"==typeof f?.accountSelectorNum&&Array.isArray(f?.networkIds)?(0,x.jsx)(p.b8,{config:{sceneName:_.Zs.discover,sceneUrl:g?.origin},enabledNum:[f.accountSelectorNum],availableNetworksMap:{[f.accountSelectorNum]:{networkIds:f.networkIds}},children:(0,x.jsx)(DAppAccountListItem,{initFromHome:!f?.existConnectedAccount,num:f?.accountSelectorNum,handleAccountChanged:n,readonly:e})}):null]})}function DAppAccountListStandAloneItemForHomeScene(){var e=(0,i.A)();return(0,x.jsxs)(d.YStack,{gap:"$2",testID:"DAppAccountListStandAloneItem",children:[(0,x.jsx)(d.SizableText,{size:"$headingMd",color:"$text",children:e.formatMessage({id:h.ETranslations.global_accounts})}),(0,x.jsx)(p.b8,{config:{sceneName:_.Zs.home},enabledNum:[0],children:(0,x.jsx)(DAppAccountListItem,{initFromHome:!1,num:0,readonly:!0})})]})}function WalletConnectAccountTriggerList({sceneUrl:e,sessionAccountsInfo:n,handleAccountChanged:t}){var r=n.map((function(e){return e.accountSelectorNum})),o=n.reduce((function(e,n){var t=n.networkIds.filter(Boolean);return e[n.accountSelectorNum]={networkIds:t,defaultNetworkId:t[0]},e}),{});return(0,x.jsxs)(d.YStack,{gap:"$2",children:[(0,x.jsx)(d.SizableText,{size:"$headingMd",color:"$text",children:"Accounts"}),Array.isArray(n)&&n.length?(0,x.jsx)(p.b8,{config:{sceneName:_.Zs.discover,sceneUrl:e},enabledNum:r,availableNetworksMap:o,children:(0,x.jsx)(d.YStack,{gap:"$2",children:n.map((function(e){return(0,x.jsx)(d.Stack,{children:(0,x.jsx)(DAppAccountListItem,{initFromHome:!0,num:e.accountSelectorNum,handleAccountChanged:t})},e.accountSelectorNum)}))})}):null]})}},701378:(e,n,t)=>{t.d(n,{_:()=>DAppRequestedPermissionContent,N:()=>DAppSignMessageContent});var r=t(908867),o=t(17617),c=t(490343),s=t(334439),a=t(831085);function DAppRequestedPermissionContent({requestPermissions:e}){var n=(0,r.A)();return(0,a.jsxs)(c.YStack,{gap:"$2",children:[(0,a.jsx)(c.SizableText,{color:"$text",size:"$headingMd",children:n.formatMessage({id:s.ETranslations.dapp_connect_requested_permissions})}),(0,a.jsx)(c.YStack,{py:"$2.5",px:"$3",gap:"$3",minHeight:"$8",bg:"$bg",borderRadius:"$3",borderWidth:o.A.hairlineWidth,borderColor:"$borderSubdued",borderCurve:"continuous",children:(null!=e?e:[n.formatMessage({id:s.ETranslations.dapp_connect_view_your_balance_and_activity}),n.formatMessage({id:s.ETranslations.dapp_connect_send_approval_requests})]).map((function(e){return(0,a.jsxs)(c.XStack,{gap:"$3",children:[(0,a.jsx)(c.Icon,{name:"CheckLargeOutline",color:"$icon",size:"$5"}),(0,a.jsx)(c.SizableText,{color:"$text",size:"$bodyMd",children:e})]},e)}))})]})}var i=t(586330),u=t(514041),d=t(903454),l=t(911998),p=t(276059),g=t(161024),m=t(901048).Buffer;function DAppSignMessageContent({unsignedMessage:e}){var n=(0,r.A)(),[t,o]=(0,u.useState)(!1),A=(0,u.useMemo)((function(){var{message:n,type:t,payload:r}=e;switch(t){case g.nc.ECDSA:case g.nc.BIP322_SIMPLE:case g.$.ETH_SIGN:case g.nZ.SIMPLE_SIGN:return n;case g.$.PERSONAL_SIGN:case g.nZ.SIGN_MESSAGE:try{return d.toBuffer(n).toString("utf8")}catch(e){return n}case g.nZ.HEX_MESSAGE:return m.from(n,"hex").toString("utf8");case g.nF.SIGN_MESSAGE:var o;return null!=(o=r?.message)?o:n;case g.$.TYPED_DATA_V1:var c,s,a=null!=(c=JSON.parse(n))?c:{};if(a=null!=(s=a.message)?s:a,Array.isArray(a))a=a.reduce((function(e,n){return e[n.name]=n.value,e}),{});return JSON.stringify(a,null,2);case g.$.TYPED_DATA_V3:case g.$.TYPED_DATA_V4:try{var i,u,l=JSON.parse(n);return l=null!=(i=l?.message)?i:l,JSON.stringify("string"==typeof l?null!=(u=JSON.parse(l))?u:{}:l,null,2)}catch{return n}default:return n}}),[e]),f=(0,u.useCallback)((function(){var{message:r,type:i}=e;if(i===g.nc.ECDSA||i===g.nc.BIP322_SIMPLE||i===g.$.ETH_SIGN||i===g.nZ.SIMPLE_SIGN)return null;var u=r;if(i===g.$.TYPED_DATA_V1||i===g.$.TYPED_DATA_V3||i===g.$.TYPED_DATA_V4){try{u=JSON.parse(u)}catch(e){}u=JSON.stringify(u,null,2)}return(0,a.jsxs)(c.YStack,{gap:"$2",children:[(0,a.jsx)(c.Button,{variant:"secondary",onPress:function(){return o(!t)},children:t?n.formatMessage({id:s.ETranslations.dapp_connect_hide_full_message}):n.formatMessage({id:s.ETranslations.dapp_connect_view_full_message})}),t?(0,a.jsx)(c.TextAreaInput,{editable:!1,numberOfLines:11,value:u}):null]})}),[n,e,t]),S=(0,l.yk)((0,i.A)((function*(){return(0,p.Qw)({unsignedMessage:e})})),[e]);return(0,a.jsxs)(c.YStack,{justifyContent:"center",children:[(0,a.jsxs)(c.XStack,{alignItems:"center",justifyContent:"space-between",children:[(0,a.jsx)(c.SizableText,{color:"$text",size:"$headingMd",mb:"$2",children:n.formatMessage({id:s.ETranslations.dapp_connect_message})}),S.result?(0,a.jsx)(c.Badge,{badgeType:"info",badgeSize:"sm",children:S.result}):null]}),(0,a.jsxs)(c.YStack,{gap:"$2",children:[(0,a.jsx)(c.TextAreaInput,{value:A,editable:!1,numberOfLines:11}),f()]})]})}},980342:(e,n,t)=>{t.d(n,{A:()=>s,z:()=>useDappCloseHandler});var r=t(490343),o=t(42484),c=t(831085);function useDappCloseHandler(e,n){return function(t){t?.flag!==o.nd.Confirmed&&e.reject(),"function"==typeof n&&n(t)}}const s=function DappOpenModalPage({children:e,onClose:n,dappApprove:t}){var o=useDappCloseHandler(t,n);return(0,c.jsxs)(r.Page,{scrollEnabled:!0,onClose:o,children:[(0,c.jsx)(r.Page.Header,{headerShown:!1}),e]})}},321732:(e,n,t)=>{t.r(n),t.d(n,{default:()=>w});var r=t(586330),o=t(514041),c=t(908867),s=t(17617),a=t(490343),i=t(325809),u=t(237532),d=t(334439),l=t(276059),p=t(491180),g=t(47412),m=t(553083),A=t(42484),f=t(352325),S=t(161024),h=t(610421),y=t(796895),_=t(24284),b=t(911998),x=t(278484),I=t(701378),j=t(864961),v=t(905710),D=t(980342),T=t(831085),WalletAccountListItem=function({networkId:e,accountId:n}){var t=(0,c.A)(),{result:o,isLoading:l}=(0,b.yk)((0,r.A)((function*(){var t,[r,o,c]=yield Promise.all([h.A.serviceNetwork.getNetworkSafe({networkId:e}),h.A.serviceAccount.getAccount({accountId:n,networkId:e}),h.A.serviceAccount.getWallet({walletId:p.A.getWalletIdFromAccountId({accountId:n})})]);return o.indexedAccountId&&(t=yield h.A.serviceAccount.getIndexedAccount({id:o.indexedAccountId})),{network:r,account:o,wallet:c,indexedAccount:t}})),[e,n]);return(0,T.jsxs)(a.YStack,{gap:"$2",children:[(0,T.jsx)(a.SizableText,{size:"$headingMd",color:"$text",children:t.formatMessage({id:d.ETranslations.global_accounts})}),(0,T.jsxs)(a.YGroup,{bg:"$bg",borderRadius:"$3",borderColor:"$borderSubdued",borderWidth:s.A.hairlineWidth,separator:(0,T.jsx)(a.Divider,{}),disabled:!0,overflow:"hidden",children:[(0,T.jsx)(a.YGroup.Item,{children:(0,T.jsx)(i.rx,{isLoading:l,network:o?.network,triggerDisabled:!0})}),(0,T.jsx)(a.YGroup.Item,{children:(0,T.jsx)(u.cd,{isLoading:l,account:o?.account,wallet:o?.wallet,indexedAccount:o?.indexedAccount,triggerDisabled:!0})})]})]})};const w=function SignMessageModal(){var e,n,t,s=(0,c.A)(),[i,u]=(0,o.useState)(!1),{$sourceInfo:p,unsignedMessage:w,accountId:k,networkId:$,walletInternalSign:C}=(0,_.A)(),M=(0,y.A)({id:null!=(e=p?.id)?e:"",closeWindowAfterResolved:!0}),{result:N}=(0,b.yk)((function(){return h.A.serviceNetwork.getNetwork({networkId:$})}),[$]),P=(0,l.PQ)({unsignedMessage:w}),E=(0,l.kW)({unsignedMessage:w}),O=(0,l.Vq)({unsignedMessage:w}),Y=w.type===S.$.TYPED_DATA_V3||w.type===S.$.TYPED_DATA_V4;(0,o.useEffect)((function(){var e;Y&&h.A.serviceDiscovery.postSignTypedDataMessage({networkId:$,accountId:k,origin:null!=(e=p?.origin)?e:"",typedData:w.message})}),[Y,p?.origin,k,$,w.message]);var L,H=(0,o.useMemo)((function(){return N?.name?s.formatMessage({id:d.ETranslations.dapp_connect_allow_to_access_your_chain_message_signature},{chain:N.name}):""}),[s,N]),{showContinueOperate:F,continueOperate:z,setContinueOperate:W,riskLevel:G,urlSecurityInfo:V}=(0,v.q)({origin:null!=(n=p?.origin)?n:"",isRiskSignMethod:O}),R=(0,o.useCallback)((L=(0,r.A)((function*(e){u(!0);try{w.type!==S.$.ETH_SIGN&&w.type!==S.$.PERSONAL_SIGN||(0,g.Xf)(w,N?.impl),w.type===S.$.TYPED_DATA_V1&&(0,g.cM)(w,N?.impl),w.type!==S.$.TYPED_DATA_V3&&w.type!==S.$.TYPED_DATA_V4||(0,g.a3)(w,m.Ay.getNetworkChainId({networkId:$}),N?.impl)}catch(n){return u(!1),M?.reject({error:n}),void e?.()}try{var n=yield h.A.serviceSend.signMessage({unsignedMessage:w,networkId:$,accountId:k});M.resolve({result:n});try{yield h.A.serviceSignature.addItemFromSignMessage({networkId:$,accountId:k,message:w.message,sourceInfo:p})}catch{}e?.({flag:A.nd.Confirmed})}finally{u(!1)}})),function(e){return L.apply(this,arguments)}),[w,N?.impl,$,M,k,p]);return(0,T.jsx)(D.A,{dappApprove:M,children:(0,T.jsxs)(T.Fragment,{children:[(0,T.jsx)(a.Page.Header,{headerShown:!1}),(0,T.jsx)(a.Page.Body,{children:(0,T.jsxs)(j.HJ,{title:s.formatMessage({id:d.ETranslations.dapp_connect_initiate_message_signature_request}),subtitle:H,origin:null!=(t=p?.origin)?t:"",urlSecurityInfo:V,displaySignMessageAlert:O||Y,signMessageAlertProps:function(){if(Y){var e="default",n="signTypedData";return(P||E)&&(e="warning",n=P?"permit":"order"),{type:e,icon:"InfoSquareSolid",title:s.formatMessage({id:d.ETranslations.dapp_connect_permit_sign_alert},{type:n})}}}(),children:[C?(0,T.jsx)(WalletAccountListItem,{accountId:k,networkId:$}):(0,T.jsx)(x.ZY,{readonly:!0}),(0,T.jsx)(I.N,{unsignedMessage:w})]})}),(0,T.jsx)(a.Page.Footer,{children:(0,T.jsx)(j.OS,{confirmText:s.formatMessage({id:d.ETranslations.dapp_connect_confirm}),continueOperate:z,setContinueOperate:function(e){W(!!e)},onConfirm:function(e){return R(e)},onCancel:function(){return M.reject()},confirmButtonProps:{loading:i,disabled:!z},showContinueOperateCheckbox:F,riskLevel:O?f._.High:G})})]})})}},276059:(e,n,t)=>{t.d(n,{Vq:()=>isEthSignType,kW:()=>isPrimaryTypeOrderSign,PQ:()=>isPrimaryTypePermitSign,Qw:()=>parsePrimaryType});var r=t(161024),o=function(e){return e.Order="Order",e.OrderComponents="OrderComponents",e}({}),c=function(e){return e.Permit="Permit",e.PermitBatch="PermitBatch",e.PermitBatchTransferFrom="PermitBatchTransferFrom",e.PermitSingle="PermitSingle",e.PermitTransferFrom="PermitTransferFrom",e}({}),s=Object.values(o),a=Object.values(c),isEthSignType=function({unsignedMessage:e}){return e.type===r.$.ETH_SIGN},isPrimaryTypeSign=function(e,n){if(e.type!==r.$.TYPED_DATA_V3&&e.type!==r.$.TYPED_DATA_V4)return!1;var{message:t}=e;try{var o=JSON.parse(t);return void 0!==o.primaryType&&n.includes(o.primaryType)}catch{return!1}},isPrimaryTypePermitSign=function({unsignedMessage:e}){return isPrimaryTypeSign(e,a)},isPrimaryTypeOrderSign=function({unsignedMessage:e}){return isPrimaryTypeSign(e,s)},parsePrimaryType=function({unsignedMessage:e}){if(e.type!==r.$.TYPED_DATA_V3&&e.type!==r.$.TYPED_DATA_V4)return null;try{var{message:n}=e,t=JSON.parse(n);if(t.primaryType)return t.primaryType}catch{}return null}}}]);