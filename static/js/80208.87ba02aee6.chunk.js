"use strict";(self.webpackChunkweb=self.webpackChunkweb||[]).push([[80208],{593827:(e,t,n)=>{n.d(t,{L:()=>WalletAvatar});var l=n(503668),i=n.n(l),a=n(490343),s=n(491180),r=n(258988),c=n(831085);function WalletAvatarBase({size:e,img:t,wallet:n}){var l,i,d=t||n?.avatarInfo?.img;return d?s.A.isHwHiddenWallet({wallet:n})?(0,c.jsx)(a.Icon,{size:"$10",name:"LockSolid",color:"$iconSubdued"}):(0,c.jsxs)(a.Image,{size:e,children:[(0,c.jsx)(a.Image.Source,{source:null!=(l=r.UO[d])?l:r.UO.bear}),(0,c.jsx)(a.Image.Fallback,{delayMs:300,justifyContent:"center",alignItems:"center",children:(0,c.jsx)(a.SizableText,{children:null!=(i=n?.avatarInfo?.emoji)?i:""})})]}):null}function WalletAvatar({size:e="$10",status:t,badge:n,img:l,wallet:s}){return(0,c.jsxs)(a.Stack,{w:e,h:e,justifyContent:"center",alignItems:"center",children:[(0,c.jsx)(WalletAvatarBase,{size:e,img:l,wallet:s}),"connected"===t?(0,c.jsx)(a.Stack,{position:"absolute",bottom:-2,right:-2,bg:"$bgSidebar",p:"$0.5",borderRadius:"$full",zIndex:"$1",children:(0,c.jsx)(a.Stack,{borderRadius:"$full",w:"$2.5",h:"$2.5",bg:"$bgSuccessStrong"})}):null,i()(n)?null:(0,c.jsx)(a.Stack,{position:"absolute",h:"$4",px:"$0.5",justifyContent:"center",bottom:-2,right:-1,bg:"$bgSubdued",borderRadius:"$full",zIndex:"$1",children:(0,c.jsx)(a.SizableText,{size:"$bodySm",textAlign:"center",children:n})})]})}},980208:(e,t,n)=>{n.r(t),n.d(t,{default:()=>__WEBPACK_DEFAULT_EXPORT__});var l=n(490343),i=n(593827),a=n(654004),s=n(831085),r={id:"hd-2",name:"wallet 124",avatar:n(569513),type:"hd",backuped:!1,nextIds:{hiddenWalletNum:1,accountGlobalNum:1,accountHdIndex:0},accounts:[],walletNo:0,avatarInfo:{img:"pig"}};const __WEBPACK_DEFAULT_EXPORT__=function(){return(0,s.jsx)(a.P,{description:"",suggestions:[""],boundaryConditions:[""],elements:[{title:"Default",element:(0,s.jsxs)(l.YStack,{gap:"$2",children:[(0,s.jsx)(i.L,{size:"$20",wallet:r}),(0,s.jsx)(i.L,{img:"panda",wallet:void 0}),(0,s.jsx)(i.L,{img:"panda",wallet:void 0}),(0,s.jsx)(i.L,{wallet:r}),(0,s.jsx)(i.L,{wallet:r,status:"connected"}),(0,s.jsx)(i.L,{size:"small",wallet:r})]})}]})}},654004:(e,t,n)=>{n.d(t,{P:()=>Layout});var l=n(586330),i=n(654266),a=n(490343),s=n(989375),r=n(610421),c=n(498356),d=n(392097),o=n(831085),FormattedText=function({text:e}){return"string"==typeof e?(0,o.jsx)(a.Stack,{children:(0,o.jsxs)(a.SizableText,{children:[e,"。 "]})}):Array.isArray(e)&&0===e.length?null:(0,o.jsx)(a.Stack,{children:(0,o.jsx)(a.Stack,{gap:"$1",children:e.map((function(t,n){return(0,o.jsx)(a.Stack,{children:(0,o.jsxs)(a.SizableText,{children:[n+1,". ",t,n===e.length-1?"。":"；"]})},n.toString())}))})})};function Layout({description:e="",suggestions:t=[],boundaryConditions:n=[],elements:x=[],scrollEnabled:u=!0,contentInsetAdjustmentBehavior:h="never",skipLoading:j=!1,children:g}){var m=(0,s.U6)(),S=(0,c.A)();return(0,o.jsx)(a.Page,{skipLoading:j,children:(0,o.jsx)(a.ScrollView,{maxWidth:"100%",scrollEnabled:u,flex:1,marginBottom:m,paddingHorizontal:"$5",contentContainerStyle:{paddingTop:20,paddingBottom:280},keyboardDismissMode:"on-drag",contentInsetAdjustmentBehavior:h,children:(0,o.jsxs)(a.Stack,{marginHorizontal:"auto",maxWidth:"100%",width:576,gap:"$6",children:[(0,o.jsxs)(a.XStack,{children:[(0,o.jsx)(a.IconButton,{icon:"HomeLineOutline",onPress:function(){S.dispatch(i.y9.replace(d.WP.Main,{screen:d.V4.Developer,params:{screen:d.f$.TabDeveloper}}))}}),(0,o.jsx)(a.Button,{ml:"$4",onPress:(0,l.A)((function*(){yield r.A.serviceSetting.setTheme("light")})),children:"Light Theme"}),(0,o.jsx)(a.Button,{ml:"$4",variant:"primary",onPress:(0,l.A)((function*(){yield r.A.serviceSetting.setTheme("dark")})),children:"Dark Theme"})]}),e?(0,o.jsxs)(a.Stack,{gap:"$2",children:[(0,o.jsx)(a.Stack,{children:(0,o.jsx)(a.SizableText,{size:"$headingXl",children:"使用说明"})}),(0,o.jsx)(a.Stack,{children:(0,o.jsx)(FormattedText,{text:e})})]}):null,t?(0,o.jsxs)(a.Stack,{gap:"$2",children:[(0,o.jsx)(a.Stack,{children:(0,o.jsx)(a.SizableText,{size:"$headingXl",children:"使用建议"})}),(0,o.jsx)(FormattedText,{text:t})]}):null,n?.length>0?(0,o.jsxs)(a.Stack,{gap:"$2",children:[(0,o.jsx)(a.Stack,{children:(0,o.jsx)(a.SizableText,{size:"$headingXl",children:"注意事项"})}),(0,o.jsx)(FormattedText,{text:n})]}):null,(0,o.jsxs)(a.Stack,{gap:"$2",children:[(0,o.jsx)(a.Stack,{children:(0,o.jsx)(a.SizableText,{size:"$headingXl",children:"组件案例"})}),(0,o.jsx)(a.Stack,{children:x?.map((function(e,t){return(0,o.jsxs)(a.Stack,{gap:"$2",pb:"$8",mb:"$8",borderBottomWidth:"$px",borderBottomColor:"$borderSubdued",children:[(0,o.jsxs)(a.Stack,{flexDirection:"column",children:[(0,o.jsx)(a.SizableText,{size:"$headingLg",children:e.title}),e.description?(0,o.jsx)(a.Stack,{paddingTop:1,children:(0,o.jsxs)(a.SizableText,{children:[e.description,"。"]})}):null]}),(0,o.jsx)(a.Stack,{children:"function"==typeof e.element?(0,o.jsx)(e.element,{}):e.element})]},`elements-${t}`)}))}),(0,o.jsx)(a.Stack,{children:g?(0,o.jsx)(a.Stack,{gap:"$3",children:g}):null})]})]})})})}}}]);