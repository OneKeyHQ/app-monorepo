"use strict";(self.webpackChunkweb=self.webpackChunkweb||[]).push([[98481],{998481:(e,n,t)=>{t.r(n),t.d(n,{default:()=>v});var r=t(514041);function DAppConnectExtensionFloatingTrigger(){return null}var i=t(901976),o=t(714191),c=t(325809),a=t(989840),u=(t(162616),t(579071)),s=t.n(u),f=t(259227),l=t(610421),g=t(153763),d=t(831085);function NotificationRegisterDaily(){var e=(0,g.E)(),[{locale:n,currencyInfo:t}]=(0,f.useSettingsPersistAtom)(),[{hideValue:i}]=(0,f.useSettingsValuePersistAtom)(),o=(0,r.useRef)(!0);return(0,r.useEffect)((function(){o.current||e&&l.A.serviceNotification.registerClientDaily()}),[e]),(0,r.useEffect)((function(){o.current?o.current=!1:(s()(n,t,i),l.A.serviceNotification.updateClientBasicAppInfo())}),[n,t,i]),(0,d.jsx)(d.Fragment,{})}var p=t(471230),b=t(155680);const v=(0,a.we)((function HomePageContainer(){var[e,n]=(0,r.useState)(!1);if((0,i.e)({name:"HomePageContainer"}),e)return null;var t=o.Zs.home;return(0,d.jsxs)(c.b8,{config:{sceneName:t,sceneUrl:""},enabledNum:[0],children:[(0,d.jsx)(b.U,{sceneName:t,onPressHide:function(){return n((function(e){return!e}))}},t),(0,d.jsx)(DAppConnectExtensionFloatingTrigger,{}),(0,d.jsx)(p.YG,{}),(0,d.jsx)(NotificationRegisterDaily,{}),null]})}))},471230:(e,n,t)=>{t.d(n,{YG:()=>O,U9:()=>i.U});t(490343),t(791088),t(392097);var r=t(498356);t(831085);var i=t(952954),o=t(324586),c=t(586330),a=t(514041),u=t(259227),s=t(318822),f=(t(334439),t(663522)),l=t(584186),g=t(610421),d=t(131397),p=t(621591);function ownKeys(e,n){var t=Object.keys(e);if(Object.getOwnPropertySymbols){var r=Object.getOwnPropertySymbols(e);n&&(r=r.filter((function(n){return Object.getOwnPropertyDescriptor(e,n).enumerable}))),t.push.apply(t,r)}return t}function _objectSpread(e){for(var n=1;n<arguments.length;n++){var t=null!=arguments[n]?arguments[n]:{};n%2?ownKeys(Object(t),!0).forEach((function(n){(0,o.A)(e,n,t[n])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(t)):ownKeys(Object(t)).forEach((function(n){Object.defineProperty(e,n,Object.getOwnPropertyDescriptor(t,n))}))}return e}var b=0,v=!1,y=!1;var O=(0,a.memo)((function OnboardingOnMountCmp(){var e=(0,d.t1)(),n=(0,r.A)(),t=(0,p.D)(),[i,o]=(0,u.useV4migrationPersistAtom)(),O=i?.downgradeWarningConfirmed;(0,a.useRef)(O).current=O;var m=(0,a.useCallback)((0,c.A)((function*(){(yield g.A.serviceV4Migration.checkShouldMigrateV4OnMount())&&(v||(v=!0,yield g.A.serviceV4Migration.migrateBaseSettings()))})),[]),A=(0,a.useCallback)((0,c.A)((function*({checkingV4Migration:n}={}){try{if(n)if(yield g.A.serviceV4Migration.checkShouldMigrateV4OnMount()){if(yield m(),yield l.A.wait(600),!y){y=!0,yield t.navigateToV4MigrationPage({isAutoStartOnMount:!0});var r=Date.now();r-b>3e3&&(b=r,o((function(e){return _objectSpread(_objectSpread({},e),{},{v4migrationAutoStartCount:(e.v4migrationAutoStartCount||0)+1})})))}return}}catch(e){}if(!(0,d.p1)()){var{isOnboardingDone:i}=yield g.A.serviceOnboarding.isOnboardingDone();i||f.Ay.isWebDappMode||e({isFullModal:!0})}})),[m,o,e,t]),j=(0,a.useCallback)((0,c.A)((function*(){yield A({checkingV4Migration:!0})})),[A,m,o]);return(0,a.useEffect)((function(){}),[]),(0,a.useEffect)((function(){}),[o]),(0,a.useEffect)((function(){}),[n]),(0,a.useEffect)((function(){}),[t]),(0,a.useEffect)((function(){j()}),[j]),(0,a.useEffect)((function(){var fn=function(){A({checkingV4Migration:!1})};return s.iL.on(s.Tu.WalletClear,fn),function(){s.iL.off(s.Tu.WalletClear,fn)}}),[A]),null}))}}]);