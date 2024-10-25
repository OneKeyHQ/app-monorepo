"use strict";(self.webpackChunkweb=self.webpackChunkweb||[]).push([[23696],{82506:(e,n,t)=>{t.d(n,{d:()=>useDebounce});var o=t(578104);function useDebounce(e,n,t){var[r]=(0,o.d7)(e,n,t);return r}},278484:(e,n,t)=>{t.d(n,{wI:()=>DAppAccountListItem,ZY:()=>DAppAccountListStandAloneItem,X1:()=>DAppAccountListStandAloneItemForHomeScene,VV:()=>WalletConnectAccountTriggerList});var o=t(460986),r=t.n(o),a=t(324586),c=t(586330),s=t(514041),i=t(908867),u=t(17617),l=t(490343),d=t(610421),m=t(325809),p=t(237532),f=t(24284),g=t(911998),A=t(162616),b=t(226952),h=t(334439),y=(t(663522),t(584186)),j=t(714191),S=t(82506);var x=t(831085);function ownKeys(e,n){var t=Object.keys(e);if(Object.getOwnPropertySymbols){var o=Object.getOwnPropertySymbols(e);n&&(o=o.filter((function(n){return Object.getOwnPropertyDescriptor(e,n).enumerable}))),t.push.apply(t,o)}return t}function _objectSpread(e){for(var n=1;n<arguments.length;n++){var t=null!=arguments[n]?arguments[n]:{};n%2?ownKeys(Object(t),!0).forEach((function(n){(0,a.A)(e,n,t[n])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(t)):ownKeys(Object(t)).forEach((function(n){Object.defineProperty(e,n,Object.getOwnPropertyDescriptor(t,n))}))}return e}function DAppAccountListInitFromHome({num:e,shouldSyncFromHome:n}){var[,t]=(0,A.K7)(),o=(0,A.z$)();return(0,s.useEffect)((function(){return(0,c.A)((function*(){try{t((function(n){return _objectSpread(_objectSpread({},n),{},{[e]:{isLoading:!0}})})),yield y.A.wait(600),n&&(yield o.current.syncFromScene({from:{sceneName:j.Zs.home,sceneNum:0},num:e}))}finally{n&&(yield y.A.wait(300)),t((function(n){return _objectSpread(_objectSpread({},n),{},{[e]:{isLoading:!1}})}))}}))(),function(){t((function(n){return _objectSpread(_objectSpread({},n),{},{[e]:{isLoading:!1}})}))}}),[o,e,t,n]),null}function DAppAccountListItem({num:e,handleAccountChanged:n,readonly:t,networkReadonly:o,compressionUiMode:r,initFromHome:a,beforeShowTrigger:c,skeletonRenderDuration:i}){!function useHandleDiscoveryAccountChanged({num:e,handleAccountChanged:n}){var{activeAccount:t}=(0,A.LH)({num:e}),{selectedAccount:o}=(0,A.wz)({num:e}),r=(0,S.d)(t,200),a=(0,S.d)(o,200),c=(0,s.useRef)(t),i=(0,s.useRef)(o);(0,s.useEffect)((function(){c.current=t,i.current=o}),[t,o]),(0,s.useEffect)((function(){n&&(r.isOthersWallet&&r.account?.id===a.othersWalletAccountId||r.indexedAccount?.id===a.indexedAccountId)&&n({activeAccount:c.current,selectedAccount:i.current},e)}),[r,a,n,e])}({num:e,handleAccountChanged:n});var d=Boolean(a&&!t);return(0,x.jsxs)(x.Fragment,{children:[(0,x.jsxs)(l.YGroup,{bg:"$bg",borderRadius:"$3",borderColor:"$borderSubdued",borderWidth:u.A.hairlineWidth,separator:(0,x.jsx)(l.Divider,{}),disabled:t,children:[(0,x.jsx)(l.YGroup.Item,{children:(0,x.jsx)(m.jY,{num:e,beforeShowTrigger:c,disabled:o||t,loadingDuration:0})}),(0,x.jsx)(l.YGroup.Item,{children:(0,x.jsx)(p.Up,{num:e,compressionUiMode:r,beforeShowTrigger:c,loadingDuration:0})})]}),(0,x.jsx)(DAppAccountListInitFromHome,{num:e,shouldSyncFromHome:d})]})}function DAppAccountListStandAloneItem({readonly:e,handleAccountChanged:n,onConnectedAccountInfoChanged:t}){var o=(0,i.A)(),{serviceDApp:a,serviceNetwork:u}=d.A,{$sourceInfo:p}=(0,f.A)(),{result:A}=(0,g.yk)((0,c.A)((function*(){var e,n;if(!p?.origin||!p.scope)return{accountSelectorNum:null,networkIds:null};var t=(0,b.zg)(p.scope),o=t?(yield u.getNetworkIdsByImpls({impls:t})).networkIds:null,r=yield a.getConnectedAccountsInfo({origin:p.origin,scope:null!=(e=p.scope)?e:"",isWalletConnectRequest:p.isWalletConnectRequest});return Array.isArray(r)&&r.length>0&&"number"==typeof r[0]?.num?{accountSelectorNum:r[0].num,networkIds:o,existConnectedAccount:!0}:{accountSelectorNum:yield a.getAccountSelectorNum({origin:p.origin,scope:null!=(n=p.scope)?n:"",isWalletConnectRequest:p.isWalletConnectRequest}),networkIds:o,existConnectedAccount:!1}})),[p?.origin,p?.scope,p?.isWalletConnectRequest,a,u]);return(0,s.useEffect)((function(){r()(A?.accountSelectorNum)&&t&&t({num:A.accountSelectorNum,existConnectedAccount:A.existConnectedAccount})}),[A?.accountSelectorNum,A?.existConnectedAccount,t]),(0,x.jsxs)(l.YStack,{gap:"$2",testID:"DAppAccountListStandAloneItem",children:[(0,x.jsx)(l.SizableText,{size:"$headingMd",color:"$text",children:o.formatMessage({id:h.ETranslations.global_accounts})}),"number"==typeof A?.accountSelectorNum&&Array.isArray(A?.networkIds)?(0,x.jsx)(m.b8,{config:{sceneName:j.Zs.discover,sceneUrl:p?.origin},enabledNum:[A.accountSelectorNum],availableNetworksMap:{[A.accountSelectorNum]:{networkIds:A.networkIds}},children:(0,x.jsx)(DAppAccountListItem,{initFromHome:!A?.existConnectedAccount,num:A?.accountSelectorNum,handleAccountChanged:n,readonly:e})}):null]})}function DAppAccountListStandAloneItemForHomeScene(){var e=(0,i.A)();return(0,x.jsxs)(l.YStack,{gap:"$2",testID:"DAppAccountListStandAloneItem",children:[(0,x.jsx)(l.SizableText,{size:"$headingMd",color:"$text",children:e.formatMessage({id:h.ETranslations.global_accounts})}),(0,x.jsx)(m.b8,{config:{sceneName:j.Zs.home},enabledNum:[0],children:(0,x.jsx)(DAppAccountListItem,{initFromHome:!1,num:0,readonly:!0})})]})}function WalletConnectAccountTriggerList({sceneUrl:e,sessionAccountsInfo:n,handleAccountChanged:t}){var o=n.map((function(e){return e.accountSelectorNum})),r=n.reduce((function(e,n){var t=n.networkIds.filter(Boolean);return e[n.accountSelectorNum]={networkIds:t,defaultNetworkId:t[0]},e}),{});return(0,x.jsxs)(l.YStack,{gap:"$2",children:[(0,x.jsx)(l.SizableText,{size:"$headingMd",color:"$text",children:"Accounts"}),Array.isArray(n)&&n.length?(0,x.jsx)(m.b8,{config:{sceneName:j.Zs.discover,sceneUrl:e},enabledNum:o,availableNetworksMap:r,children:(0,x.jsx)(l.YStack,{gap:"$2",children:n.map((function(e){return(0,x.jsx)(l.Stack,{children:(0,x.jsx)(DAppAccountListItem,{initFromHome:!0,num:e.accountSelectorNum,handleAccountChanged:t})},e.accountSelectorNum)}))})}):null]})}},980342:(e,n,t)=>{t.d(n,{A:()=>c,z:()=>useDappCloseHandler});var o=t(490343),r=t(42484),a=t(831085);function useDappCloseHandler(e,n){return function(t){t?.flag!==r.nd.Confirmed&&e.reject(),"function"==typeof n&&n(t)}}const c=function DappOpenModalPage({children:e,onClose:n,dappApprove:t}){var r=useDappCloseHandler(t,n);return(0,a.jsxs)(o.Page,{scrollEnabled:!0,onClose:r,children:[(0,a.jsx)(o.Page.Header,{headerShown:!1}),e]})}},789094:(e,n,t)=>{t.d(n,{A:()=>d});var o=t(514041),r=t(241440),a=t(908867),c=t(490343),s=t(334439),i=t(610421),u=t(911998),l=t(831085);const d=function LNSendPaymentForm(e){var{networkId:n,useFormReturn:t,amount:d,minimumAmount:m,maximumAmount:p,descriptionLabelId:f,commentAllowedLength:g,metadata:A,amountReadOnly:b,commentReadOnly:h}=e,y=(0,a.A)(),{result:j}=(0,u.yk)((function(){return i.A.serviceLightning.getInvoiceConfig({networkId:n})}),[n]),S=new r.A(null!=m?m:0).toNumber(),x=new r.A(null!=p?p:0).toNumber(),w=(0,o.useMemo)((function(){var e;return x&&x>0&&x>S&&x<Number(j?.maxSendAmount)&&(e=x),{min:{value:S,message:y.formatMessage({id:s.ETranslations.dapp_connect_amount_should_be_at_least},{0:S})},max:e?{value:e,message:y.formatMessage({id:s.ETranslations.dapp_connect_amount_should_not_exceed},{0:e})}:void 0,pattern:{value:/^[0-9]*$/,message:y.formatMessage({id:s.ETranslations.send_field_only_integer})},validate:function(e){if(!(S<=0)||e){var n=new r.A(e);return n.isInteger()?j?.maxSendAmount&&n.isGreaterThan(j?.maxSendAmount)?y.formatMessage({id:s.ETranslations.dapp_connect_amount_should_not_exceed},{0:j?.maxSendAmount}):void 0:y.formatMessage({id:s.ETranslations.send_field_only_integer})}}}}),[S,x,y,j?.maxSendAmount]),v=(0,o.useMemo)((function(){if(!(Number(d)>0||S>0&&S===x))return S>0&&x>0?y.formatMessage({id:s.ETranslations.dapp_connect_sats_between},{min:S,max:x<S?j?.maxSendAmount:Math.min(x,Number(j?.maxSendAmount))}):void 0}),[d,S,x,y,j]),_=(0,o.useMemo)((function(){if(!A||!A.length)return null;try{return JSON.parse(A).map((function([e,n],o){if("text/plain"===e||"text/long-desc"===e){var r=`metadataDescription-${o}`;return t.setValue(r,n),(0,l.jsx)(c.Form.Field,{label:y.formatMessage({id:s.ETranslations.global_description}),name:r,children:(0,l.jsx)(c.TextArea,{editable:!1,disabled:!0,numberOfLines:2})},n)}})).filter(Boolean)}catch(e){}return[]}),[y,A,t]);return(0,l.jsxs)(c.Form,{form:t,children:[_,(0,l.jsx)(c.Form.Field,{label:y.formatMessage({id:s.ETranslations.dapp_connect_amount}),name:"amount",rules:w,labelAddon:v,children:(0,l.jsx)(c.Input,{editable:!b,readonly:b,placeholder:y.formatMessage({id:s.ETranslations.dapp_connect_enter_amount}),flex:1,addOns:[{label:y.formatMessage({id:s.ETranslations.global_sats})}]})}),Number(g)>0?(0,l.jsx)(c.Form.Field,{label:y.formatMessage({id:null!=f?f:s.ETranslations.dapp_connect_description_optional}),name:"comment",rules:{maxLength:{value:Number(g),message:y.formatMessage({id:s.ETranslations.dapp_connect_msg_description_can_be_up_to_int_characters},{number:g})}},defaultValue:"",children:(0,l.jsx)(c.TextArea,{editable:!h,disabled:h})}):null]})}},323696:(e,n,t)=>{t.r(n),t.d(n,{default:()=>v});var o=t(324586),r=t(586330),a=t(514041),c=t(654266),s=t(241440),i=t(908867),u=t(490343),l=t(610421),d=t(796895),m=t(24284),p=t(927799),f=t(980342),g=t(333597),A=t(507140),b=t(334439),h=t(42484),y=t(278484),j=t(864961),S=t(905710),x=t(789094),w=t(831085);function ownKeys(e,n){var t=Object.keys(e);if(Object.getOwnPropertySymbols){var o=Object.getOwnPropertySymbols(e);n&&(o=o.filter((function(n){return Object.getOwnPropertyDescriptor(e,n).enumerable}))),t.push.apply(t,o)}return t}function _objectSpread(e){for(var n=1;n<arguments.length;n++){var t=null!=arguments[n]?arguments[n]:{};n%2?ownKeys(Object(t),!0).forEach((function(n){(0,o.A)(e,n,t[n])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(t)):ownKeys(Object(t)).forEach((function(n){Object.defineProperty(e,n,Object.getOwnPropertyDescriptor(t,n))}))}return e}const v=function LnurlPayRequestModal(){var e,n,t,o,v=(0,i.A)(),_=(0,c.lq)().params,I=(0,m.A)(),{$sourceInfo:O}=I,{accountId:C,networkId:k,lnurlDetails:N,transfersInfo:D}=_.isSendFlow?_:I,M=(0,d.A)({id:null!=(e=O?.id)?e:"",closeWindowAfterResolved:!0}),F=(0,a.useMemo)((function(){if(N?.url)return new URL(N.url).origin}),[N?.url]),[L,T]=(0,a.useState)(!1),E=(0,p.E)({accountId:C,networkId:k}),{showContinueOperate:P,continueOperate:R,setContinueOperate:$,riskLevel:H,urlSecurityInfo:W}=(0,S.q)({origin:null!=F?F:""}),q=Math.floor(Number(null!=(n=N?.minSendable)?n:0)/1e3),z=Math.floor(Number(null!=(t=N?.maxSendable)?t:0)/1e3),Y=(0,u.useForm)({defaultValues:{amount:q>0&&q===z?`${q}`:"",comment:""}}),K=(0,a.useMemo)((function(){return N&&"number"==typeof N.commentAllowed&&N.commentAllowed>0?N.commentAllowed:0}),[N]),U=(0,a.useCallback)((o=(0,r.A)((function*(e){if(N&&!L){T(!0);var n,{serviceLightning:t}=l.A,o=Y.getValues(),r=new s.A(o.amount).times(1e3).toNumber();try{var a={amount:r,comment:o.comment?o.comment:void 0};n=yield t.fetchLnurlPayRequestResult({callback:N.callback,params:a})}catch(e){return T(!1),void M.reject()}try{var c=n.pr;(yield t.verifyInvoice({paymentInfo:n,metadata:N.metadata,amount:r,networkId:k,accountId:C}))||u.Toast.error({title:v.formatMessage({id:b.ETranslations.dapp_connect_msg_invalid_lightning_payment_request})});var i=D[0],d=[_objectSpread(_objectSpread({},i),{},{to:c,lnurlPaymentInfo:n,lightningAddress:(0,g.RT)(i.to)?i.to:void 0})];yield E.normalizeSendConfirm({transfersInfo:d,sameModal:!0,onSuccess:function(){_.isSendFlow||M.resolve({close:function(){e?.({flag:h.nd.Confirmed})},result:{status:"OK",data:void 0}})},onFail:function(){_.isSendFlow||M.reject()}})}catch(e){var m;M.reject();var p=null!=(m=e?.message)?m:e;throw new A.oZ({message:p,autoToast:!0})}finally{T(!1)}}})),function(e){return o.apply(this,arguments)}),[Y,L,N,k,C,D,M,v,E,_.isSendFlow]);return(0,w.jsx)(f.A,{dappApprove:M,children:(0,w.jsxs)(w.Fragment,{children:[(0,w.jsx)(u.Page.Header,{headerShown:!1}),(0,w.jsx)(u.Page.Body,{children:(0,w.jsxs)(j.HJ,{title:v.formatMessage({id:b.ETranslations.dapp_connect_lnurl_pay_request}),subtitleShown:!1,origin:null!=F?F:"",urlSecurityInfo:W,children:[_.isSendFlow?(0,w.jsx)(y.X1,{}):(0,w.jsx)(y.ZY,{readonly:!0}),(0,w.jsx)(x.A,{accountId:C,networkId:k,useFormReturn:Y,amount:q===z?q:void 0,amountReadOnly:q===z,minimumAmount:q,maximumAmount:z,commentAllowedLength:K,metadata:N.metadata})]})}),(0,w.jsx)(u.Page.Footer,{children:(0,w.jsx)(j.OS,{confirmText:v.formatMessage({id:b.ETranslations.global_continue}),continueOperate:R,setContinueOperate:function(e){$(!!e)},onConfirm:U,onCancel:function(){_.isSendFlow||M.reject()},confirmButtonProps:{loading:L,disabled:!R},showContinueOperateCheckbox:P,riskLevel:H})})]})})}}}]);