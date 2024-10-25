"use strict";(self.webpackChunkweb=self.webpackChunkweb||[]).push([[45772,43103],{643103:(e,t,r)=>{r.r(t),r.d(t,{default:()=>__WEBPACK_DEFAULT_EXPORT__,mapIndexToData:()=>mapIndexToData});var n=r(324586),o=r(514041),c=r(490343),i=r(791088),a=r(831085);function ownKeys(e,t){var r=Object.keys(e);if(Object.getOwnPropertySymbols){var n=Object.getOwnPropertySymbols(e);t&&(n=n.filter((function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable}))),r.push.apply(r,n)}return r}function _objectSpread(e){for(var t=1;t<arguments.length;t++){var r=null!=arguments[t]?arguments[t]:{};t%2?ownKeys(Object(r),!0).forEach((function(t){(0,n.A)(e,t,r[t])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(r)):ownKeys(Object(r)).forEach((function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(r,t))}))}return e}var mapIndexToData=function(e,t,r){return{index:t,backgroundColor:function(e,t=25){var r=e*(255/(t-1));return`rgb(${r}, ${Math.abs(128-r)}, ${255-r})`}(t,r.length)}};const __WEBPACK_DEFAULT_EXPORT__=function(){var[e,t]=(0,o.useState)(new Array(15).fill({}).map(mapIndexToData)),[r,n]=(0,o.useState)(!1),s=(0,o.useCallback)((function(){return(0,a.jsx)(c.Button,{onPress:function(){return n(!r)},children:r?"Done":"Edit"})}),[r,n]),u=(0,o.useCallback)((function(r){var n=r();if(void 0!==n){var o=[...e];o.splice(n,1),t(o)}}),[e,t]);return(0,a.jsxs)(c.Page,{children:[(0,a.jsx)(c.Page.Header,{headerRight:s}),(0,a.jsx)(c.SortableListView,{bg:"$bgApp",data:e,enabled:r,keyExtractor:function(e){return`${e.index}`},renderItem:function({item:e,getIndex:t,drag:n,dragProps:o}){return(0,a.jsx)(c.SwipeableCell,{swipeEnabled:!r,rightItemList:[{width:200,title:"DELETE",backgroundColor:"$bgCriticalStrong",onPress:function({close:e}){e?.(),u(t)}}],children:(0,a.jsx)(i.c,_objectSpread(_objectSpread({h:70,avatarProps:{src:"https://cdn.jsdelivr.net/gh/atomiclabs/cryptocurrency-icons@1a63530be6e374711a8554f31b17e4cb92c25fa5/128/color/btc.png",size:"$8"},title:`${e.index}可左滑拖动删除`},!r&&{onPress:function(){}}),{},{children:r?(0,a.jsx)(i.c.IconButton,{cursor:"move",icon:"DragOutline",onPressIn:n,dataSet:o},"darg"):null}))})},getItemLayout:function(e,t){return{length:70,offset:70*t,index:t}},onDragEnd:function(e){return t(e.data)}})]})}},45772:(e,t,r)=>{r.r(t),r.d(t,{default:()=>__WEBPACK_DEFAULT_EXPORT__});var n=r(514041),o=r(490343),c=r(643103),i=r(831085);const __WEBPACK_DEFAULT_EXPORT__=function(){var[e]=(0,n.useState)(new Array(15).fill({}).map(c.mapIndexToData));return(0,i.jsx)(o.ListView,{bg:"$bgApp",data:e,keyExtractor:function(e){return`${e.index}`},renderItem:function({item:e}){return(0,i.jsx)(o.SwipeableCell,{leftItemList:[{width:90,title:"MORE",backgroundColor:"orange",onPress:function({close:e}){return e?.()}},{width:70,title:"THANKS",backgroundColor:"blue",onPress:function({close:e}){return e?.()}},{width:90,title:"DELETE",backgroundColor:"$bgCriticalStrong",onPress:function({close:e}){return e?.()}}],rightItemList:[{width:90,title:"MORE",backgroundColor:"orange",onPress:function({close:e}){return e?.()}},{width:70,title:"THANKS",backgroundColor:"blue",onPress:function({close:e}){return e?.()}},{width:90,title:"DELETE",backgroundColor:"red",onPress:function({close:e}){return e?.()}}],children:(0,i.jsx)(o.Stack,{h:100,alignItems:"center",justifyContent:"center",bg:e.backgroundColor,children:(0,i.jsxs)(o.SizableText,{color:"white",children:[e.index,"可左右拖动"]})})})},estimatedItemSize:100})}}}]);