"use strict";(self.webpackChunkweb=self.webpackChunkweb||[]).push([[88832],{588832:(e,n,l)=>{l.r(n),l.d(n,{default:()=>__WEBPACK_DEFAULT_EXPORT__});var t=l(514041),a=l(490343),i=l(654004),r=l(831085),s=[{label:"Banana0",value:"Banana"},{label:"Apple1",value:"Apple"},{label:"Pear2",value:"Pear"},{label:"Blackberry3",value:"Blackberry"},{label:"Peach4",value:"Peach"},{label:"Apricot5",value:"Apricot"},{label:"Melon6",value:"Melon"},{label:"Honeydew7",value:"Honeydew"},{label:"Starfruit8",value:"Starfruit"},{label:"Blueberry9",value:"Blueberry"}],SelectDefaultItem=function(){var[e,n]=(0,t.useState)(s[1].value);return(0,r.jsx)(a.Select,{items:s,value:e,onChange:n,title:"Demo Title",onOpenChange:function(){}})},SelectLongListItem=function(){var[e,n]=(0,t.useState)("Apple");return(0,r.jsx)(a.Select,{items:new Array(1e3).fill(void 0).map((function(e,n){return{label:String(n),value:String(n)}})),sheetProps:{snapPointsMode:"percent",snapPoints:[80]},value:e,onChange:n,title:"Demo Title",onOpenChange:function(){}})},SelectDisabledItem=function(){var[e,n]=(0,t.useState)("Apple");return(0,r.jsx)(a.Select,{disabled:!0,items:s,value:e,onChange:n,title:"Demo Title",onOpenChange:function(){}})},SelectCustomItem=function(){var[e,n]=(0,t.useState)("");return(0,r.jsx)(a.Select,{placeholder:"please select one",renderTrigger:function({value:e,label:n,placeholder:l}){return(0,r.jsx)(a.SizableText,{children:e?`label: ${n||""}, value: ${e}`:l})},items:s,value:e,onChange:n,title:"Demo Title",onOpenChange:function(){}})},c=[{title:"emoji Section",data:[{label:"Apple🍎",value:"Apple",leading:(0,r.jsx)(a.SizableText,{size:"$bodyMdMedium",children:"😀"})},{label:"Pear🌰",value:"Pear",leading:(0,r.jsx)(a.SizableText,{size:"$bodyMdMedium",children:"🚅"})},{label:"Blackberry🫐",value:"Blackberry",leading:(0,r.jsx)(a.SizableText,{size:"$bodyMdMedium",children:"🚆"})},{label:"Peach🍑",value:"Peach",leading:(0,r.jsx)(a.Icon,{name:"AccessibilityEyeOutline",size:"$5"})}]},{title:"plain Section",data:[{label:"Apricot1",value:"Apricot1"},{label:"Melon2",value:"Melon2"},{label:"Honeydew3",value:"Honeydew3"},{label:"Starfruit4",value:"Starfruit4"},{label:"Blueberry5",value:"Blueberry5"}]}],SelectSectionsItemDemo=function(){var[e,n]=(0,t.useState)("Apple");return(0,r.jsx)(a.Select,{sections:c,value:e,onChange:n,title:"Demo Title",onOpenChange:function(){}})},SelectDefaultValue=function(){var[e,n]=(0,t.useState)("Apple");return(0,r.jsx)(a.Select,{sections:c,value:e,onChange:n,title:"Demo Title",onOpenChange:function(){}})};const __WEBPACK_DEFAULT_EXPORT__=function(){return(0,r.jsx)(i.P,{description:"****",suggestions:["****"],boundaryConditions:["****"],elements:[{title:"默认状态",element:(0,r.jsx)(a.Stack,{gap:"$1",children:(0,r.jsx)(SelectDefaultItem,{})})},{title:"labelInValue",element:function(){var[e,n]=(0,t.useState)(s[3]),[l,i]=(0,t.useState)(c[1].data[2]);return(0,r.jsxs)(a.Stack,{gap:"$1",children:[(0,r.jsx)(a.Select,{labelInValue:!0,items:s,value:e,onChange:n,title:"Label In Value",onOpenChange:function(){}}),(0,r.jsx)(a.Select,{labelInValue:!0,sections:c,value:l,onChange:i,title:"Label In Value",onOpenChange:function(){}})]})}},{title:"Long List",element:(0,r.jsx)(a.Stack,{gap:"$1",children:(0,r.jsx)(SelectLongListItem,{})})},{title:"Disabled",element:(0,r.jsx)(a.Stack,{gap:"$1",children:(0,r.jsx)(SelectDisabledItem,{})})},{title:"Custom Trigger",element:(0,r.jsx)(a.Stack,{gap:"$1",children:(0,r.jsx)(SelectCustomItem,{})})},{title:"Select Sections",element:(0,r.jsx)(a.Stack,{gap:"$1",children:(0,r.jsx)(SelectSectionsItemDemo,{})})},{title:"default value with Label",element:(0,r.jsx)(a.Stack,{gap:"$1",children:(0,r.jsx)(SelectDefaultValue,{})})}]})}},654004:(e,n,l)=>{l.d(n,{P:()=>Layout});var t=l(586330),a=l(654266),i=l(490343),r=l(989375),s=l(610421),c=l(498356),o=l(392097),u=l(831085),FormattedText=function({text:e}){return"string"==typeof e?(0,u.jsx)(i.Stack,{children:(0,u.jsxs)(i.SizableText,{children:[e,"。 "]})}):Array.isArray(e)&&0===e.length?null:(0,u.jsx)(i.Stack,{children:(0,u.jsx)(i.Stack,{gap:"$1",children:e.map((function(n,l){return(0,u.jsx)(i.Stack,{children:(0,u.jsxs)(i.SizableText,{children:[l+1,". ",n,l===e.length-1?"。":"；"]})},l.toString())}))})})};function Layout({description:e="",suggestions:n=[],boundaryConditions:l=[],elements:d=[],scrollEnabled:h=!0,contentInsetAdjustmentBehavior:x="never",skipLoading:p=!1,children:S}){var g=(0,r.U6)(),b=(0,c.A)();return(0,u.jsx)(i.Page,{skipLoading:p,children:(0,u.jsx)(i.ScrollView,{maxWidth:"100%",scrollEnabled:h,flex:1,marginBottom:g,paddingHorizontal:"$5",contentContainerStyle:{paddingTop:20,paddingBottom:280},keyboardDismissMode:"on-drag",contentInsetAdjustmentBehavior:x,children:(0,u.jsxs)(i.Stack,{marginHorizontal:"auto",maxWidth:"100%",width:576,gap:"$6",children:[(0,u.jsxs)(i.XStack,{children:[(0,u.jsx)(i.IconButton,{icon:"HomeLineOutline",onPress:function(){b.dispatch(a.y9.replace(o.WP.Main,{screen:o.V4.Developer,params:{screen:o.f$.TabDeveloper}}))}}),(0,u.jsx)(i.Button,{ml:"$4",onPress:(0,t.A)((function*(){yield s.A.serviceSetting.setTheme("light")})),children:"Light Theme"}),(0,u.jsx)(i.Button,{ml:"$4",variant:"primary",onPress:(0,t.A)((function*(){yield s.A.serviceSetting.setTheme("dark")})),children:"Dark Theme"})]}),e?(0,u.jsxs)(i.Stack,{gap:"$2",children:[(0,u.jsx)(i.Stack,{children:(0,u.jsx)(i.SizableText,{size:"$headingXl",children:"使用说明"})}),(0,u.jsx)(i.Stack,{children:(0,u.jsx)(FormattedText,{text:e})})]}):null,n?(0,u.jsxs)(i.Stack,{gap:"$2",children:[(0,u.jsx)(i.Stack,{children:(0,u.jsx)(i.SizableText,{size:"$headingXl",children:"使用建议"})}),(0,u.jsx)(FormattedText,{text:n})]}):null,l?.length>0?(0,u.jsxs)(i.Stack,{gap:"$2",children:[(0,u.jsx)(i.Stack,{children:(0,u.jsx)(i.SizableText,{size:"$headingXl",children:"注意事项"})}),(0,u.jsx)(FormattedText,{text:l})]}):null,(0,u.jsxs)(i.Stack,{gap:"$2",children:[(0,u.jsx)(i.Stack,{children:(0,u.jsx)(i.SizableText,{size:"$headingXl",children:"组件案例"})}),(0,u.jsx)(i.Stack,{children:d?.map((function(e,n){return(0,u.jsxs)(i.Stack,{gap:"$2",pb:"$8",mb:"$8",borderBottomWidth:"$px",borderBottomColor:"$borderSubdued",children:[(0,u.jsxs)(i.Stack,{flexDirection:"column",children:[(0,u.jsx)(i.SizableText,{size:"$headingLg",children:e.title}),e.description?(0,u.jsx)(i.Stack,{paddingTop:1,children:(0,u.jsxs)(i.SizableText,{children:[e.description,"。"]})}):null]}),(0,u.jsx)(i.Stack,{children:"function"==typeof e.element?(0,u.jsx)(e.element,{}):e.element})]},`elements-${n}`)}))}),(0,u.jsx)(i.Stack,{children:S?(0,u.jsx)(i.Stack,{gap:"$3",children:S}):null})]})]})})})}}}]);