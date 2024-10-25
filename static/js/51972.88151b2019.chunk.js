"use strict";(self.webpackChunkweb=self.webpackChunkweb||[]).push([[51972],{82506:(e,n,t)=>{t.d(n,{d:()=>useDebounce});var o=t(578104);function useDebounce(e,n,t){var[r]=(0,o.d7)(e,n,t);return r}},278484:(e,n,t)=>{t.d(n,{wI:()=>DAppAccountListItem,ZY:()=>DAppAccountListStandAloneItem,X1:()=>DAppAccountListStandAloneItemForHomeScene,VV:()=>WalletConnectAccountTriggerList});var o=t(460986),r=t.n(o),c=t(324586),a=t(586330),i=t(514041),s=t(908867),u=t(17617),l=t(490343),d=t(610421),p=t(325809),g=t(237532),f=t(24284),m=t(911998),h=t(162616),A=t(226952),y=t(334439),b=(t(663522),t(584186)),S=t(714191),x=t(82506);var _=t(831085);function ownKeys(e,n){var t=Object.keys(e);if(Object.getOwnPropertySymbols){var o=Object.getOwnPropertySymbols(e);n&&(o=o.filter((function(n){return Object.getOwnPropertyDescriptor(e,n).enumerable}))),t.push.apply(t,o)}return t}function _objectSpread(e){for(var n=1;n<arguments.length;n++){var t=null!=arguments[n]?arguments[n]:{};n%2?ownKeys(Object(t),!0).forEach((function(n){(0,c.A)(e,n,t[n])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(t)):ownKeys(Object(t)).forEach((function(n){Object.defineProperty(e,n,Object.getOwnPropertyDescriptor(t,n))}))}return e}function DAppAccountListInitFromHome({num:e,shouldSyncFromHome:n}){var[,t]=(0,h.K7)(),o=(0,h.z$)();return(0,i.useEffect)((function(){return(0,a.A)((function*(){try{t((function(n){return _objectSpread(_objectSpread({},n),{},{[e]:{isLoading:!0}})})),yield b.A.wait(600),n&&(yield o.current.syncFromScene({from:{sceneName:S.Zs.home,sceneNum:0},num:e}))}finally{n&&(yield b.A.wait(300)),t((function(n){return _objectSpread(_objectSpread({},n),{},{[e]:{isLoading:!1}})}))}}))(),function(){t((function(n){return _objectSpread(_objectSpread({},n),{},{[e]:{isLoading:!1}})}))}}),[o,e,t,n]),null}function DAppAccountListItem({num:e,handleAccountChanged:n,readonly:t,networkReadonly:o,compressionUiMode:r,initFromHome:c,beforeShowTrigger:a,skeletonRenderDuration:s}){!function useHandleDiscoveryAccountChanged({num:e,handleAccountChanged:n}){var{activeAccount:t}=(0,h.LH)({num:e}),{selectedAccount:o}=(0,h.wz)({num:e}),r=(0,x.d)(t,200),c=(0,x.d)(o,200),a=(0,i.useRef)(t),s=(0,i.useRef)(o);(0,i.useEffect)((function(){a.current=t,s.current=o}),[t,o]),(0,i.useEffect)((function(){n&&(r.isOthersWallet&&r.account?.id===c.othersWalletAccountId||r.indexedAccount?.id===c.indexedAccountId)&&n({activeAccount:a.current,selectedAccount:s.current},e)}),[r,c,n,e])}({num:e,handleAccountChanged:n});var d=Boolean(c&&!t);return(0,_.jsxs)(_.Fragment,{children:[(0,_.jsxs)(l.YGroup,{bg:"$bg",borderRadius:"$3",borderColor:"$borderSubdued",borderWidth:u.A.hairlineWidth,separator:(0,_.jsx)(l.Divider,{}),disabled:t,children:[(0,_.jsx)(l.YGroup.Item,{children:(0,_.jsx)(p.jY,{num:e,beforeShowTrigger:a,disabled:o||t,loadingDuration:0})}),(0,_.jsx)(l.YGroup.Item,{children:(0,_.jsx)(g.Up,{num:e,compressionUiMode:r,beforeShowTrigger:a,loadingDuration:0})})]}),(0,_.jsx)(DAppAccountListInitFromHome,{num:e,shouldSyncFromHome:d})]})}function DAppAccountListStandAloneItem({readonly:e,handleAccountChanged:n,onConnectedAccountInfoChanged:t}){var o=(0,s.A)(),{serviceDApp:c,serviceNetwork:u}=d.A,{$sourceInfo:g}=(0,f.A)(),{result:h}=(0,m.yk)((0,a.A)((function*(){var e,n;if(!g?.origin||!g.scope)return{accountSelectorNum:null,networkIds:null};var t=(0,A.zg)(g.scope),o=t?(yield u.getNetworkIdsByImpls({impls:t})).networkIds:null,r=yield c.getConnectedAccountsInfo({origin:g.origin,scope:null!=(e=g.scope)?e:"",isWalletConnectRequest:g.isWalletConnectRequest});return Array.isArray(r)&&r.length>0&&"number"==typeof r[0]?.num?{accountSelectorNum:r[0].num,networkIds:o,existConnectedAccount:!0}:{accountSelectorNum:yield c.getAccountSelectorNum({origin:g.origin,scope:null!=(n=g.scope)?n:"",isWalletConnectRequest:g.isWalletConnectRequest}),networkIds:o,existConnectedAccount:!1}})),[g?.origin,g?.scope,g?.isWalletConnectRequest,c,u]);return(0,i.useEffect)((function(){r()(h?.accountSelectorNum)&&t&&t({num:h.accountSelectorNum,existConnectedAccount:h.existConnectedAccount})}),[h?.accountSelectorNum,h?.existConnectedAccount,t]),(0,_.jsxs)(l.YStack,{gap:"$2",testID:"DAppAccountListStandAloneItem",children:[(0,_.jsx)(l.SizableText,{size:"$headingMd",color:"$text",children:o.formatMessage({id:y.ETranslations.global_accounts})}),"number"==typeof h?.accountSelectorNum&&Array.isArray(h?.networkIds)?(0,_.jsx)(p.b8,{config:{sceneName:S.Zs.discover,sceneUrl:g?.origin},enabledNum:[h.accountSelectorNum],availableNetworksMap:{[h.accountSelectorNum]:{networkIds:h.networkIds}},children:(0,_.jsx)(DAppAccountListItem,{initFromHome:!h?.existConnectedAccount,num:h?.accountSelectorNum,handleAccountChanged:n,readonly:e})}):null]})}function DAppAccountListStandAloneItemForHomeScene(){var e=(0,s.A)();return(0,_.jsxs)(l.YStack,{gap:"$2",testID:"DAppAccountListStandAloneItem",children:[(0,_.jsx)(l.SizableText,{size:"$headingMd",color:"$text",children:e.formatMessage({id:y.ETranslations.global_accounts})}),(0,_.jsx)(p.b8,{config:{sceneName:S.Zs.home},enabledNum:[0],children:(0,_.jsx)(DAppAccountListItem,{initFromHome:!1,num:0,readonly:!0})})]})}function WalletConnectAccountTriggerList({sceneUrl:e,sessionAccountsInfo:n,handleAccountChanged:t}){var o=n.map((function(e){return e.accountSelectorNum})),r=n.reduce((function(e,n){var t=n.networkIds.filter(Boolean);return e[n.accountSelectorNum]={networkIds:t,defaultNetworkId:t[0]},e}),{});return(0,_.jsxs)(l.YStack,{gap:"$2",children:[(0,_.jsx)(l.SizableText,{size:"$headingMd",color:"$text",children:"Accounts"}),Array.isArray(n)&&n.length?(0,_.jsx)(p.b8,{config:{sceneName:S.Zs.discover,sceneUrl:e},enabledNum:o,availableNetworksMap:r,children:(0,_.jsx)(l.YStack,{gap:"$2",children:n.map((function(e){return(0,_.jsx)(l.Stack,{children:(0,_.jsx)(DAppAccountListItem,{initFromHome:!0,num:e.accountSelectorNum,handleAccountChanged:t})},e.accountSelectorNum)}))})}):null]})}},980342:(e,n,t)=>{t.d(n,{A:()=>a,z:()=>useDappCloseHandler});var o=t(490343),r=t(42484),c=t(831085);function useDappCloseHandler(e,n){return function(t){t?.flag!==r.nd.Confirmed&&e.reject(),"function"==typeof n&&n(t)}}const a=function DappOpenModalPage({children:e,onClose:n,dappApprove:t}){var r=useDappCloseHandler(t,n);return(0,c.jsxs)(o.Page,{scrollEnabled:!0,onClose:r,children:[(0,c.jsx)(o.Page.Header,{headerShown:!1}),e]})}},851972:(e,n,t)=>{t.r(n),t.d(n,{default:()=>S});var o=t(586330),r=t(514041),c=t(908867),a=t(490343),i=function(e){return e[e.Metadata=0]="Metadata",e[e.Text=1]="Text",e[e.RelayRec=2]="RelayRec",e[e.Contacts=3]="Contacts",e[e.DM=4]="DM",e[e.Deleted=5]="Deleted",e[e.Reaction=7]="Reaction",e[e.BadgeAward=8]="BadgeAward",e[e.ChannelCreation=40]="ChannelCreation",e[e.ChannelMetadata=41]="ChannelMetadata",e[e.ChannelMessage=42]="ChannelMessage",e[e.ChannelHideMessage=43]="ChannelHideMessage",e[e.Reporting=1984]="Reporting",e[e.ZapRequest=9734]="ZapRequest",e[e.Zap=9735]="Zap",e[e.RelayListMetadata=10002]="RelayListMetadata",e[e.ClientAuthentication=22242]="ClientAuthentication",e[e.NostrConnect=24133]="NostrConnect",e[e.ProfileBadges=30008]="ProfileBadges",e[e.BadgeDefinition=30009]="BadgeDefinition",e[e.LongFormContent=30023]="LongFormContent",e[e.ApplicationSpecificData=30078]="ApplicationSpecificData",e}({}),s=Object.values(i),u=function(e){return e.signEvent="signEvent",e.signSchnorr="signSchnorr",e.encrypt="encrypt",e.decrypt="decrypt",e}({}),l=t(334439),d=t(42484),p=t(610421),g=t(796895),f=t(24284),m=t(278484),h=t(864961),A=t(905710),y=t(980342),b=t(831085);const S=function NostrSignEventModal(){var e,n,t,S,{$sourceInfo:x,event:_,pubkey:j,plaintext:C,ciphertext:v,sigHash:w,walletId:k,accountId:I,networkId:M}=(0,f.A)(),D=(0,g.A)({id:null!=(e=x?.id)?e:"",closeWindowAfterResolved:!0}),{showContinueOperate:N,continueOperate:E,setContinueOperate:O,riskLevel:T,urlSecurityInfo:L}=(0,A.q)({origin:null!=(n=x?.origin)?n:""}),R=(0,c.A)(),[H,P]=(0,r.useState)(!1),[$,F]=(0,r.useState)(!1),[B,Y]=(0,r.useState)(!1),z=(0,r.useMemo)((function(){return _?u.signEvent:w?u.signSchnorr:j&&C?u.encrypt:j&&v?u.decrypt:void 0}),[j,C,_,v,w]),W=(0,r.useMemo)((function(){var e;return z===u.encrypt?C:z===u.decrypt?v:z===u.signSchnorr?w:null!=(e=_?.content)?e:`(${R.formatMessage({id:l.ETranslations.dapp_connect_msg_no_content})})`}),[z,_,C,v,w,R]),q=(0,r.useMemo)((function(){return z!==u.signEvent?"":s.includes(Number(_?.kind))?R.formatMessage({id:l.ETranslations[`dapp_connect_nostr_event_kind_${null!=(e=_?.kind)?e:"unknown"}`]}):R.formatMessage({id:l.ETranslations.dapp_connect_nostr_event_kind_unknown},{kind:_?.kind});var e}),[R,z,_]),Z=(0,r.useMemo)((function(){return z===u.encrypt?R.formatMessage({id:l.ETranslations.dapp_connect_encrypted_request}):z===u.decrypt?R.formatMessage({id:l.ETranslations.dapp_connect_decrypted_request}):R.formatMessage({id:l.ETranslations.dapp_connect_signature_request})}),[R,z]),U=(0,r.useMemo)((function(){return z===u.encrypt?R.formatMessage({id:l.ETranslations.dapp_connect_allow_to_access_your_chain_encrypted_message},{chain:"Nostr"}):z===u.decrypt?R.formatMessage({id:l.ETranslations.dapp_connect_allow_to_access_your_chain_decrypted_message},{chain:"Nostr"}):R.formatMessage({id:l.ETranslations.dapp_connect_allow_to_access_your_chain_message_signature},{chain:z===u.signSchnorr?"Nostr Schnorr":"Nostr"})}),[R,z]),K=(0,r.useCallback)((S=(0,o.A)((function*(e){try{var n,t,{serviceNostr:o,servicePassword:r}=p.A;Y(!0),(yield r.getCachedPassword())||(yield r.promptPasswordVerifyByAccount({accountId:I})),z===u.signEvent?n=yield o.signEvent({event:null!=_?_:{},walletId:k,accountId:I,networkId:M,options:{origin:null!=(t=x?.origin)?t:"",autoSign:$}}):z===u.encrypt?n=yield o.encrypt({pubkey:null!=j?j:"",plaintext:null!=C?C:"",walletId:k,accountId:I,networkId:M}):z===u.decrypt?n=yield o.decrypt({pubkey:null!=j?j:"",ciphertext:null!=v?v:"",walletId:k,accountId:I,networkId:M}):z===u.signSchnorr&&(n=yield o.signSchnorr({sigHash:null!=w?w:"",walletId:k,accountId:I,networkId:M})),setTimeout((function(){var t;D.resolve({result:null!=(t=n?.data)?t:null,close:function(){e?.({flag:d.nd.Confirmed})}})}),300)}catch(e){D.reject()}finally{Y(!1)}})),function(e){return S.apply(this,arguments)}),[_,z,k,I,M,D,j,C,v,w,$,x?.origin]),G=(0,r.useCallback)((function(){return _?(0,b.jsxs)(a.YStack,{gap:"$2",children:[(0,b.jsx)(a.Button,{variant:"secondary",onPress:function(){return P(!H)},children:H?R.formatMessage({id:l.ETranslations.dapp_connect_hide_full_message}):R.formatMessage({id:l.ETranslations.dapp_connect_view_full_message})}),H?(0,b.jsx)(a.TextArea,{editable:!1,numberOfLines:11,children:JSON.stringify(_,null,2)}):null]}):null}),[R,_,H]),[V,J]=(0,r.useState)(null),X=(0,r.useMemo)((function(){return z===u.signEvent&&Number(_?.kind)===i.DM}),[z,_]);(0,r.useEffect)((function(){X&&_?.content&&p.A.serviceNostr.getEncryptedData(_?.content).then((function(e){e&&e.plaintext&&J(e.plaintext)}))}),[_,X]);var Q=(0,r.useCallback)((function(){return X&&V&&V.length>0?(0,b.jsxs)(a.YStack,{gap:"$2",children:[(0,b.jsxs)(a.SizableText,{children:[R.formatMessage({id:l.ETranslations.dapp_connect_nostr_plaintext}),":"]}),(0,b.jsx)(a.TextArea,{editable:!1,numberOfLines:5,children:V})]}):null}),[R,V,X]);return(0,b.jsx)(y.A,{dappApprove:D,children:(0,b.jsxs)(b.Fragment,{children:[(0,b.jsx)(a.Page.Header,{headerShown:!1}),(0,b.jsx)(a.Page.Body,{children:(0,b.jsxs)(h.HJ,{title:Z,subtitle:U,origin:null!=(t=x?.origin)?t:"",urlSecurityInfo:L,children:[(0,b.jsx)(m.ZY,{readonly:!0}),(0,b.jsxs)(a.YStack,{gap:"$2",children:[(0,b.jsx)(a.SizableText,{children:q}),(0,b.jsx)(a.TextArea,{editable:!1,numberOfLines:5,children:W}),Q(),G()]}),z===u.signEvent?(0,b.jsx)(a.Checkbox,{label:R.formatMessage({id:l.ETranslations.dapp_connect_do_not_ask_again}),value:$,onChange:function(e){return F(!!e)}}):null]})}),(0,b.jsx)(a.Page.Footer,{children:(0,b.jsx)(h.OS,{continueOperate:E,setContinueOperate:function(e){O(!!e)},onConfirm:K,onCancel:function(){return D.reject()},confirmButtonProps:{loading:B,disabled:!E},showContinueOperateCheckbox:N,riskLevel:T})})]})})}}}]);