"use strict";(self.webpackChunkweb=self.webpackChunkweb||[]).push([[29781],{529781:(e,n,t)=>{t.r(n),t.d(n,{default:()=>h});var i=t(586330),s=t(514041),l=t(578104),r=t(490343),a=t(619115),c=t(561109),d=t(654004),o=t(831085);const h=function WebEmbedGallery(){var e,[n,t]=(0,s.useState)(""),[h,u]=(0,s.useState)(!1),x=(0,l.YQ)((e=(0,i.A)((function*({url:e,debug:n}){c.A.setWebEmbedConfig({url:e,debug:n})})),function(n){return e.apply(this,arguments)}),600,{leading:!1,trailing:!0});return(0,s.useEffect)((function(){x({url:n,debug:h})}),[n,h,x]),(0,s.useEffect)((function(){var e,n,i=c.A.getWebEmbedConfig();t(null!=(e=i?.url)?e:""),u(null!=(n=i?.debug)&&n)}),[]),(0,o.jsx)(d.P,{description:"...",suggestions:[],boundaryConditions:[],elements:[{title:"WebEmbedConfig",element:(0,o.jsxs)(r.YStack,{gap:"$4",children:[(0,o.jsxs)(r.Stack,{flexDirection:"row",alignItems:"center",gap:"$2",children:[(0,o.jsx)(r.Switch,{value:h,onChange:u}),(0,o.jsx)(r.SizableText,{children:"Debug mode (show webview floating panel)"})]}),(0,o.jsxs)(r.YStack,{children:[(0,o.jsx)(r.SizableText,{onPress:function(){t("http://localhost:3008")},children:"Webview Url ( Real device, please use local LAN network ip address, and update WEB_EMBED_API_WHITE_LIST_ORIGIN )"}),(0,o.jsx)(r.Input,{value:n,onChangeText:t})]}),(0,o.jsx)(r.Button,{onPress:(0,i.A)((function*(){var e=yield a.A.test.test1("a","b","c","d");alert(JSON.stringify(e))})),children:"Test RPC"})]})}]})}},654004:(e,n,t)=>{t.d(n,{P:()=>Layout});var i=t(586330),s=t(654266),l=t(490343),r=t(989375),a=t(610421),c=t(498356),d=t(392097),o=t(831085),FormattedText=function({text:e}){return"string"==typeof e?(0,o.jsx)(l.Stack,{children:(0,o.jsxs)(l.SizableText,{children:[e,"。 "]})}):Array.isArray(e)&&0===e.length?null:(0,o.jsx)(l.Stack,{children:(0,o.jsx)(l.Stack,{gap:"$1",children:e.map((function(n,t){return(0,o.jsx)(l.Stack,{children:(0,o.jsxs)(l.SizableText,{children:[t+1,". ",n,t===e.length-1?"。":"；"]})},t.toString())}))})})};function Layout({description:e="",suggestions:n=[],boundaryConditions:t=[],elements:h=[],scrollEnabled:u=!0,contentInsetAdjustmentBehavior:x="never",skipLoading:g=!1,children:j}){var S=(0,r.U6)(),p=(0,c.A)();return(0,o.jsx)(l.Page,{skipLoading:g,children:(0,o.jsx)(l.ScrollView,{maxWidth:"100%",scrollEnabled:u,flex:1,marginBottom:S,paddingHorizontal:"$5",contentContainerStyle:{paddingTop:20,paddingBottom:280},keyboardDismissMode:"on-drag",contentInsetAdjustmentBehavior:x,children:(0,o.jsxs)(l.Stack,{marginHorizontal:"auto",maxWidth:"100%",width:576,gap:"$6",children:[(0,o.jsxs)(l.XStack,{children:[(0,o.jsx)(l.IconButton,{icon:"HomeLineOutline",onPress:function(){p.dispatch(s.y9.replace(d.WP.Main,{screen:d.V4.Developer,params:{screen:d.f$.TabDeveloper}}))}}),(0,o.jsx)(l.Button,{ml:"$4",onPress:(0,i.A)((function*(){yield a.A.serviceSetting.setTheme("light")})),children:"Light Theme"}),(0,o.jsx)(l.Button,{ml:"$4",variant:"primary",onPress:(0,i.A)((function*(){yield a.A.serviceSetting.setTheme("dark")})),children:"Dark Theme"})]}),e?(0,o.jsxs)(l.Stack,{gap:"$2",children:[(0,o.jsx)(l.Stack,{children:(0,o.jsx)(l.SizableText,{size:"$headingXl",children:"使用说明"})}),(0,o.jsx)(l.Stack,{children:(0,o.jsx)(FormattedText,{text:e})})]}):null,n?(0,o.jsxs)(l.Stack,{gap:"$2",children:[(0,o.jsx)(l.Stack,{children:(0,o.jsx)(l.SizableText,{size:"$headingXl",children:"使用建议"})}),(0,o.jsx)(FormattedText,{text:n})]}):null,t?.length>0?(0,o.jsxs)(l.Stack,{gap:"$2",children:[(0,o.jsx)(l.Stack,{children:(0,o.jsx)(l.SizableText,{size:"$headingXl",children:"注意事项"})}),(0,o.jsx)(FormattedText,{text:t})]}):null,(0,o.jsxs)(l.Stack,{gap:"$2",children:[(0,o.jsx)(l.Stack,{children:(0,o.jsx)(l.SizableText,{size:"$headingXl",children:"组件案例"})}),(0,o.jsx)(l.Stack,{children:h?.map((function(e,n){return(0,o.jsxs)(l.Stack,{gap:"$2",pb:"$8",mb:"$8",borderBottomWidth:"$px",borderBottomColor:"$borderSubdued",children:[(0,o.jsxs)(l.Stack,{flexDirection:"column",children:[(0,o.jsx)(l.SizableText,{size:"$headingLg",children:e.title}),e.description?(0,o.jsx)(l.Stack,{paddingTop:1,children:(0,o.jsxs)(l.SizableText,{children:[e.description,"。"]})}):null]}),(0,o.jsx)(l.Stack,{children:"function"==typeof e.element?(0,o.jsx)(e.element,{}):e.element})]},`elements-${n}`)}))}),(0,o.jsx)(l.Stack,{children:j?(0,o.jsx)(l.Stack,{gap:"$3",children:j}):null})]})]})})})}}}]);