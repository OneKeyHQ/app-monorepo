"use strict";(self.webpackChunkweb=self.webpackChunkweb||[]).push([[61318],{61318:(e,t,n)=>{n.r(t),n.d(t,{default:()=>__WEBPACK_DEFAULT_EXPORT__});var i=n(490343),s=n(187576),o=n(654004),l=n(831085),ActionListDemo1=function(){return(0,l.jsx)(i.ActionList,{title:"Action List",renderTrigger:(0,l.jsx)(i.Button,{onPress:function(){},children:"Action List"}),items:[{label:"Action1",icon:"PlaceholderOutline",onPress:function(){}},{label:"Action2",icon:"PlaceholderOutline",onPress:function(e){setTimeout((function(){e()}),3500)}},{label:"Action3",icon:"PlaceholderOutline",onPress:function(){},disabled:!0}]})},ActionListPlacement=function(){return(0,l.jsxs)(i.YStack,{gap:"$2",children:[(0,l.jsx)(i.ActionList,{title:"right(Web Only)",placement:"top",renderTrigger:(0,l.jsx)(i.Button,{onPress:function(){},children:"right(Web Only)"}),items:[{label:"Action1",icon:"PlaceholderOutline",onPress:function(){}}]}),(0,l.jsx)(i.ActionList,{title:"bottom-end(Web Only)",placement:"bottom-end",renderTrigger:(0,l.jsx)(i.Button,{onPress:function(){},children:"bottom-end(Web Only)"}),items:[{label:"Action1",icon:"PlaceholderOutline",onPress:function(){}}]})]})},ActionListDemo2=function(){return(0,l.jsx)(i.ActionList,{title:"Action List(Close demo)",renderTrigger:(0,l.jsx)(i.Button,{onPress:function(){},children:"Action List"}),sections:[{items:[{label:"just close it",icon:"PlaceholderOutline",onPress:function(){}},{label:"async action(fail)",icon:"PlaceholderOutline",onPress:function(){return new Promise((function(e){setTimeout((function(){alert("fail"),e(!1)}),1e3)}))}},{label:"async action(success)",icon:"PlaceholderOutline",onPress:function(){return new Promise((function(e){setTimeout((function(){alert("success"),e(!0)}),1e3)}))}}]},{items:[{label:"Action4",icon:"PlaceholderOutline",destructive:!0,onPress:function(){i.Dialog.show({title:"Lorem ipsum",description:"Lorem ipsum dolor sit amet consectetur. Nisi in arcu ultrices neque vel nec.",onConfirm:function(){alert("confirmed")}})}}]}]})},ActionListDemo3=function(){return(0,l.jsx)(i.ActionList,{title:"Action List",renderTrigger:(0,l.jsx)(i.Button,{children:"With Section Title"}),sections:[{title:"Title 1",items:[{label:"Action1",icon:"PlaceholderOutline",onPress:function(){}},{label:"Action2",icon:"PlaceholderOutline",shortcutKeys:[s.s.CmdOrCtrl,"k"],onPress:function(){}},{label:"Action3",icon:"PlaceholderOutline",onPress:function(){}}]},{title:"Title 2",items:[{label:"Action4",icon:"PlaceholderOutline",destructive:!0,onPress:function(){i.Dialog.show({title:"Lorem ipsum",description:"Lorem ipsum dolor sit amet consectetur. Nisi in arcu ultrices neque vel nec.",onConfirm:function(){alert("confirmed")}})}}]}]})};const __WEBPACK_DEFAULT_EXPORT__=function(){return(0,l.jsx)(o.P,{description:"对操作结果的反馈，无需用户操作即可自行消失",suggestions:["使用 Toast 显示简约明确的信息反馈","用户点击或触摸 Toast 内容时，浮层将会停留在页面上","Toast 显示的文本应少于 20 字","不建议使用 Toast 显示过长的报错信息"],boundaryConditions:["Toast 永远拥有最高层级的浮层","Toast 组件能显示的最长文本内容为三排，超出三排将会缩略","界面中只会存在一个 Toast 示例，后触发的 Toast 信息会覆盖前一条 Toast 信息"],elements:[{title:"Simple",element:(0,l.jsx)(i.Stack,{gap:"$1",children:(0,l.jsx)(ActionListDemo1,{})})},{title:"Placement",element:(0,l.jsx)(i.Stack,{gap:"$1",children:(0,l.jsx)(ActionListPlacement,{})})},{title:"Sections",element:(0,l.jsxs)(i.Stack,{gap:"$1",children:[(0,l.jsx)(ActionListDemo2,{}),(0,l.jsx)(ActionListDemo3,{})]})},{title:"shortcuts",element:(0,l.jsx)(i.ActionList,{title:"Action List(Close demo)",renderTrigger:(0,l.jsx)(i.Button,{onPress:function(){},children:"Action List"}),sections:[{items:[{label:"just close it",icon:"PlaceholderOutline",shortcutKeys:[s.s.CmdOrCtrl,s.s.Alt,"k"],onPress:function(){}},{label:"async action(fail)",icon:"PlaceholderOutline",shortcutKeys:[s.s.CmdOrCtrl,"o"],onPress:function(){return new Promise((function(e){setTimeout((function(){alert("fail"),e(!1)}),1e3)}))}}]}]})},{title:"Long Press",element:(0,l.jsx)(i.Stack,{gap:"$1",children:(0,l.jsx)(i.Button,{onLongPress:function(){i.ActionList.show({title:"Action List",sections:[{items:[{label:"just close it",icon:"PlaceholderOutline",onPress:function(){}},{label:"async action(fail)",icon:"PlaceholderOutline",onPress:function(){return new Promise((function(e){setTimeout((function(){alert("fail"),e(!1)}),1e3)}))}},{label:"async action(success)",icon:"PlaceholderOutline",onPress:function(){return new Promise((function(e){setTimeout((function(){alert("success"),e(!0)}),1e3)}))}}]},{items:[{label:"Action4",icon:"PlaceholderOutline",destructive:!0,onPress:function(){i.Dialog.show({title:"Lorem ipsum",description:"Lorem ipsum dolor sit amet consectetur. Nisi in arcu ultrices neque vel nec.",onConfirm:function(){alert("confirmed")}})}}]}]})},children:"Long Press"})})}]})}},654004:(e,t,n)=>{n.d(t,{P:()=>Layout});var i=n(586330),s=n(654266),o=n(490343),l=n(989375),c=n(610421),r=n(498356),a=n(392097),u=n(831085),FormattedText=function({text:e}){return"string"==typeof e?(0,u.jsx)(o.Stack,{children:(0,u.jsxs)(o.SizableText,{children:[e,"。 "]})}):Array.isArray(e)&&0===e.length?null:(0,u.jsx)(o.Stack,{children:(0,u.jsx)(o.Stack,{gap:"$1",children:e.map((function(t,n){return(0,u.jsx)(o.Stack,{children:(0,u.jsxs)(o.SizableText,{children:[n+1,". ",t,n===e.length-1?"。":"；"]})},n.toString())}))})})};function Layout({description:e="",suggestions:t=[],boundaryConditions:n=[],elements:d=[],scrollEnabled:h=!0,contentInsetAdjustmentBehavior:m="never",skipLoading:x=!1,children:f}){var j=(0,l.U6)(),g=(0,r.A)();return(0,u.jsx)(o.Page,{skipLoading:x,children:(0,u.jsx)(o.ScrollView,{maxWidth:"100%",scrollEnabled:h,flex:1,marginBottom:j,paddingHorizontal:"$5",contentContainerStyle:{paddingTop:20,paddingBottom:280},keyboardDismissMode:"on-drag",contentInsetAdjustmentBehavior:m,children:(0,u.jsxs)(o.Stack,{marginHorizontal:"auto",maxWidth:"100%",width:576,gap:"$6",children:[(0,u.jsxs)(o.XStack,{children:[(0,u.jsx)(o.IconButton,{icon:"HomeLineOutline",onPress:function(){g.dispatch(s.y9.replace(a.WP.Main,{screen:a.V4.Developer,params:{screen:a.f$.TabDeveloper}}))}}),(0,u.jsx)(o.Button,{ml:"$4",onPress:(0,i.A)((function*(){yield c.A.serviceSetting.setTheme("light")})),children:"Light Theme"}),(0,u.jsx)(o.Button,{ml:"$4",variant:"primary",onPress:(0,i.A)((function*(){yield c.A.serviceSetting.setTheme("dark")})),children:"Dark Theme"})]}),e?(0,u.jsxs)(o.Stack,{gap:"$2",children:[(0,u.jsx)(o.Stack,{children:(0,u.jsx)(o.SizableText,{size:"$headingXl",children:"使用说明"})}),(0,u.jsx)(o.Stack,{children:(0,u.jsx)(FormattedText,{text:e})})]}):null,t?(0,u.jsxs)(o.Stack,{gap:"$2",children:[(0,u.jsx)(o.Stack,{children:(0,u.jsx)(o.SizableText,{size:"$headingXl",children:"使用建议"})}),(0,u.jsx)(FormattedText,{text:t})]}):null,n?.length>0?(0,u.jsxs)(o.Stack,{gap:"$2",children:[(0,u.jsx)(o.Stack,{children:(0,u.jsx)(o.SizableText,{size:"$headingXl",children:"注意事项"})}),(0,u.jsx)(FormattedText,{text:n})]}):null,(0,u.jsxs)(o.Stack,{gap:"$2",children:[(0,u.jsx)(o.Stack,{children:(0,u.jsx)(o.SizableText,{size:"$headingXl",children:"组件案例"})}),(0,u.jsx)(o.Stack,{children:d?.map((function(e,t){return(0,u.jsxs)(o.Stack,{gap:"$2",pb:"$8",mb:"$8",borderBottomWidth:"$px",borderBottomColor:"$borderSubdued",children:[(0,u.jsxs)(o.Stack,{flexDirection:"column",children:[(0,u.jsx)(o.SizableText,{size:"$headingLg",children:e.title}),e.description?(0,u.jsx)(o.Stack,{paddingTop:1,children:(0,u.jsxs)(o.SizableText,{children:[e.description,"。"]})}):null]}),(0,u.jsx)(o.Stack,{children:"function"==typeof e.element?(0,u.jsx)(e.element,{}):e.element})]},`elements-${t}`)}))}),(0,u.jsx)(o.Stack,{children:f?(0,u.jsx)(o.Stack,{gap:"$3",children:f}):null})]})]})})})}},187576:(e,t,n)=>{n.d(t,{s:()=>o});var i=n(663522),s=i.Ay.isDesktopMac||i.Ay.isNativeIOS||i.Ay.isRuntimeMacOSBrowser,o={CmdOrCtrl:s?"⌘":"Ctrl",Alt:s?"⌥":"Alt",Shift:s?"⇧":"Shift",Left:"←",Right:"→",Up:"↑",Down:"↓",Search:"/"}}}]);