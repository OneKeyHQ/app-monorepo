"use strict";(self.webpackChunkweb=self.webpackChunkweb||[]).push([[37674],{326745:(e,t,n)=>{n.d(t,{u:()=>useAppRoute});var r=n(654266);function useAppRoute(){return(0,r.lq)()}},138584:(e,t,n)=>{n.d(t,{Py:()=>SimpleSpinnerSkeleton,am:()=>isLoadingState,bU:()=>PageFrame,o0:()=>isErrorState});var r=n(908867),o=n(490343),a=n(791088),s=n(334439),i=n(831085),PageErrOccurred=function({onPress:e}){var t=(0,r.A)();return(0,i.jsx)(o.Empty,{pt:"$32",icon:"ErrorOutline",title:t.formatMessage({id:s.ETranslations.global_an_error_occurred}),description:t.formatMessage({id:s.ETranslations.global_an_error_occurred_desc}),buttonProps:{onPress:e,children:t.formatMessage({id:s.ETranslations.global_refresh})}})},SimpleSpinnerSkeleton=function(){return(0,i.jsxs)(o.Stack,{children:[(0,i.jsx)(o.Stack,{px:"$5",py:"$2",children:(0,i.jsx)(o.Skeleton.HeadingSm,{})}),Array.from({length:3}).map((function(e,t){return(0,i.jsxs)(a.c,{children:[(0,i.jsx)(o.Skeleton,{h:"$10",w:"$10",radius:"round"}),(0,i.jsxs)(o.Stack,{children:[(0,i.jsx)(o.Skeleton.BodyLg,{}),(0,i.jsx)(o.Skeleton.BodyMd,{})]})]},t)}))]})},isLoadingState=function({result:e,isLoading:t}){return Boolean(void 0===e&&(void 0===t||!0===t))},isErrorState=function({result:e,isLoading:t}){return Boolean(void 0===e&&!1===t)},PageFrame=function({children:e,loading:t,LoadingSkeleton:n,error:r,onRefresh:o}){return t?n?(0,i.jsx)(n,{}):null:r?(0,i.jsx)(PageErrOccurred,{onPress:o}):(0,i.jsx)(i.Fragment,{children:e})}},598312:(e,t,n)=>{n.d(t,{w:()=>useEarnTxLabel});var r=n(514041),o=n(908867),a=n(334439);function useEarnTxLabel(){var e=(0,o.A)();return(0,r.useCallback)((function(t){var n;return null!=(n={stake:e.formatMessage({id:a.ETranslations.earn_stake}),redeem:e.formatMessage({id:a.ETranslations.earn_redeem}),withdraw:e.formatMessage({id:a.ETranslations.global_withdraw}),claim:e.formatMessage({id:a.ETranslations.earn_claim})}[t.toLowerCase()])?n:t}),[e])}},637674:(e,t,n)=>{n.r(t),n.d(t,{default:()=>__WEBPACK_DEFAULT_EXPORT__});var r=n(324586),o=n(487809),a=n.n(o),s=n(586330),i=n(514041),c=n(908867),l=n(490343),d=n(610421),u=n(791088),f=n(498356),g=n(326745),p=n(911998),k=n(334439),m=n(392097),b=n(567807),v=n(138584),y=n(598312),h=n(905817),x=n(831085);function ownKeys(e,t){var n=Object.keys(e);if(Object.getOwnPropertySymbols){var r=Object.getOwnPropertySymbols(e);t&&(r=r.filter((function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable}))),n.push.apply(n,r)}return n}var HistoryItem=function({item:e,provider:t,token:n}){var r=(0,f.A)(),o=(0,g.u)(),{accountId:a,networkId:s}=o.params,c=(0,i.useCallback)((function(){r.push(m.kZ.HistoryDetails,{networkId:s,accountId:a,transactionHash:e.txHash,historyTx:void 0,isAllNetworks:!1})}),[a,s,e,r]);return(0,x.jsx)(u.c,{avatarProps:{src:n?.logoURI},title:e.title,subtitle:t?(0,h.c)(t):void 0,onPress:c,children:(0,x.jsx)(l.YStack,{children:e.amount&&Number(e.amount)>0?(0,x.jsx)(l.NumberSizeableText,{size:"$bodyLgMedium",formatter:"balance",color:"receive"===e.direction?"$textSuccess":void 0,formatterOptions:{tokenSymbol:n?.symbol,showPlusMinusSigns:!0},children:`${"send"===e.direction?"-":"+"}${e.amount}`}):null})})},keyExtractor=function(e){var t=e?.txHash;return t},HistoryContent=function({sections:e,network:t,tokenMap:n,provider:r}){var o=(0,i.useCallback)((function({item:e}){return(0,x.jsx)(HistoryItem,{item:e,network:t,token:n[e.tokenAddress],provider:r})}),[t,n,r]),a=(0,i.useCallback)((function({section:e}){return(0,x.jsx)(l.SectionList.SectionHeader,{title:e.title,titleProps:{color:e.isPending?"$textCaution":void 0},justifyContent:"space-between"})}),[]),s=(0,c.A)();return(0,x.jsx)(l.SectionList,{estimatedItemSize:"$14",sections:e,renderItem:o,renderSectionHeader:a,keyExtractor,ListEmptyComponent:(0,x.jsx)(l.Empty,{pt:"$46",icon:"ClockTimeHistoryOutline",title:s.formatMessage({id:k.ETranslations.global_no_transactions_yet}),description:s.formatMessage({id:k.ETranslations.global_no_transactions_yet_desc})})})};const __WEBPACK_DEFAULT_EXPORT__=function(){var e=(0,g.u)(),t=(0,c.A)(),n=(0,y.w)(),{accountId:o,networkId:i,symbol:u,provider:f,stakeTag:m}=e.params,{result:h,isLoading:w,run:j}=(0,p.yk)((0,s.A)((function*(){var e=yield d.A.serviceStaking.getStakeHistory({accountId:o,networkId:i,symbol:u,provider:f}),s=a()(e.list,(function(e){return(0,b.Yq)(new Date(1e3*e.timestamp),{hideTimeForever:!0})})),c=Object.entries(s).map((function([e,t]){return{title:e,data:t}})).sort((function(e,t){return t.data[0].timestamp-e.data[0].timestamp})),l=function _objectSpread(e){for(var t=1;t<arguments.length;t++){var n=null!=arguments[t]?arguments[t]:{};t%2?ownKeys(Object(n),!0).forEach((function(t){(0,r.A)(e,t,n[t])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(n)):ownKeys(Object(n)).forEach((function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(n,t))}))}return e}({},e.tokenMap);if(m){yield d.A.serviceHistory.fetchAccountHistory({accountId:o,networkId:i});var g=yield d.A.serviceStaking.fetchLocalStakingHistory({accountId:o,networkId:i,stakeTag:m});g.forEach((function(e){if(e.stakingInfo.receive){var t=e.stakingInfo.receive;l[t.token.address]=t.token}if(e.stakingInfo.send){var n=e.stakingInfo.send;l[n.token.address]=n.token}}));var p=g.map((function(e){var t,r,o,a,s=null!=(t=e.stakingInfo.send)?t:e.stakingInfo.receive;return{txHash:e.decodedTx.txid,timestamp:null!=(r=null!=(o=e.decodedTx.createdAt)?o:e.decodedTx.updatedAt)?r:0,title:n(e.stakingInfo.label),direction:e.stakingInfo.send?"send":"receive",amount:s?.amount,tokenAddress:null!=(a=s?.token.address)?a:""}}));p.length>0&&c.unshift({title:t.formatMessage({id:k.ETranslations.global_pending}),data:p,isPending:!0})}return{network:e.network,sections:c,tokenMap:l}})),[o,i,u,f,m,n,t],{watchLoading:!0,pollingInterval:3e4});return(0,x.jsxs)(l.Page,{scrollEnabled:!0,children:[(0,x.jsx)(l.Page.Header,{title:t.formatMessage({id:k.ETranslations.global_history})}),(0,x.jsx)(l.Page.Body,{children:(0,x.jsx)(v.bU,{LoadingSkeleton:v.Py,error:(0,v.o0)({result:h,isLoading:w}),loading:(0,v.am)({result:h,isLoading:w}),onRefresh:j,children:h?(0,x.jsx)(HistoryContent,{sections:h.sections,network:h.network,tokenMap:h.tokenMap,provider:f}):null})})]})}},905817:(e,t,n)=>{n.d(t,{FZ:()=>countDecimalPlaces,Y:()=>buildLocalTxStatusSyncId,c:()=>capitalizeString});var r=n(241440),buildLocalTxStatusSyncId=function(e){return`${e.provider.name.toLowerCase()}-${e.token.info.symbol.toLowerCase()}`};function capitalizeString(e){return e?e.charAt(0).toUpperCase()+e.slice(1):e}function countDecimalPlaces(e){var t="string"==typeof e?Number(e):e;if(Number.isNaN(t))return 0;var n="string"==typeof e?e:(0,r.A)(e).toFixed(),o=n.indexOf(".");return-1===o?0:n.length-o-1}}}]);