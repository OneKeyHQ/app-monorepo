"use strict";(self.webpackChunkweb=self.webpackChunkweb||[]).push([[194],{183259:(e,t,r)=>{r.d(t,{U:()=>a});var n=r(514041),i=r(17617),o=r(490343),s=r(831085);var a=(0,n.memo)((function BasicDiscoveryIcon({uri:e,size:t,borderRadius:r="$2"}){return e?(0,s.jsxs)(o.Image,{size:t,borderRadius:r,borderWidth:i.A.hairlineWidth,borderColor:"$borderSubdued",borderCurve:"continuous",children:[(0,s.jsx)(o.Image.Source,{source:{uri:decodeURIComponent(e)}}),(0,s.jsx)(o.Image.Fallback,{children:(0,s.jsx)(o.Stack,{bg:"$bgStrong",ai:"center",jc:"center",width:"100%",height:"100%",children:(0,s.jsx)(o.Icon,{name:"GlobusOutline",width:"100%",height:"100%"})})}),(0,s.jsx)(o.Image.Loading,{children:(0,s.jsx)(o.Skeleton,{width:"100%",height:"100%"})})]}):(0,s.jsx)(o.Skeleton,{width:t,height:t,radius:"round"})}))},800194:(e,t,r)=>{r.r(t),r.d(t,{default:()=>w});var n=r(324586),i=r(503668),o=r.n(i),s=r(586330),a=r(514041),c=r(908867),u=r(490343),l=r(610421),d=r(791088),f=r(498356),h=r(911998),p=r(657412),b=r(334439),m=r(948675),g=r(899035),j=r(567807),y=r(183259),x=r(564452),v=r(831085);function ownKeys(e,t){var r=Object.keys(e);if(Object.getOwnPropertySymbols){var n=Object.getOwnPropertySymbols(e);t&&(n=n.filter((function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable}))),r.push.apply(r,n)}return r}function _objectSpread(e){for(var t=1;t<arguments.length;t++){var r=null!=arguments[t]?arguments[t]:{};t%2?ownKeys(Object(r),!0).forEach((function(t){(0,n.A)(e,t,r[t])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(r)):ownKeys(Object(r)).forEach((function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(r,t))}))}return e}const w=(0,x.k)((function HistoryListModal(){var[e,t]=(0,a.useState)(!1),r=(0,c.A)(),n=(0,f.A)(),{removeBrowserHistory:i,removeAllBrowserHistory:x}=(0,p.cS)().current,{gtMd:w}=(0,u.useMedia)(),{handleOpenWebSite:O}=(0,p.yZ)().current,[S,D]=(0,a.useState)(1),{result:_,run:k}=(0,h.yk)((0,s.A)((function*(){var e=function groupDataByDate(e){var t=e.reduce((function(e,t){var r=(0,j.wI)(new Date(t.createdAt));return e[r]?e[r].push(t):e[r]=[t],e}),{});return Object.keys(t).map((function(e){return{title:e,data:t[e]}}))}(yield l.A.serviceDiscovery.fetchHistoryData(S));return e})),[S],{watchLoading:!0}),P=(0,a.useRef)(!1),E=(0,a.useCallback)((0,s.A)((function*(){yield x(),P.current=!0,setTimeout((function(){k()}),200)})),[k,x]);(0,a.useEffect)((function(){P.current&&0===_?.length&&(n.pop(),P.current=!1)}),[n,_?.length]);var I=(0,a.useCallback)((function(){return(0,v.jsxs)(u.XStack,{children:[e?(0,v.jsxs)(v.Fragment,{children:[(0,v.jsx)(u.IconButton,{variant:"tertiary",icon:"BroomOutline",title:r.formatMessage({id:b.ETranslations.explore_remove_all}),onPress:function(){u.Dialog.show({title:r.formatMessage({id:b.ETranslations.explore_clear_history_prompt}),description:r.formatMessage({id:b.ETranslations.explore_clear_history_message}),onConfirm:function(){return E()},onConfirmText:r.formatMessage({id:b.ETranslations.explore_remove_all})})}}),(0,v.jsx)(u.Divider,{vertical:!0,mx:"$3"})]}):null,(0,v.jsx)(u.Button,{variant:"tertiary",size:"medium",onPress:function(){return t((function(e){return!e}))},children:e?r.formatMessage({id:b.ETranslations.global_done}):r.formatMessage({id:b.ETranslations.global_edit})})]})}),[E,e,r]),T=(0,a.useCallback)((function(e){return e.id}),[]);return(0,v.jsxs)(u.Page,{scrollEnabled:!0,children:[(0,v.jsx)(u.Page.Header,{title:r.formatMessage({id:b.ETranslations.explore_history}),headerRight:I}),(0,v.jsx)(u.Page.Body,{children:(0,v.jsx)(u.SectionList,{testID:"History-SectionList",height:"100%",estimatedItemSize:"$16",extraData:e,sections:o()(_)?[]:_,renderSectionHeader:function({section:{title:e}}){return(0,v.jsx)(u.SectionList.SectionHeader,{title:e})},keyExtractor:T,renderItem:function({item:t}){return(0,v.jsx)(d.c,_objectSpread(_objectSpread({renderAvatar:(0,v.jsx)(y.U,{uri:t.logo,size:"$10"}),title:t.title,titleProps:{numberOfLines:1},subtitle:t.url,subtitleProps:{numberOfLines:1},testID:`search-modal-${t.url.toLowerCase()}`},!e&&{onPress:function(){O({switchToMultiTabBrowser:w,navigation:n,webSite:{url:t.url,title:t.title}}),m.U.discovery.dapp.enterDapp({dappDomain:t.url,dappName:t.title,enterMethod:g.z.history})}}),{},{children:e?(0,v.jsx)(d.c.IconButton,{icon:"DeleteOutline",onPress:function(){i(t.id),P.current=!0,setTimeout((function(){k()}),200),u.Toast.success({title:r.formatMessage({id:b.ETranslations.explore_removed_success})})}}):null}),t.id)},onEndReached:function(){D((function(e){return e+1}))}})})]})}))}}]);