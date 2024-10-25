"use strict";(self.webpackChunkweb=self.webpackChunkweb||[]).push([[45875],{145875:(e,t,o)=>{o.r(t),o.d(t,{default:()=>d});var n=o(324586),r=o(586330),i=o(514041),s=o(490343),l=o(259227),a=o(392097),c=o(610421),p=o(498356),u=o(831085);function ownKeys(e,t){var o=Object.keys(e);if(Object.getOwnPropertySymbols){var n=Object.getOwnPropertySymbols(e);t&&(n=n.filter((function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable}))),o.push.apply(o,n)}return o}function _objectSpread(e){for(var t=1;t<arguments.length;t++){var o=null!=arguments[t]?arguments[t]:{};t%2?ownKeys(Object(o),!0).forEach((function(t){(0,n.A)(e,t,o[t])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(o)):ownKeys(Object(o)).forEach((function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(o,t))}))}return e}const d=(0,i.memo)((function DevOverlayWindow(){var[e,t]=(0,i.useState)({top:10,right:0,left:void 0}),o=(0,p.A)(),[n]=(0,l.usePasswordPersistAtom)(),d=(0,i.useCallback)((function(){var i,l=s.Dialog.confirm({title:"Dev Menu",onConfirm:(i=(0,r.A)((function*({getForm:e}){var o=e(),n=o?.getValues();t({top:n?.top,left:"left"===n?.align?0:void 0,right:"right"===n?.align?0:void 0})})),function onConfirm(e){return i.apply(this,arguments)}),renderContent:(0,u.jsx)(s.Dialog.Form,{formProps:{values:{top:e.top,align:void 0!==e.left?"left":"right"}},children:(0,u.jsxs)(s.YStack,{gap:"$6",children:[(0,u.jsx)(s.Button,{onPress:function(){o.pushModal(a.ry.SettingModal,{screen:a.Pj.SettingListModal}),l.close()},testID:"open-settings-page",children:"Open Settings page"}),(0,u.jsx)(s.Button,{onPress:function(){o.switchTab(a.V4.Home),l.close()},testID:"open-home-page",children:"Open home page"}),(0,u.jsx)(s.Button,{onPress:(0,r.A)((function*(){n.isPasswordSet||(yield c.A.servicePassword.promptPasswordVerify()),yield c.A.servicePassword.lockApp(),l.close()})),children:"Lock Now"}),(0,u.jsx)(s.Dialog.FormField,{name:"top",label:"Top",children:(0,u.jsx)(s.Slider,{min:1,max:100,step:1})}),(0,u.jsx)(s.Dialog.FormField,{name:"align",label:"align",children:(0,u.jsx)(s.Select,{items:[{value:"left",label:"left"},{value:"right",label:"right"}],title:"Align"})})]})})})}),[o,n.isPasswordSet,e.left,e.top]);return(0,u.jsx)(s.Stack,_objectSpread(_objectSpread({position:"absolute"},e),{},{top:`${e.top}%`,children:(0,u.jsx)(s.Button,{circular:!0,icon:"CodeOutline",alignContent:"center",justifyContent:"center",onPress:d,testID:"dev-button"})}))}))}}]);