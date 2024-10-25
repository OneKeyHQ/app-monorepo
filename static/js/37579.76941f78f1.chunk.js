"use strict";(self.webpackChunkweb=self.webpackChunkweb||[]).push([[37579],{367e3:(e,t,n)=>{n.d(t,{r:()=>AddressBookListContent});var s=n(324586),r=n(487809),o=n.n(r),a=n(514041),i=n(908867),d=n(490343),c=n(791088),l=n(498356),u=n(334439),m=n(22937),f=n(392097),h=n(831085),AddressBookSectionList=function({sections:e,renderItem:t,renderSectionHeader:n,ListEmptyComponent:s,keyExtractor:r,showsVerticalScrollIndicator:o}){return(0,h.jsx)(d.NativeSectionList,{showsVerticalScrollIndicator:o,sections:e,renderItem:t,renderSectionHeader:n,ListEmptyComponent:s,keyExtractor:r,windowSize:40})},_=n(586330),ListItemIconButton=function({item:e}){var t,n,s,r=(0,i.A)(),{copyText:o}=(0,d.useClipboard)(),a=(0,l.A)();return(0,h.jsx)(d.ActionList,{title:r.formatMessage({id:u.ETranslations.address_book_menu_title}),items:[{label:r.formatMessage({id:u.ETranslations.global_copy_address}),icon:"Copy3Outline",onPress:(s=(0,_.A)((function*(){o(e.address)})),function onPress(){return s.apply(this,arguments)}),testID:`address-menu-copy-${null!=(t=e.address)?t:""}`},{label:r.formatMessage({id:u.ETranslations.global_edit}),icon:"PencilOutline",onPress:function(){e.id&&a.push(f.sv.EditItemModal,{id:e.id,name:e.name,address:e.address,networkId:e.networkId})},testID:`address-menu-edit-${null!=(n=e.address)?n:""}`}],renderTrigger:(0,h.jsx)(c.c.IconButton,{icon:"DotVerSolid",testID:`address-menu-${e.address||""}`})})};function ownKeys(e,t){var n=Object.keys(e);if(Object.getOwnPropertySymbols){var s=Object.getOwnPropertySymbols(e);t&&(s=s.filter((function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable}))),n.push.apply(n,s)}return n}function _objectSpread(e){for(var t=1;t<arguments.length;t++){var n=null!=arguments[t]?arguments[t]:{};t%2?ownKeys(Object(n),!0).forEach((function(t){(0,s.A)(e,t,n[t])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(n)):ownKeys(Object(n)).forEach((function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(n,t))}))}return e}var getSectionTitle=function(e){return e.networkId.startsWith("evm--")?"EVM":e.network.name};function getSectionIndex(e){var t;return"bitcoin"===e.title.toLowerCase()?-10:"evm"===e.title.toLowerCase()?-9:null!=(t=e.data[0]?.createdAt)?t:0}var buildSections=function(e){var t=o()(e,getSectionTitle);return Object.entries(t).map((function(e){return{title:e[0],data:e[1]}})).sort((function(e,t){return getSectionIndex(e)-getSectionIndex(t)}))},RenderAddressBookItem=function({item:e,onPress:t,showActions:n}){var s=(0,a.useCallback)((function(){return(0,h.jsx)(d.Stack,{justifyContent:"center",alignItems:"center",w:"$10",h:"$10",borderRadius:"$full",backgroundColor:"$gray3",children:(0,h.jsx)(d.SizableText,{size:"$bodyLgMedium",children:e.name.slice(0,1).toUpperCase()})})}),[e.name]);return(0,h.jsx)(c.c,{title:e.name,titleMatch:e.nameMatch,subtitle:e.address,subTitleMatch:e.addressMatch,renderAvatar:s,onPress:function(){return t?.(e)},testID:`address-item-${e.address||""}`,children:n?(0,h.jsx)(ListItemIconButton,{item:e}):null})},RenderEmptyAddressBook=function({hideAddItemButton:e}){var t=(0,i.A)(),n=(0,l.A)();return(0,h.jsx)(d.Empty,{icon:"SearchOutline",title:t.formatMessage({id:u.ETranslations.address_book_no_results_title}),description:t.formatMessage({id:u.ETranslations.address_book_empty_description}),buttonProps:e?void 0:{children:t.formatMessage({id:u.ETranslations.address_book_add_address_title}),onPress:function(){n.push(f.sv.AddItemModal)},testID:"address-book-add-button"}})},RenderNoSearchResult=function(){var e=(0,i.A)();return(0,h.jsx)(d.Empty,{icon:"SearchOutline",title:e.formatMessage({id:u.ETranslations.address_book_no_results_title}),description:e.formatMessage({id:u.ETranslations.address_book_no_results_description}),testID:"address-book-search-empty"})},AddressBookListContent=function({items:e,showActions:t,onPressItem:n,hideEmptyAddButton:s}){var r=(0,i.A)(),[o,c]=(0,a.useState)(""),[l,f]=(0,a.useState)([]),_=(0,a.useCallback)((function(e){return f((function(t){return t.includes(e)?t.filter((function(t){return t!==e})):t.concat(e)}))}),[]);(0,a.useEffect)((function(){f([])}),[o]);var b=(0,a.useCallback)((function({section:e}){return o?null:(0,h.jsx)(d.SectionList.SectionHeader,{title:e.title.toUpperCase(),justifyContent:"space-between",children:(0,h.jsx)(d.IconButton,{size:"small",variant:"tertiary",testID:`address-cat-${e.title.toUpperCase()}-${e.isFold?"fold":"unfold"}`,icon:e.isFold?"ChevronRightSmallOutline":"ChevronDownSmallSolid",onPress:function(){return _(e.title)}})})}),[_,o]),p=(0,a.useCallback)((function({item:e}){return(0,h.jsx)(RenderAddressBookItem,{item:e,showActions:t,onPress:n})}),[t,n]),g=(0,a.useMemo)((function(){var t=[];if(o){var exactMatch=function(e){return 1===e.indices.length&&e.value&&e.indices[0][1]-e.indices[0][0]==e.value.length-1},n=(0,m.qZ)(e,{keys:["address","name"]}).search(o).map((function(e){return _objectSpread(_objectSpread({},e.item),{},{nameMatch:e.matches?.find((function(e){return"name"===e.key})),addressMatch:e.matches?.find((function(e){return"address"===e.key&&exactMatch(e)}))})}));n=n.filter((function(e){return!(!e.nameMatch&&!e.addressMatch)&&(!(!e.nameMatch&&e.addressMatch)||exactMatch(e.addressMatch))})),t=buildSections(n)}else t=buildSections(e);return t.map((function(e){var t=l.includes(e.title),{data:n}=e;return{title:e.title,data:t?[]:n,isFold:t}}))}),[l,e,o]),y=(0,d.useMedia)(),x=(0,a.useMemo)((function(){return y.md?80:60}),[y.md]);return(0,h.jsxs)(d.Stack,{flex:1,children:[(0,h.jsx)(d.Stack,{px:"$5",pb:"$2",children:(0,h.jsx)(d.SearchBar,{placeholder:r.formatMessage({id:u.ETranslations.global_search}),value:o,onChangeText:function(e){return c(e)}})}),(0,h.jsx)(AddressBookSectionList,{showsVerticalScrollIndicator:!1,estimatedItemSize:x,sections:g,renderSectionHeader:b,renderItem:p,ListEmptyComponent:e.length?RenderNoSearchResult:(0,h.jsx)(RenderEmptyAddressBook,{hideAddItemButton:s}),keyExtractor:function(e){return e.address}})]})}},555785:(e,t,n)=>{n.d(t,{x:()=>ContentContainer});var s=n(586330),r=n(514041),o=n(908867),a=n(490343),i=n(610421),d=n(334439),c=n(831085),ContentSpinner=function(){return(0,c.jsx)(a.Stack,{h:"100%",justifyContent:"center",alignItems:"center",children:(0,c.jsx)(a.Spinner,{size:"large"})})},UnsafeAlert=function(){var e=(0,o.A)(),{copyText:t}=(0,a.useClipboard)(),n=(0,r.useCallback)((function(){var n,r;a.Dialog.show({title:e.formatMessage({id:d.ETranslations.global_confirm}),icon:"ShieldKeyholeOutline",description:e.formatMessage({id:d.ETranslations.address_book_confirm_message}),showConfirmButton:!0,showCancelButton:!0,onConfirm:(r=(0,s.A)((function*(e){var n=yield i.A.serviceAddressBook.stringifyItems();yield i.A.serviceAddressBook.resetItems(),t(n,d.ETranslations.address_book_add_address_toast_reset_success),yield e.close()})),function onConfirm(e){return r.apply(this,arguments)}),onConfirmText:e.formatMessage({id:d.ETranslations.address_book_button_reset}),onCancelText:e.formatMessage({id:d.ETranslations.address_book_button_copy}),cancelButtonProps:{icon:"Copy2Outline"},onCancel:(n=(0,s.A)((function*(e){var n=yield i.A.serviceAddressBook.stringifyItems();t(n),yield e()})),function onCancel(e){return n.apply(this,arguments)})})}),[t,e]);return(0,c.jsxs)(a.Stack,{p:"$4",children:[(0,c.jsx)(a.Alert,{type:"critical",title:e.formatMessage({id:d.ETranslations.address_book_data_anomaly}),icon:"ErrorOutline"}),(0,c.jsx)(a.SizableText,{size:"$headingMd",py:"$5",children:e.formatMessage({id:d.ETranslations.address_book_data_anomaly_description})}),(0,c.jsxs)(a.Stack,{mt:"$5",children:[(0,c.jsx)(a.SizableText,{size:"$headingSm",children:e.formatMessage({id:d.ETranslations.address_book_data_anomaly_why_risk})}),(0,c.jsx)(a.SizableText,{size:"$bodyMd",children:e.formatMessage({id:d.ETranslations.address_book_data_anomaly_why_risk_description})})]}),(0,c.jsxs)(a.Stack,{mt:"$5",children:[(0,c.jsx)(a.SizableText,{size:"$headingSm",children:e.formatMessage({id:d.ETranslations.address_book_data_anomaly_why_reset})}),(0,c.jsx)(a.SizableText,{size:"$bodyMd",children:e.formatMessage({id:d.ETranslations.address_book_data_anomaly_why_reset_description})})]}),(0,c.jsx)(a.Page.Footer,{onConfirmText:e.formatMessage({id:d.ETranslations.address_book_button_reset}),onCancelText:e.formatMessage({id:d.ETranslations.address_book_button_close}),onConfirm:n,onCancel:function(e){return e()}})]})},ErrOccurred=function(){var e=(0,o.A)();return(0,c.jsx)(a.Empty,{icon:"ErrorOutline",title:e.formatMessage({id:d.ETranslations.global_an_error_occurred}),description:e.formatMessage({id:d.ETranslations.global_an_error_occurred})})},ContentContainer=function({children:e,loading:t,error:n,unsafe:s}){return t?(0,c.jsx)(ContentSpinner,{}):n?(0,c.jsx)(ErrOccurred,{}):s?(0,c.jsx)(UnsafeAlert,{}):(0,c.jsx)(c.Fragment,{children:e})}},537579:(e,t,n)=>{n.r(t),n.d(t,{default:()=>f});var s=n(514041),r=n(908867),o=n(490343),a=n(498356),i=n(334439),d=n(392097),c=n(367e3),l=n(555785),u=n(143063),m=n(831085),HeaderRightComponent=function(){var e=(0,a.A)(),t=(0,s.useCallback)((function(){e.push(d.sv.AddItemModal)}),[e]);return(0,m.jsx)(o.IconButton,{variant:"tertiary",icon:"PlusCircleOutline",onPress:t,testID:"address-book-add-icon"})};const f=function ListPage(){var e,t=(0,r.A)(),{isLoading:n,result:s}=(0,u.$)();return(0,m.jsxs)(o.Page,{children:[(0,m.jsx)(o.Page.Header,{title:t.formatMessage({id:i.ETranslations.address_book_title}),headerRight:HeaderRightComponent}),(0,m.jsx)(o.Page.Body,{children:(0,m.jsx)(l.x,{loading:n,error:Boolean(!n&&!s),unsafe:!1===s?.isSafe,children:(0,m.jsx)(c.r,{items:null!=(e=s?.items)?e:[],showActions:!0})})})]})}}}]);