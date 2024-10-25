"use strict";(self.webpackChunkweb=self.webpackChunkweb||[]).push([[73412],{173412:(e,t,n)=>{n.r(t),n.d(t,{default:()=>__WEBPACK_DEFAULT_EXPORT__});var i=n(490343),r=n(654004),l=n(831085);const __WEBPACK_DEFAULT_EXPORT__=function(){return(0,l.jsx)(r.P,{description:"..",suggestions:["..."],boundaryConditions:["..."],elements:[{title:"Variants",element:(0,l.jsxs)(i.YStack,{gap:"$2",alignItems:"center",children:[(0,l.jsx)(i.Button,{icon:"PlaceholderOutline",children:"Secondary"}),(0,l.jsx)(i.Button,{icon:"PlaceholderOutline",variant:"primary",children:"Primary"}),(0,l.jsx)(i.Button,{icon:"PlaceholderOutline",variant:"destructive",children:"Destructive"}),(0,l.jsx)(i.Button,{icon:"PlaceholderOutline",variant:"tertiary",children:"Tertiary"})]})},{title:"Sizes",element:(0,l.jsxs)(i.Stack,{gap:"$4",children:[(0,l.jsxs)(i.XStack,{gap:"$4",alignItems:"flex-end",children:[(0,l.jsx)(i.Button,{size:"small",children:"Small"}),(0,l.jsx)(i.Button,{children:"Medium"}),(0,l.jsx)(i.Button,{size:"large",children:"Large"})]}),(0,l.jsxs)(i.XStack,{gap:"$4",alignItems:"flex-end",children:[(0,l.jsx)(i.Button,{size:"small",icon:"PlaceholderOutline",children:"Small"}),(0,l.jsx)(i.Button,{icon:"PlaceholderOutline",children:"Medium"}),(0,l.jsx)(i.Button,{size:"large",icon:"PlaceholderOutline",children:"Large"})]})]})},{title:"Disabled",element:(0,l.jsxs)(i.Stack,{gap:"$4",children:[(0,l.jsx)(i.Button,{disabled:!0,children:"Secondary"}),(0,l.jsx)(i.Button,{disabled:!0,variant:"primary",children:"Primary"}),(0,l.jsx)(i.Button,{disabled:!0,variant:"destructive",children:"Destructive"}),(0,l.jsx)(i.Button,{disabled:!0,variant:"tertiary",children:"Tertiary"})]})},{title:"Loading",element:(0,l.jsxs)(i.Stack,{gap:"$4",children:[(0,l.jsx)(i.Button,{loading:!0,children:"Secondary"}),(0,l.jsx)(i.Button,{loading:!0,variant:"primary",children:"Primary"}),(0,l.jsx)(i.Button,{loading:!0,variant:"destructive",children:"Destructive"}),(0,l.jsx)(i.Button,{loading:!0,variant:"tertiary",children:"Tertiary"})]})},{title:"iconAfter",element:(0,l.jsx)(i.Stack,{gap:"$4",children:(0,l.jsx)(i.Button,{iconAfter:"PlaceholderOutline",color:"$red1",children:"IconAfter"})})}]})}},654004:(e,t,n)=>{n.d(t,{P:()=>Layout});var i=n(586330),r=n(654266),l=n(490343),a=n(989375),s=n(610421),c=n(498356),d=n(392097),o=n(831085),FormattedText=function({text:e}){return"string"==typeof e?(0,o.jsx)(l.Stack,{children:(0,o.jsxs)(l.SizableText,{children:[e,"。 "]})}):Array.isArray(e)&&0===e.length?null:(0,o.jsx)(l.Stack,{children:(0,o.jsx)(l.Stack,{gap:"$1",children:e.map((function(t,n){return(0,o.jsx)(l.Stack,{children:(0,o.jsxs)(l.SizableText,{children:[n+1,". ",t,n===e.length-1?"。":"；"]})},n.toString())}))})})};function Layout({description:e="",suggestions:t=[],boundaryConditions:n=[],elements:h=[],scrollEnabled:x=!0,contentInsetAdjustmentBehavior:u="never",skipLoading:j=!1,children:g}){var m=(0,a.U6)(),S=(0,c.A)();return(0,o.jsx)(l.Page,{skipLoading:j,children:(0,o.jsx)(l.ScrollView,{maxWidth:"100%",scrollEnabled:x,flex:1,marginBottom:m,paddingHorizontal:"$5",contentContainerStyle:{paddingTop:20,paddingBottom:280},keyboardDismissMode:"on-drag",contentInsetAdjustmentBehavior:u,children:(0,o.jsxs)(l.Stack,{marginHorizontal:"auto",maxWidth:"100%",width:576,gap:"$6",children:[(0,o.jsxs)(l.XStack,{children:[(0,o.jsx)(l.IconButton,{icon:"HomeLineOutline",onPress:function(){S.dispatch(r.y9.replace(d.WP.Main,{screen:d.V4.Developer,params:{screen:d.f$.TabDeveloper}}))}}),(0,o.jsx)(l.Button,{ml:"$4",onPress:(0,i.A)((function*(){yield s.A.serviceSetting.setTheme("light")})),children:"Light Theme"}),(0,o.jsx)(l.Button,{ml:"$4",variant:"primary",onPress:(0,i.A)((function*(){yield s.A.serviceSetting.setTheme("dark")})),children:"Dark Theme"})]}),e?(0,o.jsxs)(l.Stack,{gap:"$2",children:[(0,o.jsx)(l.Stack,{children:(0,o.jsx)(l.SizableText,{size:"$headingXl",children:"使用说明"})}),(0,o.jsx)(l.Stack,{children:(0,o.jsx)(FormattedText,{text:e})})]}):null,t?(0,o.jsxs)(l.Stack,{gap:"$2",children:[(0,o.jsx)(l.Stack,{children:(0,o.jsx)(l.SizableText,{size:"$headingXl",children:"使用建议"})}),(0,o.jsx)(FormattedText,{text:t})]}):null,n?.length>0?(0,o.jsxs)(l.Stack,{gap:"$2",children:[(0,o.jsx)(l.Stack,{children:(0,o.jsx)(l.SizableText,{size:"$headingXl",children:"注意事项"})}),(0,o.jsx)(FormattedText,{text:n})]}):null,(0,o.jsxs)(l.Stack,{gap:"$2",children:[(0,o.jsx)(l.Stack,{children:(0,o.jsx)(l.SizableText,{size:"$headingXl",children:"组件案例"})}),(0,o.jsx)(l.Stack,{children:h?.map((function(e,t){return(0,o.jsxs)(l.Stack,{gap:"$2",pb:"$8",mb:"$8",borderBottomWidth:"$px",borderBottomColor:"$borderSubdued",children:[(0,o.jsxs)(l.Stack,{flexDirection:"column",children:[(0,o.jsx)(l.SizableText,{size:"$headingLg",children:e.title}),e.description?(0,o.jsx)(l.Stack,{paddingTop:1,children:(0,o.jsxs)(l.SizableText,{children:[e.description,"。"]})}):null]}),(0,o.jsx)(l.Stack,{children:"function"==typeof e.element?(0,o.jsx)(e.element,{}):e.element})]},`elements-${t}`)}))}),(0,o.jsx)(l.Stack,{children:g?(0,o.jsx)(l.Stack,{gap:"$3",children:g}):null})]})]})})})}}}]);