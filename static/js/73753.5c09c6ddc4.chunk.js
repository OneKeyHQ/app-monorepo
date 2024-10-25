"use strict";(self.webpackChunkweb=self.webpackChunkweb||[]).push([[73753],{73753:(e,n,t)=>{t.r(n),t.d(n,{default:()=>stories_PasswordKeyboard});var i=t(514041),r=t(490343),s=t(831085),l="x";function PasswordKeyboard({value:e="",onChange:n}){var t=(0,i.useCallback)((function(t){t===l?n?.(e.substr(0,e.length-1)):e.length<6&&n?.(e+t)}),[e,n]),a=(0,i.useCallback)((function({item:e,index:n}){return(0,s.jsx)(r.Stack,{bg:"$bgStrong",disabled:e.length<=0,focusVisibleStyle:{bg:"$bgActive"},hoverStyle:{bg:"$bgActive"},pressStyle:{bg:"$bgActive"},"$platform-native":{flex:1},"$platform-web":{width:"33.3%"},marginRight:n%3!=2?1:0,marginTop:Math.floor(n/3)>0?1:0,h:"$14",justifyContent:"center",alignItems:"center",onPress:function(){return t(e)},children:e===l?(0,s.jsx)(r.Icon,{name:"XBackspaceOutline",color:"$iconStrong"}):(0,s.jsx)(r.SizableText,{size:"$heading3xl",children:e})})}),[t]);return(0,s.jsxs)(r.Stack,{borderRadius:"$3",overflow:"hidden",userSelect:"none",children:[(0,s.jsxs)(r.XStack,{bg:"$bgSubdued",h:"$12",alignItems:"center",children:[(0,s.jsx)(r.SizableText,{flex:1,size:"$heading4xl",textAlign:"center",children:new Array(e.length).fill("•").join("")}),(0,s.jsx)(r.Stack,{position:"absolute",right:"$3",top:0,bottom:0,justifyContent:"center",alignItems:"center",children:(0,s.jsx)(r.IconButton,{icon:"XBackspaceOutline",color:"$iconSubdued",variant:"tertiary",onPress:function(){return t(l)}})})]}),(0,s.jsx)(r.ListView,{scrollEnabled:!1,data:["1","2","3","4","5","6","7","8","9","","0",l],numColumns:3,estimatedItemSize:"$10",renderItem:a})]})}var a=t(654004);const stories_PasswordKeyboard=function(){return(0,s.jsx)(a.P,{description:"..",suggestions:["..."],boundaryConditions:["..."],elements:[{title:"Uncontrolled",element:function(){var[e,n]=(0,i.useState)("");return(0,s.jsx)(PasswordKeyboard,{value:e,onChange:function(e){n(e)}})}}]})}},654004:(e,n,t)=>{t.d(n,{P:()=>Layout});var i=t(586330),r=t(654266),s=t(490343),l=t(989375),a=t(610421),c=t(498356),o=t(392097),d=t(831085),FormattedText=function({text:e}){return"string"==typeof e?(0,d.jsx)(s.Stack,{children:(0,d.jsxs)(s.SizableText,{children:[e,"。 "]})}):Array.isArray(e)&&0===e.length?null:(0,d.jsx)(s.Stack,{children:(0,d.jsx)(s.Stack,{gap:"$1",children:e.map((function(n,t){return(0,d.jsx)(s.Stack,{children:(0,d.jsxs)(s.SizableText,{children:[t+1,". ",n,t===e.length-1?"。":"；"]})},t.toString())}))})})};function Layout({description:e="",suggestions:n=[],boundaryConditions:t=[],elements:h=[],scrollEnabled:x=!0,contentInsetAdjustmentBehavior:u="never",skipLoading:g=!1,children:j}){var S=(0,l.U6)(),b=(0,c.A)();return(0,d.jsx)(s.Page,{skipLoading:g,children:(0,d.jsx)(s.ScrollView,{maxWidth:"100%",scrollEnabled:x,flex:1,marginBottom:S,paddingHorizontal:"$5",contentContainerStyle:{paddingTop:20,paddingBottom:280},keyboardDismissMode:"on-drag",contentInsetAdjustmentBehavior:u,children:(0,d.jsxs)(s.Stack,{marginHorizontal:"auto",maxWidth:"100%",width:576,gap:"$6",children:[(0,d.jsxs)(s.XStack,{children:[(0,d.jsx)(s.IconButton,{icon:"HomeLineOutline",onPress:function(){b.dispatch(r.y9.replace(o.WP.Main,{screen:o.V4.Developer,params:{screen:o.f$.TabDeveloper}}))}}),(0,d.jsx)(s.Button,{ml:"$4",onPress:(0,i.A)((function*(){yield a.A.serviceSetting.setTheme("light")})),children:"Light Theme"}),(0,d.jsx)(s.Button,{ml:"$4",variant:"primary",onPress:(0,i.A)((function*(){yield a.A.serviceSetting.setTheme("dark")})),children:"Dark Theme"})]}),e?(0,d.jsxs)(s.Stack,{gap:"$2",children:[(0,d.jsx)(s.Stack,{children:(0,d.jsx)(s.SizableText,{size:"$headingXl",children:"使用说明"})}),(0,d.jsx)(s.Stack,{children:(0,d.jsx)(FormattedText,{text:e})})]}):null,n?(0,d.jsxs)(s.Stack,{gap:"$2",children:[(0,d.jsx)(s.Stack,{children:(0,d.jsx)(s.SizableText,{size:"$headingXl",children:"使用建议"})}),(0,d.jsx)(FormattedText,{text:n})]}):null,t?.length>0?(0,d.jsxs)(s.Stack,{gap:"$2",children:[(0,d.jsx)(s.Stack,{children:(0,d.jsx)(s.SizableText,{size:"$headingXl",children:"注意事项"})}),(0,d.jsx)(FormattedText,{text:t})]}):null,(0,d.jsxs)(s.Stack,{gap:"$2",children:[(0,d.jsx)(s.Stack,{children:(0,d.jsx)(s.SizableText,{size:"$headingXl",children:"组件案例"})}),(0,d.jsx)(s.Stack,{children:h?.map((function(e,n){return(0,d.jsxs)(s.Stack,{gap:"$2",pb:"$8",mb:"$8",borderBottomWidth:"$px",borderBottomColor:"$borderSubdued",children:[(0,d.jsxs)(s.Stack,{flexDirection:"column",children:[(0,d.jsx)(s.SizableText,{size:"$headingLg",children:e.title}),e.description?(0,d.jsx)(s.Stack,{paddingTop:1,children:(0,d.jsxs)(s.SizableText,{children:[e.description,"。"]})}):null]}),(0,d.jsx)(s.Stack,{children:"function"==typeof e.element?(0,d.jsx)(e.element,{}):e.element})]},`elements-${n}`)}))}),(0,d.jsx)(s.Stack,{children:j?(0,d.jsx)(s.Stack,{gap:"$3",children:j}):null})]})]})})})}}}]);