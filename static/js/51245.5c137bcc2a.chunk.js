"use strict";(self.webpackChunkweb=self.webpackChunkweb||[]).push([[51245],{651245:(e,t,r)=>{r.r(t),r.d(t,{default:()=>K});var n=r(514041),o=r(490343),a=r(498356),i=r(392097),s=r(324586),c=r(908867),d=r(334439),l=r(663522),u=(r(187576),r(564452)),p=r(831085);function ownKeys(e,t){var r=Object.keys(e);if(Object.getOwnPropertySymbols){var n=Object.getOwnPropertySymbols(e);t&&(n=n.filter((function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable}))),r.push.apply(r,n)}return r}function _objectSpread(e){for(var t=1;t<arguments.length;t++){var r=null!=arguments[t]?arguments[t]:{};t%2?ownKeys(Object(r),!0).forEach((function(t){(0,s.A)(e,t,r[t])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(r)):ownKeys(Object(r)).forEach((function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(r,t))}))}return e}const g=(0,u.k)((function CustomHeaderSearch({handleSearchBarPress:e}){var t=(0,c.A)();return(0,p.jsxs)(o.XStack,{$gtMd:{minWidth:280},children:[(0,p.jsx)(o.SearchBar,_objectSpread({placeholder:t.formatMessage({id:d.ETranslations.browser_search_dapp_or_enter_url}),containerProps:{w:"100%"},$gtMd:{size:"small"}},{}),"MarketHomeSearchInput"),(0,p.jsx)(o.View,{position:"absolute",top:0,left:0,right:0,bottom:0,onPress:function(){return e("")}})]})}));var h=r(586330),b=r(610421),S=r(292600),f=r(317522),m=r(911998),y=r(153763),w=r(657412),j=r(948675),x=r(899035),$=r(117746),O=r(574319);function Banner_ownKeys(e,t){var r=Object.keys(e);if(Object.getOwnPropertySymbols){var n=Object.getOwnPropertySymbols(e);t&&(n=n.filter((function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable}))),r.push.apply(r,n)}return r}function Banner_objectSpread(e){for(var t=1;t<arguments.length;t++){var r=null!=arguments[t]?arguments[t]:{};t%2?Banner_ownKeys(Object(r),!0).forEach((function(t){(0,s.A)(e,t,r[t])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(r)):Banner_ownKeys(Object(r)).forEach((function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(r,t))}))}return e}function DashboardBanner({banners:e,handleOpenWebSite:t,isLoading:r}){var a=(0,n.useMemo)((function(){return e.map((function(e){return Banner_objectSpread(Banner_objectSpread({},e),{},{imgUrl:e.src,title:e.title||"",titleTextProps:{maxWidth:"$96",size:"$headingLg",$gtMd:{size:"$heading2xl"}}})}))}),[e]),i=(0,n.useMemo)((function(){return r?(0,p.jsx)(o.Stack,{p:"$5",children:(0,p.jsx)(o.Skeleton,{h:188,w:"100%",$gtMd:{height:268},$gtLg:{height:364}})}):void 0}),[r]);return(0,p.jsx)(o.Banner,{itemContainerStyle:{p:"$5"},data:a,isLoading:r,height:228,$gtMd:{height:308},$gtLg:{height:404},itemTitleContainerStyle:{bottom:0,right:0,left:0,px:"$10",py:"$8",$gtMd:{px:"$14",py:"$10"}},emptyComponent:i,onItemPress:function(e){t({webSite:{url:e.href,title:e.href},useSystemBrowser:e.useSystemBrowser})}})}var k=r(503668),v=r.n(k),D=r(839850),C=["selected","children"],P=["children"],M=["children","showSectionHeaderBorder"];function DashboardSectionHeader_ownKeys(e,t){var r=Object.keys(e);if(Object.getOwnPropertySymbols){var n=Object.getOwnPropertySymbols(e);t&&(n=n.filter((function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable}))),r.push.apply(r,n)}return r}function DashboardSectionHeader_objectSpread(e){for(var t=1;t<arguments.length;t++){var r=null!=arguments[t]?arguments[t]:{};t%2?DashboardSectionHeader_ownKeys(Object(r),!0).forEach((function(t){(0,s.A)(e,t,r[t])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(r)):DashboardSectionHeader_ownKeys(Object(r)).forEach((function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(r,t))}))}return e}function DashboardSectionHeader_DashboardSectionHeader(e){var{children:t,showSectionHeaderBorder:r=!0}=e,n=(0,D.A)(e,M);return(0,p.jsx)(o.XStack,DashboardSectionHeader_objectSpread(DashboardSectionHeader_objectSpread({alignItems:"center",gap:"$5",userSelect:"none",$gtMd:{pt:"$1",mt:"$1",borderTopWidth:r?1:0,borderColor:"$borderSubdued"}},n),{},{children:t}))}DashboardSectionHeader_DashboardSectionHeader.Heading=function SectionHeading(e){var{selected:t,children:r}=e,n=(0,D.A)(e,C);return(0,p.jsx)(o.Heading,DashboardSectionHeader_objectSpread(DashboardSectionHeader_objectSpread(DashboardSectionHeader_objectSpread({size:"$headingLg",userSelect:"none",py:"$2.5"},!t&&{opacity:.5}),n),{},{children:r}))},DashboardSectionHeader_DashboardSectionHeader.Button=function SectionButton(e){var{children:t}=e,r=(0,D.A)(e,P);return(0,p.jsx)(o.Button,DashboardSectionHeader_objectSpread(DashboardSectionHeader_objectSpread({size:"medium",variant:"tertiary",ml:"auto"},r),{},{children:t}))};var I=r(625931),A=r(344145),_=r.n(A),H=r(17617),V=r(812715),L=r(584186),B=["children","horizontal"];function ChunkedItemsView_ownKeys(e,t){var r=Object.keys(e);if(Object.getOwnPropertySymbols){var n=Object.getOwnPropertySymbols(e);t&&(n=n.filter((function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable}))),r.push.apply(r,n)}return r}function ChunkedItemsView_objectSpread(e){for(var t=1;t<arguments.length;t++){var r=null!=arguments[t]?arguments[t]:{};t%2?ChunkedItemsView_ownKeys(Object(r),!0).forEach((function(t){(0,s.A)(e,t,r[t])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(r)):ChunkedItemsView_ownKeys(Object(r)).forEach((function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(r,t))}))}return e}var chunkArray=function(e,t){for(var r=[],n=0;n<e.length;n+=t)r.push(e.slice(n,n+t));return r},E=_()((function(){return(0,o.getTokenValue)("$12","size")}),{maxAge:L.A.getTimeDurationMs({minute:10})});function useCardWidth(){var{width:e}=(0,V.A)();return e-E()}function ItemsContainer(e){var{children:t,horizontal:r}=e,n=(0,D.A)(e,B),a=(0,o.useMedia)(),i=function usePaginationStyle(e){var t=useCardWidth(),r=E();return e?{horizontal:!0,showsHorizontalScrollIndicator:!1,decelerationRate:0,snapToInterval:t,snapToAlignment:"start",contentContainerStyle:{paddingRight:r}}:void 0}(!!r);return a.gtMd?(0,p.jsx)(o.Stack,ChunkedItemsView_objectSpread(ChunkedItemsView_objectSpread({},n),{},{children:t})):(0,p.jsx)(o.ScrollView,ChunkedItemsView_objectSpread(ChunkedItemsView_objectSpread(ChunkedItemsView_objectSpread({pagingEnabled:!0},i),n),{},{contentContainerStyle:ChunkedItemsView_objectSpread(ChunkedItemsView_objectSpread({},n.contentContainerStyle),i?.contentContainerStyle),children:t}))}function ChunkedItemsView({isExploreView:e,dataChunks:t,handleOpenWebSite:r}){var n=useCardWidth();return(0,p.jsx)(ItemsContainer,{mx:"$-5",$md:l.Ay.isRuntimeBrowser?{ml:"$-3"}:void 0,horizontal:!e,contentContainerStyle:{px:"$2",$md:{flexDirection:e?"column":"row"},$gtMd:{flexDirection:"column"}},children:t.map((function(t,a){return(0,p.jsx)(o.Stack,{$md:e?{flexDirection:"row",flexWrap:"wrap"}:{w:n},$gtMd:{flexDirection:"row",flexWrap:"wrap"},children:t.map((function(t){return(0,p.jsxs)(o.XStack,{group:"card",p:"$3",alignItems:"center",$md:e?{flexBasis:"100%"}:void 0,$gtMd:{px:"$5",flexBasis:"50%"},$gtLg:{px:"$5",flexBasis:"33.3333%"},onPress:function(){return r({webSite:{url:t.url,title:t.name}})},userSelect:"none",testID:`dapp-${t.dappId}`,children:[(0,p.jsxs)(o.Image,{w:"$14",h:"$14",borderRadius:"$3","$group-card-hover":{opacity:.75},borderWidth:H.A.hairlineWidth,borderColor:"$borderSubdued",borderCurve:"continuous",children:[(0,p.jsx)(o.Image.Source,{source:{uri:t.logo}}),(0,p.jsx)(o.Image.Fallback,{children:(0,p.jsx)(o.Icon,{name:"GlobusOutline",width:"100%",height:"100%"})}),(0,p.jsx)(o.Image.Loading,{children:(0,p.jsx)(o.Skeleton,{width:"100%",height:"100%"})})]}),(0,p.jsxs)(o.Stack,{flex:1,ml:"$3",children:[(0,p.jsxs)(o.XStack,{alignItems:"center",children:[(0,p.jsx)(o.SizableText,{size:"$bodyLgMedium",$gtMd:{size:"$bodyMdMedium"},numberOfLines:1,children:t.name}),Array.isArray(t.tags)&&t.tags.length?(0,p.jsx)(o.Badge,{badgeSize:"sm",badgeType:t.tags[0].type,ml:"$2",children:t.tags[0].name}):null]}),(0,p.jsx)(o.SizableText,{size:"$bodyMd",color:"$textSubdued",numberOfLines:1,$gtMd:{size:"$bodySm",numberOfLines:2,whiteSpace:"break-spaces"},children:t.description})]})]},t.dappId)}))},a)}))})}function ChunkedItemsSkeletonView({isExploreView:e,dataChunks:t}){var r=useCardWidth();return(0,p.jsx)(ItemsContainer,{mx:"$-5",$gtMd:{mx:"$-3"},horizontal:!e,contentContainerStyle:{px:"$2",$md:{flexDirection:e?"column":"row"},$gtMd:{flexDirection:"column"}},children:t?.map((function(t,n){return(0,p.jsx)(o.Stack,{$md:e?{flexDirection:"row",flexWrap:"wrap"}:{w:r},$gtMd:{flexDirection:"row",flexWrap:"wrap"},children:t.map((function(t){return(0,p.jsxs)(o.XStack,{p:"$3",gap:"$3",alignItems:"center",$md:e?{flexBasis:"100%"}:void 0,$gtMd:{flexBasis:"50%"},$gtLg:{flexBasis:"33.3333%"},children:[(0,p.jsx)(o.Skeleton,{w:"$14",h:"$14",borderRadius:"$3"}),(0,p.jsxs)(o.Stack,{flex:1,gap:"$1",children:[(0,p.jsx)(o.XStack,{alignItems:"center",children:(0,p.jsx)(o.Skeleton,{w:"$20",h:"$4"})}),(0,p.jsx)(o.Skeleton,{w:216,h:"$4",$md:{w:"100%"}})]})]},t.dappId)}))},n)}))})}var z=r(86677),T=r(885127);function ExploreView({isLoading:e,dAppList:t,categoryResult:r,handleOpenWebSite:a,selectedCategory:i,setSelectedCategory:s,selectedNetwork:l,setSelectedNetwork:u,networkList:g}){var h,b,S=(0,c.A)(),f=(0,o.useMedia)(),m=(0,n.useMemo)((function(){return f.gtMd?f.lg?2:3:1}),[f]),y=(0,n.useMemo)((function(){return Array.isArray(r?.categoryList)?r.categoryList.map((function(e){return{value:e.categoryId,label:e.name}})):[]}),[r?.categoryList]),w=!t?.data||0===t?.data.length,j=(0,n.useCallback)((function(e,t){return(0,p.jsx)(ChunkedItemsView,{isExploreView:!0,dataChunks:e,handleOpenWebSite:a},t)}),[a]),x=(0,n.useCallback)((function(e,t){return(0,p.jsx)(ChunkedItemsSkeletonView,{isExploreView:!0,dataChunks:e},t)}),[]),$=(0,n.useMemo)((function(){var r;return w?(0,p.jsx)(o.Empty,{icon:"SearchOutline",title:S.formatMessage({id:d.ETranslations.global_no_results})}):e?x(chunkArray(Array.from({length:30}).map((function(e,t){return{dappId:t.toString()}})),m),i):j(chunkArray(null!=(r=t?.data)?r:[],m),i)}),[S,w,e,t?.data,m,i,x,j]),O=(0,T.A)();return(0,p.jsxs)(p.Fragment,{children:[(0,p.jsxs)(o.XStack,{py:"$2",children:[(0,p.jsx)(o.Select,{title:S.formatMessage({id:d.ETranslations.explore_categories}),items:y,value:i,onChange:s,renderTrigger:function({label:e,onPress:t}){return(0,p.jsxs)(o.XStack,{mr:"$2.5",py:"$1.5",px:"$2",bg:"$bgStrong",borderRadius:"$3",userSelect:"none",borderCurve:"continuous",hoverStyle:{bg:"$bgStrongHover"},pressStyle:{bg:"$bgStrongActive"},onPress:t,children:[(0,p.jsx)(o.SizableText,{size:"$bodyMdMedium",px:"$1",children:e}),(0,p.jsx)(o.Icon,{name:"ChevronDownSmallOutline",size:"$5",color:"$iconSubdued"})]})}}),(0,p.jsxs)(o.XStack,{py:"$1.5",px:"$2",bg:"$bgStrong",borderRadius:"$3",userSelect:"none",borderCurve:"continuous",hoverStyle:{bg:"$bgStrongHover"},pressStyle:{bg:"$bgStrongActive"},onPress:function(){O({onSelect:function(e){e&&u(e)},defaultNetworkId:l?.id,networkIds:g})},children:[(0,p.jsx)(o.Image,{w:"$5",h:"$5",children:(0,p.jsx)(z.b,{source:{uri:null!=(h=l?.logoURI)?h:""}})}),(0,p.jsx)(o.XStack,{maxWidth:119,children:(0,p.jsx)(o.SizableText,{size:"$bodyMdMedium",px:"$1",numberOfLines:1,children:null!=(b=l?.name)?b:""})}),(0,p.jsx)(o.Icon,{name:"ChevronDownSmallOutline",size:"$5",color:"$iconSubdued"})]})]}),$]})}function SuggestedView_ownKeys(e,t){var r=Object.keys(e);if(Object.getOwnPropertySymbols){var n=Object.getOwnPropertySymbols(e);t&&(n=n.filter((function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable}))),r.push.apply(r,n)}return r}function SuggestedView_objectSpread(e){for(var t=1;t<arguments.length;t++){var r=null!=arguments[t]?arguments[t]:{};t%2?SuggestedView_ownKeys(Object(r),!0).forEach((function(t){(0,s.A)(e,t,r[t])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(r)):SuggestedView_ownKeys(Object(r)).forEach((function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(r,t))}))}return e}function SuggestedView({suggestedData:e,handleOpenWebSite:t}){var r=(0,o.useMedia)(),a=r.gtMd&&r.lg?2:3,i=(0,n.useMemo)((function(){return e.map((function(e){return SuggestedView_objectSpread(SuggestedView_objectSpread({},e),{},{dataChunks:chunkArray(e.dapps,a)})}))}),[e,a]),s=(0,n.useCallback)((function(e,r){return(0,p.jsx)(ChunkedItemsView,{isExploreView:!1,dataChunks:e,handleOpenWebSite:t},r)}),[t]),l=(0,c.A)();return(0,p.jsx)(p.Fragment,{children:i.map((function(e,t){var r;return(0,p.jsxs)(o.Stack,{children:[(0,p.jsxs)(o.XStack,SuggestedView_objectSpread(SuggestedView_objectSpread({pt:"$2"},0!==t&&{pt:"$5"}),{},{space:"$1.5",children:[(0,p.jsx)(o.Heading,{size:"$headingMd",userSelect:"none",children:e.name}),(null!=(r=e?.dappInfo?.information?.length)?r:0)>0?(0,p.jsx)(o.IconButton,{alignSelf:"center",icon:"InfoCircleOutline",variant:"tertiary",size:"small",onPress:function(){var t,r=o.Dialog.show({icon:"InfoCircleOutline",title:e.name,description:e?.dappInfo?.information,onConfirmText:l.formatMessage({id:d.ETranslations.global_got_it}),onCancelText:l.formatMessage({id:d.ETranslations.global_learn_more}),showCancelButton:null!=(t=e?.dappInfo?.showLink)&&t,cancelButtonProps:{onPress:function(){r.close();var t=e?.dappInfo?.link;t&&(0,$.Dr)(t)}}})}}):null]})),s(e.dataChunks,e.categoryId)]},`${e.name}--${e.categoryId}`)}))})}function SuggestedAndExploreSection({suggestedData:e,handleOpenWebSite:t,isLoading:r}){var a=(0,c.A)(),[i,s]=(0,n.useState)(!1),[l,u]=(0,n.useState)(""),[g,S]=(0,n.useState)(),{result:f}=(0,m.yk)((0,h.A)((function*(){var[e,t,r]=yield Promise.all([b.A.serviceDiscovery.fetchCategoryList(),b.A.serviceNetwork.getNetwork({networkId:(0,I.V)().eth}),b.A.serviceNetwork.getDappInteractionEnabledNetworks()]),n=r.map((function(e){return e.id}));return u(e[0].categoryId),S(t),{categoryList:e,networkList:n}})),[]),{result:y,isLoading:w}=(0,m.yk)((0,h.A)((function*(){return l&&g?b.A.serviceDiscovery.fetchDAppListByCategory({category:l,network:g.id}):{data:[],next:""}})),[l,g],{watchLoading:!0}),j=(0,o.useMedia)(),x=j.gtMd&&j.lg?2:3,$=(0,n.useCallback)((function(){return(0,p.jsx)(o.Stack,{gap:"$5",children:Array.from({length:4}).map((function(e,t){return(0,p.jsxs)(o.Stack,{gap:"$3",children:[(0,p.jsx)(o.Skeleton,{w:"$14",h:"$6"}),(0,p.jsx)(ChunkedItemsSkeletonView,{isExploreView:!0,dataChunks:chunkArray(Array.from({length:x}).map((function(e,t){return{dappId:`first-${t}`}})),x)},"skeleton-view")]},t)}))})}),[x]),O=(0,n.useCallback)((function(){return v()(r)||r?$():i?(0,p.jsx)(ExploreView,{isLoading:w,dAppList:y,categoryResult:f,selectedCategory:l,selectedNetwork:g,setSelectedCategory:u,setSelectedNetwork:S,networkList:null!=(n=f?.networkList)?n:[],handleOpenWebSite:t}):(0,p.jsx)(SuggestedView,{suggestedData:e,handleOpenWebSite:t});var n}),[w,i,r,$,e,t,y,f,l,g,u,S]);return(0,p.jsxs)(o.Stack,{p:"$5","$platform-native":{pb:"$16"},tag:"section",children:[(0,p.jsxs)(DashboardSectionHeader_DashboardSectionHeader,{children:[(0,p.jsx)(DashboardSectionHeader_DashboardSectionHeader.Heading,{selected:!i,onPress:function(){return s(!1)},children:a.formatMessage({id:d.ETranslations.explore_suggested})},"suggested"),(0,p.jsx)(DashboardSectionHeader_DashboardSectionHeader.Heading,{selected:i,onPress:function(){return s(!0)},children:a.formatMessage({id:d.ETranslations.explore_explore})},"explore")]}),O()]})}const W=(0,n.memo)((function DashboardContent({onScroll:e}){var t=(0,a.A)(),{displayHomePage:r}=((0,y.E)(),(0,O.y)()),{gtMd:s}=(0,o.useMedia)(),{handleOpenWebSite:c}=(0,w.yZ)().current,{result:[d,l]=[],run:u}=(0,m.yk)((0,h.A)((function*(){var e=b.A.serviceDiscovery.getBookmarkData({generateIcon:!0,sliceCount:8}),t=b.A.serviceDiscovery.getHistoryData({generateIcon:!0,sliceCount:8});return Promise.all([e,t])})),[],{watchLoading:!0}),[g,k]=(0,n.useState)(!1),{result:v,isLoading:D,run:C}=(0,m.yk)((0,h.A)((function*(){var e=yield b.A.serviceDiscovery.fetchDiscoveryHomePageData();return k(!1),e})),[],{watchLoading:!0,checkIsFocused:!1});(0,n.useCallback)((function(){k(!0),C()}),[C]),(0,f.A)(i.V4.Discovery,(function(e){e&&setTimeout((function(){u()}))})),(0,n.useEffect)((function(){0}),[r,u]);var P=(0,n.useCallback)((function(e){t.pushModal(i.ry.DiscoveryModal,{screen:e?i.v1.HistoryListModal:i.v1.BookmarkListModal})}),[t]),M=(0,n.useMemo)((function(){Array.isArray(v?.banners)&&v.banners.length;return(0,p.jsxs)(p.Fragment,{children:[(0,p.jsx)(DashboardBanner,{banners:v?.banners||[],handleOpenWebSite:function({webSite:e,useSystemBrowser:r}){r&&e?.url?(0,$.Dr)(e.url):e?.url&&c({switchToMultiTabBrowser:s,webSite:e,navigation:t,shouldPopNavigation:!1}),j.U.discovery.dapp.enterDapp({dappDomain:e?.url||"",dappName:e?.title||"",enterMethod:x.z.banner})},isLoading:D},"Banner"),null,(0,p.jsx)(S.O,{children:(0,p.jsx)(SuggestedAndExploreSection,{suggestedData:Array.isArray(v?.categories)?v.categories:[],handleOpenWebSite:function({webSite:e}){c({switchToMultiTabBrowser:s,webSite:e,navigation:t,shouldPopNavigation:!1}),j.U.discovery.dapp.enterDapp({dappDomain:e?.url||"",dappName:e?.title||"",enterMethod:x.z.dashboard})},isLoading:D},"SuggestedAndExploreSection")})]})}),[v?.banners,v?.categories,D,d,l,P,c,s,t]);return(0,p.jsx)(o.ScrollView,{children:(0,p.jsx)(o.Stack,{maxWidth:1280,width:"100%",alignSelf:"center",children:M})})}));const K=(0,u.k)((function Dashboard(){var e=(0,a.A)(),t=(0,n.useCallback)((function(){e.pushModal(i.ry.DiscoveryModal,{screen:i.v1.SearchModal})}),[e]),r=(0,n.useCallback)((function(){return(0,p.jsx)(g,{handleSearchBarPress:t})}),[t]);return(0,p.jsxs)(o.Page,{children:[(0,p.jsx)(o.Page.Header,{headerRight:r}),(0,p.jsx)(o.Page.Body,{children:(0,p.jsx)(W,{})})]})}))},187576:(e,t,r)=>{r.d(t,{s:()=>a});var n=r(663522),o=n.Ay.isDesktopMac||n.Ay.isNativeIOS||n.Ay.isRuntimeMacOSBrowser,a={CmdOrCtrl:o?"⌘":"Ctrl",Alt:o?"⌥":"Alt",Shift:o?"⇧":"Shift",Left:"←",Right:"→",Up:"↑",Down:"↓",Search:"/"}}}]);