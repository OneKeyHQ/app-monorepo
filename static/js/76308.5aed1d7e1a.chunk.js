"use strict";(self.webpackChunkweb=self.webpackChunkweb||[]).push([[76308],{276308:(e,t,i)=>{i.r(t),i.d(t,{default:()=>__WEBPACK_DEFAULT_EXPORT__});var n=i(490343),l=i(654004),r=i(831085);const __WEBPACK_DEFAULT_EXPORT__=function(){return(0,r.jsx)(l.P,{description:"...",suggestions:[],boundaryConditions:[],elements:[{title:"State",element:(0,r.jsxs)(n.YStack,{gap:"$4",children:[(0,r.jsx)(n.Alert,{title:"Title",description:"Description here...",icon:"PlaceholderOutline"}),(0,r.jsx)(n.Alert,{type:"success",title:"Title",description:"Description here...",icon:"PlaceholderOutline"}),(0,r.jsx)(n.Alert,{type:"critical",title:"Title",description:"Description here...",icon:"PlaceholderOutline"}),(0,r.jsx)(n.Alert,{type:"info",title:"Title",description:"Description here...",icon:"PlaceholderOutline"}),(0,r.jsx)(n.Alert,{type:"warning",title:"Title",description:"Description here...",icon:"PlaceholderOutline"})]})},{title:"Dismiss",element:(0,r.jsx)(n.YStack,{gap:"$4",children:(0,r.jsx)(n.Alert,{title:"Title",description:"Description here...",icon:"PlaceholderOutline",closable:!0})})},{title:"Actions",element:(0,r.jsxs)(n.YStack,{gap:"$4",children:[(0,r.jsx)(n.Alert,{title:"Title",description:"Description here...",icon:"PlaceholderOutline",action:{primary:"Action"}}),(0,r.jsx)(n.Alert,{title:"Title",description:"Description here...",icon:"PlaceholderOutline",action:{primary:"Action",onPrimaryPress(){alert("primary")},secondary:"Learn More",onSecondaryPress(){alert("secondary")}}})]})},{title:"fullBleed",element:(0,r.jsx)(n.YStack,{gap:"$4",children:(0,r.jsx)(n.Alert,{fullBleed:!0,title:"fullBleed",description:"Description here...",icon:"PlaceholderOutline",action:{primary:"Action"}})})}]})}},654004:(e,t,i)=>{i.d(t,{P:()=>Layout});var n=i(586330),l=i(654266),r=i(490343),s=i(989375),c=i(610421),o=i(498356),a=i(392097),d=i(831085),FormattedText=function({text:e}){return"string"==typeof e?(0,d.jsx)(r.Stack,{children:(0,d.jsxs)(r.SizableText,{children:[e,"。 "]})}):Array.isArray(e)&&0===e.length?null:(0,d.jsx)(r.Stack,{children:(0,d.jsx)(r.Stack,{gap:"$1",children:e.map((function(t,i){return(0,d.jsx)(r.Stack,{children:(0,d.jsxs)(r.SizableText,{children:[i+1,". ",t,i===e.length-1?"。":"；"]})},i.toString())}))})})};function Layout({description:e="",suggestions:t=[],boundaryConditions:i=[],elements:h=[],scrollEnabled:x=!0,contentInsetAdjustmentBehavior:p="never",skipLoading:j=!1,children:u}){var g=(0,s.U6)(),S=(0,o.A)();return(0,d.jsx)(r.Page,{skipLoading:j,children:(0,d.jsx)(r.ScrollView,{maxWidth:"100%",scrollEnabled:x,flex:1,marginBottom:g,paddingHorizontal:"$5",contentContainerStyle:{paddingTop:20,paddingBottom:280},keyboardDismissMode:"on-drag",contentInsetAdjustmentBehavior:p,children:(0,d.jsxs)(r.Stack,{marginHorizontal:"auto",maxWidth:"100%",width:576,gap:"$6",children:[(0,d.jsxs)(r.XStack,{children:[(0,d.jsx)(r.IconButton,{icon:"HomeLineOutline",onPress:function(){S.dispatch(l.y9.replace(a.WP.Main,{screen:a.V4.Developer,params:{screen:a.f$.TabDeveloper}}))}}),(0,d.jsx)(r.Button,{ml:"$4",onPress:(0,n.A)((function*(){yield c.A.serviceSetting.setTheme("light")})),children:"Light Theme"}),(0,d.jsx)(r.Button,{ml:"$4",variant:"primary",onPress:(0,n.A)((function*(){yield c.A.serviceSetting.setTheme("dark")})),children:"Dark Theme"})]}),e?(0,d.jsxs)(r.Stack,{gap:"$2",children:[(0,d.jsx)(r.Stack,{children:(0,d.jsx)(r.SizableText,{size:"$headingXl",children:"使用说明"})}),(0,d.jsx)(r.Stack,{children:(0,d.jsx)(FormattedText,{text:e})})]}):null,t?(0,d.jsxs)(r.Stack,{gap:"$2",children:[(0,d.jsx)(r.Stack,{children:(0,d.jsx)(r.SizableText,{size:"$headingXl",children:"使用建议"})}),(0,d.jsx)(FormattedText,{text:t})]}):null,i?.length>0?(0,d.jsxs)(r.Stack,{gap:"$2",children:[(0,d.jsx)(r.Stack,{children:(0,d.jsx)(r.SizableText,{size:"$headingXl",children:"注意事项"})}),(0,d.jsx)(FormattedText,{text:i})]}):null,(0,d.jsxs)(r.Stack,{gap:"$2",children:[(0,d.jsx)(r.Stack,{children:(0,d.jsx)(r.SizableText,{size:"$headingXl",children:"组件案例"})}),(0,d.jsx)(r.Stack,{children:h?.map((function(e,t){return(0,d.jsxs)(r.Stack,{gap:"$2",pb:"$8",mb:"$8",borderBottomWidth:"$px",borderBottomColor:"$borderSubdued",children:[(0,d.jsxs)(r.Stack,{flexDirection:"column",children:[(0,d.jsx)(r.SizableText,{size:"$headingLg",children:e.title}),e.description?(0,d.jsx)(r.Stack,{paddingTop:1,children:(0,d.jsxs)(r.SizableText,{children:[e.description,"。"]})}):null]}),(0,d.jsx)(r.Stack,{children:"function"==typeof e.element?(0,d.jsx)(e.element,{}):e.element})]},`elements-${t}`)}))}),(0,d.jsx)(r.Stack,{children:u?(0,d.jsx)(r.Stack,{gap:"$3",children:u}):null})]})]})})})}}}]);