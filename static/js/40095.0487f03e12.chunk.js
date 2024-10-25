"use strict";(self.webpackChunkweb=self.webpackChunkweb||[]).push([[40095],{140095:(e,t,s)=>{s.r(t),s.d(t,{default:()=>pages_BackupDocs});var r=s(324586),a=s(908867),o=s(490343),i=s(726130),n=s(334439),c=s(117746),d=s(514041),l=s(578104),p=s(831085),RatioImage=function({sm:e,base:t}){var[s,r]=(0,d.useState)(0),a=(0,o.useMedia)(),i=(0,l.YQ)((function(e){r(e)}),100,{trailing:!0}),n=(0,d.useCallback)((function(e){i(e.nativeEvent.layout.width)}),[i]),c=(0,d.useMemo)((function(){return a.md?{source:e.source,height:Math.floor(s/e.ratio)}:{source:t.source,height:Math.floor(s/t.ratio)}}),[e,t,s,a]);return(0,p.jsx)(o.Stack,{onLayout:n,height:c.height,children:s?(0,p.jsx)(o.Image,{height:c.height,source:c.source}):null})};function ownKeys(e,t){var s=Object.keys(e);if(Object.getOwnPropertySymbols){var r=Object.getOwnPropertySymbols(e);t&&(r=r.filter((function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable}))),s.push.apply(s,r)}return s}function _objectSpread(e){for(var t=1;t<arguments.length;t++){var s=null!=arguments[t]?arguments[t]:{};t%2?ownKeys(Object(s),!0).forEach((function(t){(0,r.A)(e,t,s[t])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(s)):ownKeys(Object(s)).forEach((function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(s,t))}))}return e}var BackupStep=function({title:e,desc:t,image:s,index:r}){return(0,p.jsxs)(o.Stack,{position:"relative",children:[(0,p.jsx)(o.Stack,{borderRadius:12,overflow:"hidden",mb:"$5",children:(0,p.jsx)(RatioImage,_objectSpread({},s))}),(0,p.jsx)(o.Stack,{width:"$5",height:"$5",backgroundColor:"$bgInfo",position:"absolute",top:10,left:10,justifyContent:"center",alignItems:"center",display:"flex",borderRadius:5,children:(0,p.jsx)(o.SizableText,{size:"$bodySmMedium",color:"$textInfo",children:r})}),(0,p.jsx)(o.SizableText,{size:"$headingMd",children:e}),(0,p.jsx)(o.YStack,{mt:"$1",children:t.map((function(e,t){return(0,p.jsx)(o.SizableText,{size:"$bodyLg",color:"$textSubdued",children:e},t)}))})]})};const pages_BackupDocs=function(){var e=(0,a.A)();return(0,p.jsxs)(o.Page,{scrollEnabled:!0,children:[(0,p.jsx)(o.Page.Header,{title:e.formatMessage({id:n.ETranslations.settings_backup_with_onekey_keytag})}),(0,p.jsx)(o.Page.Body,{children:(0,p.jsxs)(o.YStack,{p:"$5",separator:(0,p.jsx)(o.Stack,{h:"$10"}),children:[(0,p.jsx)(BackupStep,{index:1,image:{sm:{ratio:353/224,source:s(235412)},base:{ratio:600/224,source:s(571715)}},title:e.formatMessage({id:n.ETranslations.settings_step1_get_bip39_dotmap}),desc:[(0,p.jsx)(o.SizableText,{size:"$bodyLg",color:"$textSubdued",children:e.formatMessage({id:n.ETranslations.settings_step1_get_bip39_dotmap_desc},{dotmap:(0,p.jsx)(o.SizableText,{size:"$bodyLg",color:"$textSubdued",textDecorationLine:"underline",onPress:function(){(0,c.Dr)(i.LO)},children:"BIP39-Dotmap"})})},"1")]}),(0,p.jsx)(BackupStep,{index:2,image:{sm:{ratio:353/224,source:s(652197)},base:{ratio:600/224,source:s(393126)}},title:e.formatMessage({id:n.ETranslations.settings_step2_match_recovery_phrase_dots}),desc:[e.formatMessage({id:n.ETranslations.settings_step2_match_recovery_phrase_dots_desc},{dotmap:(0,p.jsx)(o.SizableText,{size:"$bodyLg",color:"$textSubdued",textDecorationLine:"underline",onPress:function(){(0,c.Dr)(i.LO)},children:"BIP39-Dotmap"})})]}),(0,p.jsx)(BackupStep,{index:3,image:{sm:{ratio:353/224,source:s(84998)},base:{ratio:600/224,source:s(432593)}},title:e.formatMessage({id:n.ETranslations.settings_step3_align_and_punch}),desc:[e.formatMessage({id:n.ETranslations.settings_step3_align_and_punch_desc})]})]})})]})}},571715:(e,t,s)=>{e.exports=s.p+"static/media/keytag_doc_step1_base.1f2b71f01eb052472fb8.png"},235412:(e,t,s)=>{e.exports=s.p+"static/media/keytag_doc_step1_sm.2a59b3035083897eec67.png"},393126:(e,t,s)=>{e.exports=s.p+"static/media/keytag_doc_step2_base.66d09696e91665b7c1ce.png"},652197:(e,t,s)=>{e.exports=s.p+"static/media/keytag_doc_step2_sm.8f5fec66dba4d9889021.png"},432593:(e,t,s)=>{e.exports=s.p+"static/media/keytag_doc_step3_base.7029658b1c29f28ad022.png"},84998:(e,t,s)=>{e.exports=s.p+"static/media/keytag_doc_step3_sm.5f0b98c5ddbd09fa2490.png"}}]);