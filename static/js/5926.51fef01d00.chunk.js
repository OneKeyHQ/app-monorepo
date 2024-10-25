"use strict";(self.webpackChunkweb=self.webpackChunkweb||[]).push([[5926],{705926:(e,n,t)=>{t.r(n),t.d(n,{default:()=>__WEBPACK_DEFAULT_EXPORT__});var l=t(490343),i=t(654004),a=t(831085),Form1=function(){var e=(0,l.useForm)({defaultValues:{name:"Nate Wienert",length:"1234567",checkbox:!0,textArea:"textArea1\ntextArea2",switch:!0,radio:"4",search:"search",customInput:"",defaultPrevented:""}});return(0,a.jsxs)(l.Form,{form:e,children:[(0,a.jsx)(l.Form.Field,{label:"Name",name:"name",children:(0,a.jsx)(l.Input,{flex:1})}),(0,a.jsx)(l.Form.Field,{label:"MaxLength",name:"length",rules:{maxLength:{value:6,message:"maxLength is 6"}},children:(0,a.jsx)(l.Input,{placeholder:"Max Length Limit"})}),(0,a.jsx)(l.Form.Field,{label:"Required",name:"required",description:"This field is required",rules:{required:{value:!0,message:"requied input text"}},children:(0,a.jsx)(l.Input,{placeholder:"Required"})}),(0,a.jsx)(l.Form.Field,{label:"customInput",name:"customInput",description:"custom onChange value",children:(0,a.jsx)(l.Input,{placeholder:"Required",onChangeText:function(e){return e.length>10?e.slice(0,10):e}})}),(0,a.jsx)(l.Form.Field,{label:"TextArea",name:"textArea",rules:{validate:function(e){return new Promise((function(n){setTimeout((function(){e.includes("textArea")?n("`textArea` annot be included in this value"):n(!0)}),1500)}))}},children:(0,a.jsx)(l.TextArea,{multiline:!0,h:"$16",placeholder:"TextArea"})}),(0,a.jsx)(l.Form.Field,{label:"Checkbox",name:"checkbox",children:(0,a.jsx)(l.Checkbox,{label:"checkbox"})}),(0,a.jsx)(l.Form.Field,{label:"Switch",name:"switch",horizontal:!0,children:(0,a.jsx)(l.Switch,{})}),(0,a.jsx)(l.Form.Field,{label:"Radio",name:"radio",labelAddon:"between 1 and 10000 sats",children:(0,a.jsx)(l.Radio,{options:[{label:"Second value",value:"2"},{label:"Third value",value:"3"},{label:"Fourth value",value:"4"}]})}),(0,a.jsx)(l.Form.Field,{label:"Disable A Value",name:"defaultPrevented",children:(0,a.jsx)(l.Radio,{onChange:function(e){return"A"===e?{defaultPrevented:!0}:e},options:[{label:"A value",value:"A"},{label:"B value",value:"B"},{label:"C value",value:"C"}]})}),(0,a.jsx)(l.Form.Field,{label:"search",name:"search",children:(0,a.jsx)(l.SearchBar,{})}),(0,a.jsx)(l.Form.Field,{name:"search",children:(0,a.jsx)(l.SearchBar,{})}),(0,a.jsx)(l.Button,{onPress:function(){},children:"Log result & Check in Console"})]})};const __WEBPACK_DEFAULT_EXPORT__=function(){return(0,a.jsx)(i.P,{description:"通过表单完成内容提交",suggestions:["通过表单组件控制输入内容，尽可能避免直接操作输入组件","表单组件集成了键盘操作事件，对输入更为友好"],boundaryConditions:["禁止将 Dialog 作为路由页面使用"],elements:[{title:"Simple Input Form",element:(0,a.jsx)(Form1,{})}]})}},654004:(e,n,t)=>{t.d(n,{P:()=>Layout});var l=t(586330),i=t(654266),a=t(490343),r=t(989375),s=t(610421),c=t(498356),d=t(392097),o=t(831085),FormattedText=function({text:e}){return"string"==typeof e?(0,o.jsx)(a.Stack,{children:(0,o.jsxs)(a.SizableText,{children:[e,"。 "]})}):Array.isArray(e)&&0===e.length?null:(0,o.jsx)(a.Stack,{children:(0,o.jsx)(a.Stack,{gap:"$1",children:e.map((function(n,t){return(0,o.jsx)(a.Stack,{children:(0,o.jsxs)(a.SizableText,{children:[t+1,". ",n,t===e.length-1?"。":"；"]})},t.toString())}))})})};function Layout({description:e="",suggestions:n=[],boundaryConditions:t=[],elements:h=[],scrollEnabled:u=!0,contentInsetAdjustmentBehavior:x="never",skipLoading:m=!1,children:j}){var p=(0,r.U6)(),g=(0,c.A)();return(0,o.jsx)(a.Page,{skipLoading:m,children:(0,o.jsx)(a.ScrollView,{maxWidth:"100%",scrollEnabled:u,flex:1,marginBottom:p,paddingHorizontal:"$5",contentContainerStyle:{paddingTop:20,paddingBottom:280},keyboardDismissMode:"on-drag",contentInsetAdjustmentBehavior:x,children:(0,o.jsxs)(a.Stack,{marginHorizontal:"auto",maxWidth:"100%",width:576,gap:"$6",children:[(0,o.jsxs)(a.XStack,{children:[(0,o.jsx)(a.IconButton,{icon:"HomeLineOutline",onPress:function(){g.dispatch(i.y9.replace(d.WP.Main,{screen:d.V4.Developer,params:{screen:d.f$.TabDeveloper}}))}}),(0,o.jsx)(a.Button,{ml:"$4",onPress:(0,l.A)((function*(){yield s.A.serviceSetting.setTheme("light")})),children:"Light Theme"}),(0,o.jsx)(a.Button,{ml:"$4",variant:"primary",onPress:(0,l.A)((function*(){yield s.A.serviceSetting.setTheme("dark")})),children:"Dark Theme"})]}),e?(0,o.jsxs)(a.Stack,{gap:"$2",children:[(0,o.jsx)(a.Stack,{children:(0,o.jsx)(a.SizableText,{size:"$headingXl",children:"使用说明"})}),(0,o.jsx)(a.Stack,{children:(0,o.jsx)(FormattedText,{text:e})})]}):null,n?(0,o.jsxs)(a.Stack,{gap:"$2",children:[(0,o.jsx)(a.Stack,{children:(0,o.jsx)(a.SizableText,{size:"$headingXl",children:"使用建议"})}),(0,o.jsx)(FormattedText,{text:n})]}):null,t?.length>0?(0,o.jsxs)(a.Stack,{gap:"$2",children:[(0,o.jsx)(a.Stack,{children:(0,o.jsx)(a.SizableText,{size:"$headingXl",children:"注意事项"})}),(0,o.jsx)(FormattedText,{text:t})]}):null,(0,o.jsxs)(a.Stack,{gap:"$2",children:[(0,o.jsx)(a.Stack,{children:(0,o.jsx)(a.SizableText,{size:"$headingXl",children:"组件案例"})}),(0,o.jsx)(a.Stack,{children:h?.map((function(e,n){return(0,o.jsxs)(a.Stack,{gap:"$2",pb:"$8",mb:"$8",borderBottomWidth:"$px",borderBottomColor:"$borderSubdued",children:[(0,o.jsxs)(a.Stack,{flexDirection:"column",children:[(0,o.jsx)(a.SizableText,{size:"$headingLg",children:e.title}),e.description?(0,o.jsx)(a.Stack,{paddingTop:1,children:(0,o.jsxs)(a.SizableText,{children:[e.description,"。"]})}):null]}),(0,o.jsx)(a.Stack,{children:"function"==typeof e.element?(0,o.jsx)(e.element,{}):e.element})]},`elements-${n}`)}))}),(0,o.jsx)(a.Stack,{children:j?(0,o.jsx)(a.Stack,{gap:"$3",children:j}):null})]})]})})})}}}]);