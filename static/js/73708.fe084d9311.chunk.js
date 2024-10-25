"use strict";(self.webpackChunkweb=self.webpackChunkweb||[]).push([[73708],{593827:(e,t,a)=>{a.d(t,{L:()=>WalletAvatar});var n=a(503668),s=a.n(n),o=a(490343),r=a(491180),i=a(258988),l=a(831085);function WalletAvatarBase({size:e,img:t,wallet:a}){var n,s,c=t||a?.avatarInfo?.img;return c?r.A.isHwHiddenWallet({wallet:a})?(0,l.jsx)(o.Icon,{size:"$10",name:"LockSolid",color:"$iconSubdued"}):(0,l.jsxs)(o.Image,{size:e,children:[(0,l.jsx)(o.Image.Source,{source:null!=(n=i.UO[c])?n:i.UO.bear}),(0,l.jsx)(o.Image.Fallback,{delayMs:300,justifyContent:"center",alignItems:"center",children:(0,l.jsx)(o.SizableText,{children:null!=(s=a?.avatarInfo?.emoji)?s:""})})]}):null}function WalletAvatar({size:e="$10",status:t,badge:a,img:n,wallet:r}){return(0,l.jsxs)(o.Stack,{w:e,h:e,justifyContent:"center",alignItems:"center",children:[(0,l.jsx)(WalletAvatarBase,{size:e,img:n,wallet:r}),"connected"===t?(0,l.jsx)(o.Stack,{position:"absolute",bottom:-2,right:-2,bg:"$bgSidebar",p:"$0.5",borderRadius:"$full",zIndex:"$1",children:(0,l.jsx)(o.Stack,{borderRadius:"$full",w:"$2.5",h:"$2.5",bg:"$bgSuccessStrong"})}):null,s()(a)?null:(0,l.jsx)(o.Stack,{position:"absolute",h:"$4",px:"$0.5",justifyContent:"center",bottom:-2,right:-1,bg:"$bgSubdued",borderRadius:"$full",zIndex:"$1",children:(0,l.jsx)(o.SizableText,{size:"$bodySm",textAlign:"center",children:a})})]})}},903469:(e,t,a)=>{a.d(t,{A:()=>BackupListLoading});var n=a(490343),s=a(831085);function BackupListLoading(){return(0,s.jsxs)(n.Stack,{flex:1,px:"$5",gap:"$2",pt:"$5",children:[(0,s.jsx)(n.Skeleton,{h:"$6",w:"70%"}),(0,s.jsx)(n.Skeleton,{h:"$6",w:"100%"}),(0,s.jsx)(n.Skeleton,{h:"$6",w:"70%"}),(0,s.jsx)(n.Skeleton,{h:"$6",w:"100%"})]})}},573708:(e,t,a)=>{a.r(t),a.d(t,{default:()=>Detail});var n=a(324586),s=a(586330),o=a(514041),r=a(654266),i=a(908867),l=a(302722),c=a.n(l),u=a(490343),d=a(896666),g=a(610421),f=a(791088),m=a(536612),b=a(593827),p=a(498356),_=a(911998),k=a(847164),v=a(334439),h=a(948675),y=a(663522),w=a(392097),j=a(567807),T=a(903469),O=a(831085);function DeleteBackupDialogFooter({filename:e,callback:t}){var a=(0,i.A)(),[n,r]=(0,o.useState)(!1);return(0,O.jsx)(u.Dialog.Footer,{confirmButtonProps:{loading:n},tone:"destructive",onConfirmText:a.formatMessage({id:v.ETranslations.global_delete}),onConfirm:(0,s.A)((function*(){try{r(!0),yield g.A.serviceCloudBackup.removeBackup(e),t?.(),u.Toast.message({title:a.formatMessage({id:v.ETranslations.backup_backup_deleted})})}finally{r(!1)}}))})}var x=a(882115);function RestorePasswordVerify(){var e=(0,i.A)(),[t,a]=(0,o.useState)(!0);return(0,O.jsx)(u.Dialog.Form,{formProps:{values:{password:""}},children:(0,O.jsx)(u.Dialog.FormField,{name:"password",rules:{required:{value:!0,message:e.formatMessage({id:v.ETranslations.auth_enter_your_password})},onChange:function(){}},children:(0,O.jsx)(u.Input,{autoFocus:!0,size:"large",placeholder:e.formatMessage({id:v.ETranslations.auth_enter_your_password}),flex:1,keyboardType:(0,x.V)(!t),secureTextEntry:t,addOns:[{iconName:t?"EyeOffOutline":"EyeOutline",onPress:function(){a(!t)},testID:"password-eye-"+(t?"off":"on")}]})})})}function ownKeys(e,t){var a=Object.keys(e);if(Object.getOwnPropertySymbols){var n=Object.getOwnPropertySymbols(e);t&&(n=n.filter((function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable}))),a.push.apply(a,n)}return a}function _objectSpread(e){for(var t=1;t<arguments.length;t++){var a=null!=arguments[t]?arguments[t]:{};t%2?ownKeys(Object(a),!0).forEach((function(t){(0,n.A)(e,t,a[t])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(a)):ownKeys(Object(a)).forEach((function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(a,t))}))}return e}function Detail(){var e,t,a=(0,i.A)(),n=function useRestorePasswordVerifyDialog(){var e=(0,i.A)(),t=(0,o.useCallback)((function(){return new Promise((function(t,a){return u.Dialog.confirm({icon:"InfoCircleOutline",title:e.formatMessage({id:v.ETranslations.backup_import_data}),description:e.formatMessage({id:v.ETranslations.backup_verify_app_password_to_import_data}),renderContent:(0,O.jsx)(RestorePasswordVerify,{}),onConfirmText:e.formatMessage({id:v.ETranslations.global_import}),onConfirm:function(e){var a,n=e.getForm()?.getValues(),s=null!=(a=n?.password)?a:"";s.length<=0||t(s)},onClose:function(){a(e.formatMessage({id:v.ETranslations.global_cancel}))}})}))}),[e]);return(0,o.useMemo)((function(){return{show:t}}),[t])}(),l=function useDeleteBackupDialog(){var e=(0,i.A)(),t=(0,o.useCallback)((function(t){return new Promise((function(a){u.Dialog.show({title:e.formatMessage({id:v.ETranslations.backup_delete_this_backup}),icon:"DeleteOutline",description:e.formatMessage({id:y.Ay.isNativeAndroid?v.ETranslations.backup_file_permanently_deleted_android:v.ETranslations.backup_file_permanently_deleted}),tone:"destructive",renderContent:(0,O.jsx)(DeleteBackupDialogFooter,{filename:t,callback:a})})}))}),[e]);return(0,o.useMemo)((function(){return{show:t}}),[t])}(),x=(0,p.A)(),E=(0,r.lq)(),{item:{filename:M,backupTime:S}}=E.params,D=(0,j.Yq)(new Date(S)),[A,$]=(0,o.useState)(0),[P,C]=(0,o.useState)(!1),L=(0,m.SX)(),I=(0,o.useCallback)((function(e){var t,n,s;return[Object.values(e.HDWallets).length>0&&{title:a.formatMessage({id:v.ETranslations.global_app_wallet}),data:Object.values(e.HDWallets).map((function(e){return{title:e.name,detail:a.formatMessage({id:v.ETranslations.global_number_accounts},{number:e.indexedAccountUUIDs.length}),walletAvatar:e.avatar,infoList:[a.formatMessage({id:v.ETranslations.global_recovery_phrase}),a.formatMessage({id:v.ETranslations.global_wallet_avatar}),a.formatMessage({id:v.ETranslations.global_names_of_wallets_and_accounts})],footerDescription:a.formatMessage({id:v.ETranslations.backup_only_accounts_with_addresses_will_be_backed_up})}}))},Object.values(e.importedAccounts).length+Object.values(e.watchingAccounts).length>0&&{title:a.formatMessage({id:v.ETranslations.global_other_wallet}),data:[Object.values(e.importedAccounts).length>0&&{title:a.formatMessage({id:v.ETranslations.global_private_key}),detail:a.formatMessage({id:v.ETranslations.global_number_accounts},{number:Object.keys(e.importedAccounts).length}),icon:"PasswordOutline",infoList:[a.formatMessage({id:v.ETranslations.global_private_key}),a.formatMessage({id:v.ETranslations.global_account_name})]},Object.values(e.watchingAccounts).length>0&&{title:a.formatMessage({id:v.ETranslations.global_watchlist}),detail:a.formatMessage({id:v.ETranslations.global_number_accounts},{number:Object.keys(e.watchingAccounts).length}),icon:"EyeOutline",infoList:[a.formatMessage({id:v.ETranslations.global_address}),a.formatMessage({id:v.ETranslations.global_account_name})]}].filter((function(e){return e}))},Object.keys(e.contacts).length>0&&{title:a.formatMessage({id:v.ETranslations.backup_address_book_labels}),data:[Object.keys(e.contacts).length>0&&{title:a.formatMessage({id:v.ETranslations.settings_address_book}),detail:a.formatMessage({id:v.ETranslations.global_number_items},{number:Object.keys(e.contacts).length}),icon:"BookOpenOutline",infoList:[a.formatMessage({id:v.ETranslations.global_address}),a.formatMessage({id:v.ETranslations.global_name}),a.formatMessage({id:v.ETranslations.global_network_type})]}].filter((function(e){return e}))},(null!=(t=e?.discoverBookmarks?.length)?t:0)>0&&{title:a.formatMessage({id:v.ETranslations.global_browser}),data:[(null!=(n=e?.discoverBookmarks?.length)?n:0)>0&&{title:a.formatMessage({id:v.ETranslations.browser_bookmark}),detail:a.formatMessage({id:v.ETranslations.global_number_items},{number:null!=(s=e?.discoverBookmarks?.length)?s:0}),icon:"BookmarkOutline",infoList:[a.formatMessage({id:v.ETranslations.global_url}),a.formatMessage({id:v.ETranslations.global_name})]}].filter((function(e){return e}))}].filter((function(e){return e}))}),[a]),B=(0,_.yk)((0,s.A)((function*(){var e=yield g.A.serviceCloudBackup.getBackupDiffListWithFilename(M),t=I(e.alreadyOnDevice),a=I(e.notOnDevice);return _objectSpread(_objectSpread({},e),{},{alreadyOnDeviceSectionList:t,notOnDeviceSectionList:a})})),[M,I]).result,z=(0,o.useMemo)((function(){if(!B)return[];var e=0===A?B.notOnDeviceSectionList:B.alreadyOnDeviceSectionList;return null!=e?e:[]}),[A,B]),R=(0,o.useCallback)((0,s.A)((function*(){yield l.show(M),x.pop()})),[l,M,x]),W=(0,o.useCallback)((function(){P||u.ActionList.show({title:D,items:[{label:a.formatMessage({id:v.ETranslations.global_delete}),icon:"DeleteOutline",destructive:!0,onPress:function(){R()}}]})}),[P,D,a,R]),F=(0,o.useCallback)((function(){return(0,O.jsx)(d.v$,{icon:"DotVerOutline",onPress:W})}),[W]),N=(0,o.useCallback)((t=(0,s.A)((function*(e){if(B){var{password:t}=yield g.A.servicePassword.promptPasswordVerify();return g.A.serviceCloudBackup.restoreFromPrivateBackup({privateString:B.backupData.privateData,notOnDevice:B.notOnDevice,localPassword:t,remotePassword:null!=e?e:t})}})),function(e){return t.apply(this,arguments)}),[B]),V=(0,o.useCallback)((0,s.A)((function*(){var e;if(c().gt(null!=(e=B?.backupData.appVersion)?e:"",null!="5.3.0"?"5.3.0":"1.0.0"))u.Dialog.show({icon:"InfoCircleOutline",title:a.formatMessage({id:v.ETranslations.backup_upgrade_required}),description:a.formatMessage({id:v.ETranslations.backup_please_upgrade_app_to_import_data}),onConfirmText:a.formatMessage({id:v.ETranslations.global_upgrade}),onConfirm:function(){L.toUpdatePreviewPage()}});else{C(!0);try{var{isOnboardingDone:t}=yield g.A.serviceOnboarding.isOnboardingDone(),s=yield N();if(s===k.d.WRONG_PASSWORD){var o=yield n.show();s=yield N(yield g.A.servicePassword.encodeSensitiveText({text:o}))}s===k.d.WRONG_PASSWORD?u.Toast.error({title:a.formatMessage({id:v.ETranslations.auth_error_password_incorrect})}):s===k.d.UNKNOWN_ERROR?u.Toast.error({title:s}):(u.Toast.success({title:a.formatMessage({id:v.ETranslations.backup_backup_imported})}),t?x.pop():x.navigate(w.WP.Main))}catch(e){var r;u.Toast.error({title:`${null!=(r=e?.message)?r:e}`})}finally{C(!1)}h.U.account.wallet.importWallet({importMethod:"cloud"})}})),[a,n,B,x,L,N]);return(0,O.jsxs)(u.Page,{children:[(0,O.jsx)(u.Page.Header,{title:D,headerRight:F}),(0,O.jsxs)(u.Page.Body,{children:[(0,O.jsx)(u.Stack,{m:"$5",children:(0,O.jsx)(u.SegmentControl,{fullWidth:!0,value:A,onChange:function(e){$(e)},options:[{label:a.formatMessage({id:v.ETranslations.backup_off_device},{number:null!=(e=B?.diffCount)?e:0}),value:0},{label:a.formatMessage({id:v.ETranslations.backup_on_device}),value:1}]})}),B?(0,O.jsx)(u.SectionList,{sections:z,renderItem:function({item:e}){return(0,O.jsx)(f.c,{title:e.title,renderIcon:e.walletAvatar?(0,O.jsx)(b.L,{wallet:{avatarInfo:e.walletAvatar}}):(0,O.jsx)(u.Stack,{bg:"$bgStrong",p:"$2",borderRadius:"$3",children:(0,O.jsx)(u.Icon,{name:e.icon,size:"$6",color:"$icon"})}),children:(0,O.jsxs)(u.XStack,{gap:"$1",onPress:function(){u.ActionList.show({title:a.formatMessage({id:v.ETranslations.backup_encrypted_backup_contents}),items:e.infoList.map((function(e){return{label:`  •${y.Ay.isNativeAndroid?"\t\t":"\t"}${e}`}})),renderItems:e?.footerDescription?function(){return(0,O.jsx)(u.SizableText,{mx:"$3",my:"$3",size:"$bodyMd",color:"$textSubdued",children:e?.footerDescription})}:void 0})},children:[(0,O.jsx)(f.c.Text,{secondary:e.detail,align:"right"}),(0,O.jsx)(u.Icon,{name:"InfoCircleOutline",color:"$iconSubdued",size:"small",bg:"transparent"})]})})},estimatedItemSize:"$16",ListEmptyComponent:(0,O.jsx)(u.Empty,{icon:"SearchOutline",title:a.formatMessage({id:v.ETranslations.backup_no_data}),description:a.formatMessage({id:v.ETranslations.backup_data_already_present})}),renderSectionHeader:function({section:e}){return(0,O.jsx)(u.SectionList.SectionHeader,{title:e.title})}}):(0,O.jsx)(T.A,{}),(0,O.jsx)(u.Button,{m:"$5",borderRadius:"$3",py:"$3",variant:"primary",loading:P,disabled:!B||B.notOnDeviceSectionList.length<=0,onPress:V,children:a.formatMessage({id:v.ETranslations.global_import})})]})]})}}}]);