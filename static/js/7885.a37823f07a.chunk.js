"use strict";(self.webpackChunkweb=self.webpackChunkweb||[]).push([[7885],{82506:(e,n,t)=>{t.d(n,{d:()=>useDebounce});var o=t(578104);function useDebounce(e,n,t){var[r]=(0,o.d7)(e,n,t);return r}},278484:(e,n,t)=>{t.d(n,{wI:()=>DAppAccountListItem,ZY:()=>DAppAccountListStandAloneItem,X1:()=>DAppAccountListStandAloneItemForHomeScene,VV:()=>WalletConnectAccountTriggerList});var o=t(460986),r=t.n(o),c=t(324586),a=t(586330),s=t(514041),i=t(908867),u=t(17617),l=t(490343),d=t(610421),m=t(325809),p=t(237532),f=t(24284),g=t(911998),A=t(162616),h=t(226952),b=t(334439),x=(t(663522),t(584186)),v=t(714191),w=t(82506);var j=t(831085);function ownKeys(e,n){var t=Object.keys(e);if(Object.getOwnPropertySymbols){var o=Object.getOwnPropertySymbols(e);n&&(o=o.filter((function(n){return Object.getOwnPropertyDescriptor(e,n).enumerable}))),t.push.apply(t,o)}return t}function _objectSpread(e){for(var n=1;n<arguments.length;n++){var t=null!=arguments[n]?arguments[n]:{};n%2?ownKeys(Object(t),!0).forEach((function(n){(0,c.A)(e,n,t[n])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(t)):ownKeys(Object(t)).forEach((function(n){Object.defineProperty(e,n,Object.getOwnPropertyDescriptor(t,n))}))}return e}function DAppAccountListInitFromHome({num:e,shouldSyncFromHome:n}){var[,t]=(0,A.K7)(),o=(0,A.z$)();return(0,s.useEffect)((function(){return(0,a.A)((function*(){try{t((function(n){return _objectSpread(_objectSpread({},n),{},{[e]:{isLoading:!0}})})),yield x.A.wait(600),n&&(yield o.current.syncFromScene({from:{sceneName:v.Zs.home,sceneNum:0},num:e}))}finally{n&&(yield x.A.wait(300)),t((function(n){return _objectSpread(_objectSpread({},n),{},{[e]:{isLoading:!1}})}))}}))(),function(){t((function(n){return _objectSpread(_objectSpread({},n),{},{[e]:{isLoading:!1}})}))}}),[o,e,t,n]),null}function DAppAccountListItem({num:e,handleAccountChanged:n,readonly:t,networkReadonly:o,compressionUiMode:r,initFromHome:c,beforeShowTrigger:a,skeletonRenderDuration:i}){!function useHandleDiscoveryAccountChanged({num:e,handleAccountChanged:n}){var{activeAccount:t}=(0,A.LH)({num:e}),{selectedAccount:o}=(0,A.wz)({num:e}),r=(0,w.d)(t,200),c=(0,w.d)(o,200),a=(0,s.useRef)(t),i=(0,s.useRef)(o);(0,s.useEffect)((function(){a.current=t,i.current=o}),[t,o]),(0,s.useEffect)((function(){n&&(r.isOthersWallet&&r.account?.id===c.othersWalletAccountId||r.indexedAccount?.id===c.indexedAccountId)&&n({activeAccount:a.current,selectedAccount:i.current},e)}),[r,c,n,e])}({num:e,handleAccountChanged:n});var d=Boolean(c&&!t);return(0,j.jsxs)(j.Fragment,{children:[(0,j.jsxs)(l.YGroup,{bg:"$bg",borderRadius:"$3",borderColor:"$borderSubdued",borderWidth:u.A.hairlineWidth,separator:(0,j.jsx)(l.Divider,{}),disabled:t,children:[(0,j.jsx)(l.YGroup.Item,{children:(0,j.jsx)(m.jY,{num:e,beforeShowTrigger:a,disabled:o||t,loadingDuration:0})}),(0,j.jsx)(l.YGroup.Item,{children:(0,j.jsx)(p.Up,{num:e,compressionUiMode:r,beforeShowTrigger:a,loadingDuration:0})})]}),(0,j.jsx)(DAppAccountListInitFromHome,{num:e,shouldSyncFromHome:d})]})}function DAppAccountListStandAloneItem({readonly:e,handleAccountChanged:n,onConnectedAccountInfoChanged:t}){var o=(0,i.A)(),{serviceDApp:c,serviceNetwork:u}=d.A,{$sourceInfo:p}=(0,f.A)(),{result:A}=(0,g.yk)((0,a.A)((function*(){var e,n;if(!p?.origin||!p.scope)return{accountSelectorNum:null,networkIds:null};var t=(0,h.zg)(p.scope),o=t?(yield u.getNetworkIdsByImpls({impls:t})).networkIds:null,r=yield c.getConnectedAccountsInfo({origin:p.origin,scope:null!=(e=p.scope)?e:"",isWalletConnectRequest:p.isWalletConnectRequest});return Array.isArray(r)&&r.length>0&&"number"==typeof r[0]?.num?{accountSelectorNum:r[0].num,networkIds:o,existConnectedAccount:!0}:{accountSelectorNum:yield c.getAccountSelectorNum({origin:p.origin,scope:null!=(n=p.scope)?n:"",isWalletConnectRequest:p.isWalletConnectRequest}),networkIds:o,existConnectedAccount:!1}})),[p?.origin,p?.scope,p?.isWalletConnectRequest,c,u]);return(0,s.useEffect)((function(){r()(A?.accountSelectorNum)&&t&&t({num:A.accountSelectorNum,existConnectedAccount:A.existConnectedAccount})}),[A?.accountSelectorNum,A?.existConnectedAccount,t]),(0,j.jsxs)(l.YStack,{gap:"$2",testID:"DAppAccountListStandAloneItem",children:[(0,j.jsx)(l.SizableText,{size:"$headingMd",color:"$text",children:o.formatMessage({id:b.ETranslations.global_accounts})}),"number"==typeof A?.accountSelectorNum&&Array.isArray(A?.networkIds)?(0,j.jsx)(m.b8,{config:{sceneName:v.Zs.discover,sceneUrl:p?.origin},enabledNum:[A.accountSelectorNum],availableNetworksMap:{[A.accountSelectorNum]:{networkIds:A.networkIds}},children:(0,j.jsx)(DAppAccountListItem,{initFromHome:!A?.existConnectedAccount,num:A?.accountSelectorNum,handleAccountChanged:n,readonly:e})}):null]})}function DAppAccountListStandAloneItemForHomeScene(){var e=(0,i.A)();return(0,j.jsxs)(l.YStack,{gap:"$2",testID:"DAppAccountListStandAloneItem",children:[(0,j.jsx)(l.SizableText,{size:"$headingMd",color:"$text",children:e.formatMessage({id:b.ETranslations.global_accounts})}),(0,j.jsx)(m.b8,{config:{sceneName:v.Zs.home},enabledNum:[0],children:(0,j.jsx)(DAppAccountListItem,{initFromHome:!1,num:0,readonly:!0})})]})}function WalletConnectAccountTriggerList({sceneUrl:e,sessionAccountsInfo:n,handleAccountChanged:t}){var o=n.map((function(e){return e.accountSelectorNum})),r=n.reduce((function(e,n){var t=n.networkIds.filter(Boolean);return e[n.accountSelectorNum]={networkIds:t,defaultNetworkId:t[0]},e}),{});return(0,j.jsxs)(l.YStack,{gap:"$2",children:[(0,j.jsx)(l.SizableText,{size:"$headingMd",color:"$text",children:"Accounts"}),Array.isArray(n)&&n.length?(0,j.jsx)(m.b8,{config:{sceneName:v.Zs.discover,sceneUrl:e},enabledNum:o,availableNetworksMap:r,children:(0,j.jsx)(l.YStack,{gap:"$2",children:n.map((function(e){return(0,j.jsx)(l.Stack,{children:(0,j.jsx)(DAppAccountListItem,{initFromHome:!0,num:e.accountSelectorNum,handleAccountChanged:t})},e.accountSelectorNum)}))})}):null]})}},980342:(e,n,t)=>{t.d(n,{A:()=>a,z:()=>useDappCloseHandler});var o=t(490343),r=t(42484),c=t(831085);function useDappCloseHandler(e,n){return function(t){t?.flag!==r.nd.Confirmed&&e.reject(),"function"==typeof n&&n(t)}}const a=function DappOpenModalPage({children:e,onClose:n,dappApprove:t}){var r=useDappCloseHandler(t,n);return(0,c.jsxs)(o.Page,{scrollEnabled:!0,onClose:r,children:[(0,c.jsx)(o.Page.Header,{headerShown:!1}),e]})}},646433:(e,n,t)=>{t.d(n,{A:()=>d});var o=t(514041),r=t(241440),c=t(908867),a=t(490343),s=t(334439),i=t(610421),u=t(911998),l=t(831085);const d=function LNMakeInvoiceForm(e){var{networkId:n,useFormReturn:t,amount:d,minimumAmount:m,maximumAmount:p,descriptionLabelId:f,memo:g,amountReadOnly:A}=e,h=(0,c.A)(),{result:b}=(0,u.yk)((function(){return i.A.serviceLightning.getInvoiceConfig({networkId:n})}),[n]),x=new r.A(null!=m?m:0).toNumber(),v=new r.A(null!=p?p:0).toNumber(),w=(0,o.useMemo)((function(){var e;return v&&v>0&&v>x&&v<Number(b?.maxReceiveAmount)&&(e=v),{min:{value:x,message:h.formatMessage({id:s.ETranslations.dapp_connect_amount_should_be_at_least},{0:x})},max:e?{value:e,message:h.formatMessage({id:s.ETranslations.dapp_connect_amount_should_not_exceed},{0:e})}:void 0,pattern:{value:/^[0-9]*$/,message:h.formatMessage({id:s.ETranslations.send_field_only_integer})},validate:function(e){if(!(x<=0)||e){var n=new r.A(e);return n.isInteger()?b?.maxReceiveAmount&&n.isGreaterThan(b?.maxReceiveAmount)?h.formatMessage({id:s.ETranslations.dapp_connect_amount_should_not_exceed},{0:b?.maxReceiveAmount}):void 0:h.formatMessage({id:s.ETranslations.send_field_only_integer})}}}}),[x,v,b,h]),j=(0,o.useMemo)((function(){if(!(Number(d)>0||x>0&&x===v))return x>0&&v>0?h.formatMessage({id:s.ETranslations.dapp_connect_sats_between},{min:x,max:v<x?b?.maxReceiveAmount:Math.min(v,Number(b?.maxReceiveAmount))}):void 0}),[d,x,v,b,h]);return(0,l.jsxs)(a.Form,{form:t,children:[(0,l.jsx)(a.Form.Field,{label:h.formatMessage({id:s.ETranslations.send_amount}),name:"amount",rules:w,labelAddon:j,children:(0,l.jsx)(a.Input,{editable:!A,readonly:A,placeholder:h.formatMessage({id:s.ETranslations.dapp_connect_enter_amount}),flex:1,addOns:[{label:h.formatMessage({id:s.ETranslations.global_sats})}]})}),(0,l.jsx)(a.Form.Field,{label:h.formatMessage({id:null!=f?f:s.ETranslations.global_description}),name:"description",rules:{maxLength:{value:40,message:h.formatMessage({id:s.ETranslations.dapp_connect_msg_description_can_be_up_to_int_characters},{number:"40"})}},defaultValue:"",children:(0,l.jsx)(a.TextArea,{editable:!g})})]})}},307885:(e,n,t)=>{t.r(n),t.d(n,{default:()=>w});var o=t(586330),r=t(514041),c=t(654266),a=t(241440),s=t(908867),i=t(490343),u=t(610421),l=t(796895),d=t(24284),m=t(980342),p=t(507140),f=t(334439),g=t(42484),A=t(278484),h=t(864961),b=t(905710),x=t(646433),v=t(831085);const w=function LnurlWithdrawModal(){var e,n,t,w,j=(0,s.A)(),y=(0,c.lq)().params,{isSendFlow:S}=y,_=(0,d.A)(),{$sourceInfo:I}=_,{accountId:C,networkId:k,lnurlDetails:N}=S?y:_,D=(0,r.useMemo)((function(){if(N?.url)return new URL(N.url).origin}),[N?.url]),M=(0,l.A)({id:null!=(e=I?.id)?e:"",closeWindowAfterResolved:!0}),[O,L]=(0,r.useState)(!1),{showContinueOperate:T,continueOperate:R,setContinueOperate:F,riskLevel:E,urlSecurityInfo:H}=(0,b.q)({origin:null!=D?D:""}),$=Math.floor(Number(null!=(n=N?.minWithdrawable)?n:0)/1e3),W=Math.floor(Number(null!=(t=N?.maxWithdrawable)?t:0)/1e3),P=(0,i.useForm)({defaultValues:{amount:$>0&&$===W?`${$}`:"",description:N.defaultDescription}}),q=(0,r.useCallback)((w=(0,o.A)((function*(e){if(N&&!O){L(!0);var{serviceLightning:n}=u.A,t=P.getValues(),o=new a.A(t.amount).times(1e3).toNumber();try{var r=yield n.createInvoice({networkId:k,accountId:C,amount:new a.A(o).toString(),description:N.defaultDescription}),{callback:c,k1:s}=N;yield n.fetchLnurlWithdrawRequestResult({callback:c,k1:s,pr:r.payment_request}),S||M.resolve(),i.Toast.success({title:"Withdrawer success"}),e?.({flag:g.nd.Confirmed})}catch(n){var l=n?.message;throw S||setTimeout((function(){M.resolve({close:function(){e?.({flag:g.nd.Confirmed})},result:{status:"ERROR",reason:l}})}),1500),new p.oZ({message:l,autoToast:!0})}finally{L(!1)}}})),function(e){return w.apply(this,arguments)}),[P,O,N,k,C,M,S]);return(0,v.jsx)(m.A,{dappApprove:M,children:(0,v.jsxs)(v.Fragment,{children:[(0,v.jsx)(i.Page.Header,{headerShown:!1}),(0,v.jsx)(i.Page.Body,{children:(0,v.jsxs)(h.HJ,{title:j.formatMessage({id:f.ETranslations.dapp_connect_lnurl_withdraw_request}),subtitleShown:!1,origin:null!=D?D:"",urlSecurityInfo:H,children:[S?(0,v.jsx)(A.X1,{}):(0,v.jsx)(A.ZY,{readonly:!0}),(0,v.jsx)(x.A,{accountId:C,networkId:k,useFormReturn:P,amount:$===W?$:void 0,amountReadOnly:$===W,minimumAmount:$,maximumAmount:W,memo:N.defaultDescription})]})}),(0,v.jsx)(i.Page.Footer,{children:(0,v.jsx)(h.OS,{confirmText:j.formatMessage({id:f.ETranslations.global_withdraw}),continueOperate:R,setContinueOperate:function(e){F(!!e)},onConfirm:q,onCancel:function(){S||M.reject()},confirmButtonProps:{loading:O,disabled:!R},showContinueOperateCheckbox:T,riskLevel:E})})]})})}}}]);