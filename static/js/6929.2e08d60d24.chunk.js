"use strict";(self.webpackChunkweb=self.webpackChunkweb||[]).push([[6929],{864612:(t,e,n)=>{n.d(e,{A:()=>l});var i=n(514041),r=n(908867),s=n(490343),o=n(726130),c=n(334439),a=n(831085);const l=function NotificationsHelpCenterInstruction(){var t=(0,r.A)(),e=(0,i.useCallback)((function(t){return(0,a.jsx)(s.Anchor,{cursor:"default",size:"$bodyMd",color:"$textInteractive",href:o.DS,target:"_blank",hoverStyle:{color:"$textInteractiveHover"},children:t})}),[]);return(0,a.jsx)(s.SizableText,{maxWidth:"$96",size:"$bodyMd",color:"$textSubdued",children:t.formatMessage({id:c.ETranslations.notifications_test_action_desc},{tag:e})})}},215920:(t,e,n)=>{n.d(e,{A:()=>u});var i=n(324586),r=n(186207),s=n(908867),o=n(490343),c=n(610421),a=n(334439),l=n(831085);function ownKeys(t,e){var n=Object.keys(t);if(Object.getOwnPropertySymbols){var i=Object.getOwnPropertySymbols(t);e&&(i=i.filter((function(e){return Object.getOwnPropertyDescriptor(t,e).enumerable}))),n.push.apply(n,i)}return n}function _objectSpread(t){for(var e=1;e<arguments.length;e++){var n=null!=arguments[e]?arguments[e]:{};e%2?ownKeys(Object(n),!0).forEach((function(e){(0,i.A)(t,e,n[e])})):Object.getOwnPropertyDescriptors?Object.defineProperties(t,Object.getOwnPropertyDescriptors(n)):ownKeys(Object(n)).forEach((function(e){Object.defineProperty(t,e,Object.getOwnPropertyDescriptor(n,e))}))}return t}const u=function NotificationsTestButton(t){var e=Object.assign({},((0,r.A)(t),t)),n=(0,s.A)();return(0,l.jsx)(o.Button,_objectSpread(_objectSpread({onPress:function(){c.A.serviceNotification.showNotification({title:n.formatMessage({id:a.ETranslations.notifications_test_message_title}),description:n.formatMessage({id:a.ETranslations.notifications_test_message_desc})})}},e),{},{children:n.formatMessage({id:a.ETranslations.global_test})}))}},906929:(t,e,n)=>{n.r(e),n.d(e,{default:()=>NotificationsSettings});var i=n(324586),r=n(586330),s=n(579071),o=n.n(s),c=n(514041),a=n(908867),l=n(578104),u=n(490343),f=n(610421),d=n(791088),b=(n(276360),n(831085)),p=n(498356),g=n(911998),j=n(259227),y=n(334439),h=(n(663522),n(392097)),x=(n(251039),n(864612)),_=n(215920);function ownKeys(t,e){var n=Object.keys(t);if(Object.getOwnPropertySymbols){var i=Object.getOwnPropertySymbols(t);e&&(i=i.filter((function(e){return Object.getOwnPropertyDescriptor(t,e).enumerable}))),n.push.apply(n,i)}return n}function _objectSpread(t){for(var e=1;e<arguments.length;e++){var n=null!=arguments[e]?arguments[e]:{};e%2?ownKeys(Object(n),!0).forEach((function(e){(0,i.A)(t,e,n[e])})):Object.getOwnPropertyDescriptors?Object.defineProperties(t,Object.getOwnPropertyDescriptors(n)):ownKeys(Object(n)).forEach((function(e){Object.defineProperty(t,e,Object.getOwnPropertyDescriptor(n,e))}))}return t}function NotificationsSettings(){var t,e,n,i=(0,a.A)(),[s,v]=(0,c.useState)(),[O]=(0,j.useDevSettingsPersistAtom)(),[m]=(0,j.useSettingsPersistAtom)(),P=(0,p.A)(),S=(0,c.useRef)(),{result:w}=(0,g.yk)((function(){return o()(O.enabled),f.A.serviceNotification.getPushClient()}),[O.enabled]),A=(0,c.useCallback)((t=(0,r.A)((function*(t){var e=t||(yield f.A.serviceNotification.fetchNotificationSettings());v(e),S.current=e})),function(e){return t.apply(this,arguments)}),[]),E=(0,c.useRef)(!1),T=(0,l.YQ)((e=(0,r.A)((function*(t){if(!E.current){var e;E.current=!0;try{e=yield f.A.serviceNotification.updateNotificationSettings(_objectSpread(_objectSpread({},s),t)),yield A(e)}catch(t){throw S.current&&v(S.current),t}finally{E.current=!1}}})),function(t){return e.apply(this,arguments)}),300,{leading:!1,trailing:!0}),M=(0,c.useCallback)((n=(0,r.A)((function*(t){v((function(e){var n=_objectSpread(_objectSpread({},e),t);return T(n),n}))})),function(t){return n.apply(this,arguments)}),[T]);return(0,c.useEffect)((function(){A()}),[A]),(0,b.jsxs)(u.Page,{scrollEnabled:!0,skipLoading:!0,children:[(0,b.jsx)(u.Page.Header,{title:i.formatMessage({id:y.ETranslations.global_notifications})}),(0,b.jsxs)(u.Page.Body,{children:[s?(0,b.jsxs)(b.Fragment,{children:[(0,b.jsxs)(d.c,{children:[(0,b.jsx)(d.c.Text,{flex:1,primary:i.formatMessage({id:y.ETranslations.notifications_notifications_switch_label}),primaryTextProps:{size:"$headingMd"}}),(0,b.jsx)(u.Switch,{value:!!s?.pushEnabled,onChange:function(t){M({pushEnabled:t})}})]}),s?.pushEnabled?(0,b.jsxs)(b.Fragment,{children:[(0,b.jsx)(u.Divider,{m:"$5"}),(0,b.jsxs)(d.c,{children:[(0,b.jsx)(d.c.Text,{flex:1,primary:i.formatMessage({id:y.ETranslations.notifications_notifications_account_activity_label}),secondary:i.formatMessage({id:y.ETranslations.notifications_notifications_account_activity_desc}),secondaryTextProps:{maxWidth:"$96"}}),(0,b.jsx)(u.Switch,{value:!!s?.accountActivityPushEnabled,onChange:function(t){M({accountActivityPushEnabled:t})}})]}),s?.accountActivityPushEnabled?(0,b.jsx)(d.c,{title:"Manage",subtitle:"Choose the account for notifications.",drillIn:!0,onPress:function(){P.push(h.Pj.SettingManageAccountActivity)}}):null,(0,b.jsx)(u.Divider,{m:"$5"}),(0,b.jsxs)(d.c,{children:[(0,b.jsx)(d.c.Text,{flex:1,gap:"$2",primary:i.formatMessage({id:y.ETranslations.notifications_settings_helper_title}),secondary:(0,b.jsxs)(b.Fragment,{children:[(0,b.jsx)(u.SizableText,{maxWidth:"$96",size:"$bodyMd",color:"$textSubdued",children:i.formatMessage({id:y.ETranslations.notifications_settings_helper_desc})}),(0,b.jsx)(x.A,{})]})}),(0,b.jsx)(_.A,{})]})]}):null]}):(0,b.jsx)(u.Stack,{pt:240,justifyContent:"center",alignItems:"center",children:(0,b.jsx)(u.Spinner,{size:"large"})}),null]})]})}}}]);