"use strict";(self.webpackChunkweb=self.webpackChunkweb||[]).push([[19634],{719634:(e,t,n)=>{n.r(t),n.d(t,{default:()=>T,tabGridRefs:()=>S});var o=n(324586),r=n(586330),i=n(514041),s=n(908867),a=n(17617),l=n(490343),c=n(610421),d=n(498356),u=n(657412),b=n(334439),m=n(392097),f=n(574319),p=n(831085);const g=function MobileTabListItem({id:e,activeTabId:t,onSelectedItem:n,onCloseItem:o,onLongPress:r}){var i,{tab:s}=(0,f.D$)(e),c=t===e;return(0,p.jsx)(l.Stack,{width:"100%",onPress:function(){n(e)},onLongPress:function(){r(e)},p:"$1",animation:"quick",pressStyle:{scale:.95},testID:`tab-modal-list-item-${e}`,children:(0,p.jsx)(l.Stack,{borderRadius:"$4",borderWidth:"$1",borderColor:c?"$brand6":"$transparent",p:"$0.5",borderCurve:"continuous",testID:c?`tab-modal-active-item-${e}`:`tab-modal-no-active-item-${e}`,children:(0,p.jsxs)(l.Group,{borderRadius:"$2.5",borderWidth:a.A.hairlineWidth,borderColor:"$borderSubdued",separator:(0,p.jsx)(l.Divider,{}),children:[(0,p.jsx)(l.Group.Item,{children:(0,p.jsxs)(l.XStack,{py:"$2",pl:"$2.5",pr:"$2",alignItems:"center",bg:"$bgSubdued",borderCurve:"continuous",children:[(0,p.jsxs)(l.Image,{size:"$4",borderRadius:"$1",children:[(0,p.jsx)(l.Image.Source,{src:s?.favicon}),(0,p.jsx)(l.Image.Fallback,{children:(0,p.jsx)(l.Icon,{name:"GlobusOutline",size:"$4"})}),(0,p.jsx)(l.Image.Loading,{children:(0,p.jsx)(l.Skeleton,{width:"100%",height:"100%"})})]}),(0,p.jsx)(l.SizableText,{flex:1,size:"$bodySm",textAlign:"left",numberOfLines:1,mx:"$2",children:(null!=(i=s?.customTitle?.length)?i:0)>0?s?.customTitle:s?.title}),(0,p.jsx)(l.IconButton,{variant:"tertiary",size:"small",icon:"CrossedSmallOutline",onPress:function(){return o(e)},testID:`tab-modal-header-close-${e}`})]})}),(0,p.jsx)(l.Group.Item,{children:(0,p.jsx)(l.Stack,{pb:"100%",children:(0,p.jsx)(l.Stack,{position:"absolute",left:0,top:0,right:0,bottom:0,children:(0,p.jsx)(l.Image,{w:"100%",h:"100%",borderBottomLeftRadius:10,borderBottomRightRadius:10,children:(0,p.jsx)(l.Image.Source,{source:{uri:s?.thumbnail}})})})})})]})})})};const h=function MobileTabListPinnedItem({id:e,activeTabId:t,onSelectedItem:n,onLongPress:o}){var r,{tab:i}=(0,f.D$)(e),s=t===e;return(0,p.jsx)(l.Stack,{p:"$0.5",minWidth:"$28",maxWidth:"$40",borderRadius:"$4",borderWidth:4,borderColor:s?"$brand6":"$transparent",marginHorizontal:2,onPress:function(){n(e)},onLongPress:function(){o(e)},animation:"quick",pressStyle:{scale:.95},children:(0,p.jsxs)(l.XStack,{bg:"$bgStrong",p:"$2",alignItems:"center",borderRadius:"$2.5",testID:`tab-list-stack-pinned-${e}`,children:[(0,p.jsxs)(l.Image,{size:"$4",borderRadius:"$1",children:[(0,p.jsx)(l.Image.Source,{src:i?.favicon}),(0,p.jsx)(l.Image.Fallback,{delayMs:100,children:(0,p.jsx)(l.Icon,{name:"GlobusOutline",size:"$4"})}),(0,p.jsx)(l.Image.Loading,{children:(0,p.jsx)(l.Skeleton,{width:"100%",height:"100%"})})]}),(0,p.jsx)(l.SizableText,{flex:1,size:"$bodySm",numberOfLines:1,ml:"$2",children:(null!=(r=i?.customTitle?.length)?r:0)>0?i?.customTitle:i?.title})]})})};var x=n(416526),j=n(670656),I=(x.A.get("window").width,x.A.get("window").width,j.A.get(),n(958411)),k=n(564452);function ownKeys(e,t){var n=Object.keys(e);if(Object.getOwnPropertySymbols){var o=Object.getOwnPropertySymbols(e);t&&(o=o.filter((function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable}))),n.push.apply(n,o)}return n}function _objectSpread(e){for(var t=1;t<arguments.length;t++){var n=null!=arguments[t]?arguments[t]:{};t%2?ownKeys(Object(n),!0).forEach((function(t){(0,o.A)(e,t,n[t])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(n)):ownKeys(Object(n)).forEach((function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(n,t))}))}return e}var S={};function TabToolBar({closeAllDisabled:e,onAddTab:t,onCloseAll:n,onDone:o}){var r=(0,s.A)();return(0,p.jsxs)(l.Stack,{py:"$2",flexDirection:"row",alignItems:"center",borderTopWidth:a.A.hairlineWidth,borderTopColor:"$borderSubdued",children:[(0,p.jsx)(l.Stack,{flex:1,alignItems:"center",justifyContent:"center",children:(0,p.jsx)(l.Button,{variant:"tertiary",size:"medium",onPress:n,disabled:e,testID:"tab-list-modal-close-all",children:r.formatMessage({id:b.ETranslations.explore_close_all})})}),(0,p.jsx)(l.Stack,{flex:1,alignItems:"center",justifyContent:"center",children:(0,p.jsx)(l.IconButton,{variant:"secondary",size:"medium",icon:"PlusLargeOutline",testID:"browser-bar-add",onPress:t})}),(0,p.jsx)(l.Stack,{flex:1,alignItems:"center",justifyContent:"center",children:(0,p.jsx)(l.Button,{variant:"tertiary",size:"medium",onPress:o,testID:"tab-list-modal-done",children:r.formatMessage({id:b.ETranslations.global_done})})})]})}const T=(0,k.k)((function MobileTabListModal(){var e,t=(0,s.A)(),n=(0,d.A)(),{tabs:o}=(0,f.oM)(),a=(0,i.useMemo)((function(){return(null!=o?o:[]).filter((function(e){return!e.isPinned}))}),[o]),x=(0,i.useMemo)((function(){return(null!=o?o:[]).filter((function(e){return e.isPinned}))}),[o]),{disabledAddedNewTab:j}=(0,f.bI)(),{activeTabId:k}=(0,f.cf)(),{addBrowserBookmark:S,removeBrowserBookmark:T}=(0,u.Gd)().current,{closeAllWebTabs:$,setCurrentWebTab:y,closeWebTab:P,setPinnedTab:v,setDisplayHomePage:w}=(0,u.AO)().current,_=(0,i.useRef)(!1);(0,i.useEffect)((function(){_.current&&!o.length&&(w(!0),n.pop()),_.current=!1}),[o,w,n]);var C,D,M=(0,i.useMemo)((function(){return a.findIndex((function(e){return e.id===k}))}),[a,k]),O=(0,i.useMemo)((function(){return x.findIndex((function(e){return e.id===k}))}),[x,k]),{handleShareUrl:A,handleRenameTab:B}=(0,I.A)(),{copyText:L}=(0,l.useClipboard)(),E=(0,i.useCallback)((function(e,n,o){e?S({url:n,title:o}):T(n),l.Toast.success({title:e?t.formatMessage({id:b.ETranslations.explore_toast_bookmark_added}):t.formatMessage({id:b.ETranslations.explore_toast_bookmark_removed})})}),[S,T,t]),z=(0,i.useCallback)((function(e){A(e)}),[A]),R=(0,i.useCallback)((C=(0,r.A)((function*(e){var t=e?new URL(e).origin:null;t&&(yield c.A.serviceDApp.disconnectWebsite({origin:t,storageType:"injectedProvider",entry:"Browser"}))})),function(e){return C.apply(this,arguments)}),[]),W=(0,i.useCallback)((function(e,n){v({id:e,pinned:n}),l.Toast.success({title:n?t.formatMessage({id:b.ETranslations.explore_toast_pinned}):t.formatMessage({id:b.ETranslations.explore_toast_unpinned})})}),[v,t]),G=(0,i.useCallback)((function(e){_.current=!0,P({tabId:e,entry:"Menu"})}),[P]),H=(0,i.useCallback)((function(){j?l.Toast.message({title:t.formatMessage({id:b.ETranslations.explore_toast_tab_limit_reached},{number:"20"})}):(n.pop(),setTimeout((function(){n.pushModal(m.ry.DiscoveryModal,{screen:m.v1.SearchModal})}),0))}),[j,n,t]),V=(0,i.useCallback)((D=(0,r.A)((function*(e,n){var o=e?.url?new URL(e.url).origin:null,r=!1;if(o){var i=yield c.A.serviceDApp.findInjectedAccountByOrigin(o);r=(null!=i?i:[]).length>0}l.ActionList.show({title:t.formatMessage({id:b.ETranslations.explore_options}),sections:[{items:[{label:t.formatMessage({id:e.isBookmark?b.ETranslations.explore_remove_bookmark:b.ETranslations.explore_add_bookmark}),icon:e.isBookmark?"StarSolid":"StarOutline",onPress:function(){var t;return E(!e.isBookmark,e.url,null!=(t=e.title)?t:"")},testID:"action-list-item-"+(e.isBookmark?"remove-bookmark":"bookmark")},{label:t.formatMessage({id:e.isPinned?b.ETranslations.explore_unpin:b.ETranslations.explore_pin}),icon:e.isPinned?"ThumbtackSolid":"ThumbtackOutline",onPress:function(){return W(n,!e.isPinned)},testID:"action-list-item-"+(e.isPinned?"un-pin":"pin")},{label:t.formatMessage({id:b.ETranslations.explore_rename}),icon:"PencilOutline",onPress:function(){B(e)},testID:"action-list-item-rename"}].filter(Boolean)},{items:[{label:t.formatMessage({id:b.ETranslations.global_copy_url}),icon:"LinkOutline",onPress:function(){L(e.url)},testID:"action-list-item-copy"},{label:t.formatMessage({id:b.ETranslations.explore_share}),icon:"ShareOutline",onPress:function(){return z(e.url)},testID:"action-list-item-share"}].filter(Boolean)},{items:[r&&{label:t.formatMessage({id:b.ETranslations.explore_disconnect}),icon:"BrokenLinkOutline",onPress:function(){R(e.url)},testID:"action-list-item-disconnect"},{label:t.formatMessage({id:b.ETranslations.explore_close_tab}),icon:"CrossedLargeOutline",onPress:function(){return G(n)},testID:"action-list-item-close-close-tab"}].filter(Boolean)}]})})),function(e,t){return D.apply(this,arguments)}),[E,W,z,B,R,G,L,t]),F=(0,i.useCallback)((function(e){return e.id}),[]),K=(0,i.useCallback)((function({item:e}){return(0,p.jsx)(g,_objectSpread(_objectSpread({},e),{},{activeTabId:k,onSelectedItem:function(e){y(e),n.pop()},onCloseItem:G,onLongPress:function(t){V(e,t)}}))}),[k,G,y,n,V]),U=(0,i.useCallback)((function({item:e}){return(0,p.jsx)(h,_objectSpread(_objectSpread({},e),{},{activeTabId:k,onSelectedItem:function(e){y(e),n.pop()},onCloseItem:G,onLongPress:function(t){V(e,t)}}))}),[n,y,k,G,V]),q=(0,i.useMemo)((function(){return 0===x.length?null:(0,p.jsx)(l.BlurView,{position:"absolute",left:"$2.5",bottom:"$2.5",right:"$2.5",borderRadius:"$5",bg:"$bgStrong",testID:"tab-pined-container",experimentalBlurMethod:"none",children:(0,p.jsx)(l.ListView,{contentContainerStyle:{p:"$1"},horizontal:!0,data:x,showsHorizontalScrollIndicator:!1,keyExtractor:function(e){return e.id},estimatedItemSize:"$28",estimatedListSize:{width:370,height:52},renderItem:U,initialScrollIndex:O})})}),[x,U,O]);return(0,p.jsxs)(l.Page,{children:[(0,p.jsx)(l.Page.Header,{title:t.formatMessage({id:b.ETranslations.explore_tabs_count},{number:`${null!=(e=o.length)?e:0}`})}),(0,p.jsxs)(l.Page.Body,{children:[(0,p.jsx)(l.ListView,{initialScrollIndex:M,estimatedItemSize:223,data:a,renderItem:K,keyExtractor:F,numColumns:2,showsHorizontalScrollIndicator:!1,showsVerticalScrollIndicator:!1,contentContainerStyle:{paddingHorizontal:10,paddingBottom:62},testID:"tab-container"}),q]}),(0,p.jsx)(l.Page.Footer,{children:(0,p.jsx)(TabToolBar,{closeAllDisabled:a.length<=0,onAddTab:H,onCloseAll:function(){_.current=!0,$()},onDone:function(){n.pop()}})})]})}))}}]);