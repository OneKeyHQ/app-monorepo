"use strict";(self.webpackChunkweb=self.webpackChunkweb||[]).push([[72915],{72915:(e,t,n)=>{n.r(t),n.d(t,{default:()=>__WEBPACK_DEFAULT_EXPORT__});var i=n(908867),s=n(490343),r=n(610421),a=n(575995),c=n(791088),l=n(911998),o=n(334439),d=n(831085),u={mainAxis:-4,crossAxis:-10},AccountDerivationListItem=function({title:e,icon:t,networkId:n}){return(0,d.jsx)(a.Vq,{networkId:n,placement:"bottom-end",offset:u,renderTrigger:function({label:n}){return(0,d.jsx)(c.c,{userSelect:"none",title:e,avatarProps:{src:t,size:"$8"},children:(0,d.jsxs)(s.XStack,{children:[(0,d.jsx)(s.SizableText,{mr:"$3",children:n}),(0,d.jsx)(c.c.DrillIn,{name:"ChevronDownSmallSolid"})]})})}})};const __WEBPACK_DEFAULT_EXPORT__=function(){var{result:{items:e},isLoading:t}=(0,l.yk)((function(){return r.A.serviceSetting.getAccountDerivationConfig()}),[],{initResult:{enabledNum:[],availableNetworksMap:{},items:[]},watchLoading:!0}),n=(0,i.A)();return(0,d.jsxs)(s.Page,{scrollEnabled:!0,children:[(0,d.jsx)(s.Page.Header,{title:n.formatMessage({id:o.ETranslations.settings_account_derivation_path})}),(0,d.jsx)(s.Stack,{px:"$5",py:"$3",children:(0,d.jsx)(s.SizableText,{size:"$bodyLg",children:n.formatMessage({id:o.ETranslations.settings_account_derivation_path_desc})})}),t?null:(0,d.jsx)(s.Stack,{children:e.map((function(e){return(0,d.jsx)(AccountDerivationListItem,{title:e.title,icon:e.icon,networkId:e.defaultNetworkId},e.icon)}))})]})}}}]);