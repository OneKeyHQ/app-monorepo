"use strict";(self.webpackChunkweb=self.webpackChunkweb||[]).push([[2763],{202763:(e,t,n)=>{n.r(t),n.d(t,{default:()=>__WEBPACK_DEFAULT_EXPORT__});var i=n(490343),l=n(187576),c=n(654004),a=n(831085);const __WEBPACK_DEFAULT_EXPORT__=function(){return(0,a.jsx)(c.P,{description:"..",suggestions:["..."],boundaryConditions:["..."],elements:[{title:"Varaints",element:(0,a.jsxs)(i.Stack,{flexDirection:"row",gap:"$4",alignItems:"center",children:[(0,a.jsx)(i.IconButton,{icon:"PlaceholderOutline"}),(0,a.jsx)(i.IconButton,{variant:"primary",icon:"PlaceholderOutline"}),(0,a.jsx)(i.IconButton,{variant:"destructive",icon:"PlaceholderOutline"}),(0,a.jsx)(i.IconButton,{variant:"tertiary",icon:"PlaceholderOutline"})]})},{title:"Sizes",element:(0,a.jsxs)(i.Stack,{flexDirection:"row",gap:"$4",alignItems:"center",children:[(0,a.jsx)(i.IconButton,{icon:"PlaceholderOutline"}),(0,a.jsx)(i.IconButton,{size:"small",icon:"PlaceholderOutline"}),(0,a.jsx)(i.IconButton,{size:"large",icon:"PlaceholderOutline"})]})},{title:"Disabled",element:(0,a.jsxs)(i.Stack,{flexDirection:"row",gap:"$4",children:[(0,a.jsx)(i.IconButton,{disabled:!0,icon:"PlaceholderOutline"}),(0,a.jsx)(i.IconButton,{disabled:!0,variant:"primary",icon:"PlaceholderOutline"}),(0,a.jsx)(i.IconButton,{disabled:!0,variant:"destructive",icon:"PlaceholderOutline"}),(0,a.jsx)(i.IconButton,{disabled:!0,variant:"tertiary",icon:"PlaceholderOutline"})]})},{title:"Loading",element:(0,a.jsxs)(i.Stack,{flexDirection:"row",gap:"$4",children:[(0,a.jsx)(i.IconButton,{loading:!0,icon:"PlaceholderOutline"}),(0,a.jsx)(i.IconButton,{loading:!0,variant:"primary",icon:"PlaceholderOutline"}),(0,a.jsx)(i.IconButton,{loading:!0,variant:"destructive",icon:"PlaceholderOutline"}),(0,a.jsx)(i.IconButton,{loading:!0,variant:"tertiary",icon:"PlaceholderOutline"})]})},{title:"Tooltip title",element:(0,a.jsxs)(i.Stack,{flexDirection:"row",gap:"$4",alignItems:"center",children:[(0,a.jsx)(i.IconButton,{icon:"PlaceholderOutline",title:"Qui nulla occaecat anim"}),(0,a.jsx)(i.IconButton,{variant:"tertiary",icon:"PlaceholderOutline",title:"Qui nulla occaecat anim Qui nulla occaecat anim Qui nulla occaecat anim Qui nulla occaecat anim "}),(0,a.jsx)(i.IconButton,{variant:"tertiary",icon:"PlaceholderOutline",title:(0,a.jsxs)(i.XStack,{alignItems:"center",children:[(0,a.jsx)(i.Tooltip.Text,{children:"Go back"}),(0,a.jsxs)(i.Shortcut,{ml:"$2",children:[(0,a.jsx)(i.Shortcut.Key,{children:l.s.CmdOrCtrl}),(0,a.jsx)(i.Shortcut.Key,{children:"t"})]})]})})]})}]})}},654004:(e,t,n)=>{n.d(t,{P:()=>Layout});var i=n(586330),l=n(654266),c=n(490343),a=n(989375),r=n(610421),o=n(498356),s=n(392097),d=n(831085),FormattedText=function({text:e}){return"string"==typeof e?(0,d.jsx)(c.Stack,{children:(0,d.jsxs)(c.SizableText,{children:[e,"。 "]})}):Array.isArray(e)&&0===e.length?null:(0,d.jsx)(c.Stack,{children:(0,d.jsx)(c.Stack,{gap:"$1",children:e.map((function(t,n){return(0,d.jsx)(c.Stack,{children:(0,d.jsxs)(c.SizableText,{children:[n+1,". ",t,n===e.length-1?"。":"；"]})},n.toString())}))})})};function Layout({description:e="",suggestions:t=[],boundaryConditions:n=[],elements:h=[],scrollEnabled:u=!0,contentInsetAdjustmentBehavior:x="never",skipLoading:j=!1,children:g}){var m=(0,a.U6)(),S=(0,o.A)();return(0,d.jsx)(c.Page,{skipLoading:j,children:(0,d.jsx)(c.ScrollView,{maxWidth:"100%",scrollEnabled:u,flex:1,marginBottom:m,paddingHorizontal:"$5",contentContainerStyle:{paddingTop:20,paddingBottom:280},keyboardDismissMode:"on-drag",contentInsetAdjustmentBehavior:x,children:(0,d.jsxs)(c.Stack,{marginHorizontal:"auto",maxWidth:"100%",width:576,gap:"$6",children:[(0,d.jsxs)(c.XStack,{children:[(0,d.jsx)(c.IconButton,{icon:"HomeLineOutline",onPress:function(){S.dispatch(l.y9.replace(s.WP.Main,{screen:s.V4.Developer,params:{screen:s.f$.TabDeveloper}}))}}),(0,d.jsx)(c.Button,{ml:"$4",onPress:(0,i.A)((function*(){yield r.A.serviceSetting.setTheme("light")})),children:"Light Theme"}),(0,d.jsx)(c.Button,{ml:"$4",variant:"primary",onPress:(0,i.A)((function*(){yield r.A.serviceSetting.setTheme("dark")})),children:"Dark Theme"})]}),e?(0,d.jsxs)(c.Stack,{gap:"$2",children:[(0,d.jsx)(c.Stack,{children:(0,d.jsx)(c.SizableText,{size:"$headingXl",children:"使用说明"})}),(0,d.jsx)(c.Stack,{children:(0,d.jsx)(FormattedText,{text:e})})]}):null,t?(0,d.jsxs)(c.Stack,{gap:"$2",children:[(0,d.jsx)(c.Stack,{children:(0,d.jsx)(c.SizableText,{size:"$headingXl",children:"使用建议"})}),(0,d.jsx)(FormattedText,{text:t})]}):null,n?.length>0?(0,d.jsxs)(c.Stack,{gap:"$2",children:[(0,d.jsx)(c.Stack,{children:(0,d.jsx)(c.SizableText,{size:"$headingXl",children:"注意事项"})}),(0,d.jsx)(FormattedText,{text:n})]}):null,(0,d.jsxs)(c.Stack,{gap:"$2",children:[(0,d.jsx)(c.Stack,{children:(0,d.jsx)(c.SizableText,{size:"$headingXl",children:"组件案例"})}),(0,d.jsx)(c.Stack,{children:h?.map((function(e,t){return(0,d.jsxs)(c.Stack,{gap:"$2",pb:"$8",mb:"$8",borderBottomWidth:"$px",borderBottomColor:"$borderSubdued",children:[(0,d.jsxs)(c.Stack,{flexDirection:"column",children:[(0,d.jsx)(c.SizableText,{size:"$headingLg",children:e.title}),e.description?(0,d.jsx)(c.Stack,{paddingTop:1,children:(0,d.jsxs)(c.SizableText,{children:[e.description,"。"]})}):null]}),(0,d.jsx)(c.Stack,{children:"function"==typeof e.element?(0,d.jsx)(e.element,{}):e.element})]},`elements-${t}`)}))}),(0,d.jsx)(c.Stack,{children:g?(0,d.jsx)(c.Stack,{gap:"$3",children:g}):null})]})]})})})}},187576:(e,t,n)=>{n.d(t,{s:()=>c});var i=n(663522),l=i.Ay.isDesktopMac||i.Ay.isNativeIOS||i.Ay.isRuntimeMacOSBrowser,c={CmdOrCtrl:l?"⌘":"Ctrl",Alt:l?"⌥":"Alt",Shift:l?"⇧":"Shift",Left:"←",Right:"→",Up:"↑",Down:"↓",Search:"/"}}}]);