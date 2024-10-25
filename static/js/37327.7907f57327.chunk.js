"use strict";(self.webpackChunkweb=self.webpackChunkweb||[]).push([[37327],{775892:(e,s,a)=>{a.d(s,{z:()=>CreateOrEditContent});var d=a(586330),r=a(514041),t=a(908867),o=a(490343),n=a(610421),i=a(370968),l=a(142097),m=a(334439),_=a(911998),u=a(831085),CreateOrEditContent=function({title:e,item:s,onSubmit:a,onRemove:c}){var f,k,v,b=(0,t.A)(),g=(0,o.useForm)({defaultValues:{id:s.id,networkId:s.networkId,name:s.name,address:{raw:s.address,resolved:""}},mode:"onChange",reValidateMode:"onChange"}),h=(0,r.useCallback)((function(){return c?(0,u.jsx)(o.IconButton,{icon:"DeleteOutline",variant:"tertiary",onPress:function(){return c(s)},testID:"address-form-remove"}):null}),[c,s]),p=g.watch("networkId"),I=g.watch("address.pending"),T=(0,r.useCallback)((f=(0,d.A)((function*(e){var s;yield a?.({id:e.id,name:e.name,networkId:e.networkId,address:null!=(s=e.address.resolved)?s:""})})),function(e){return f.apply(this,arguments)}),[a]),{result:x}=(0,_.yk)((0,d.A)((function*(){return(yield n.A.serviceNetwork.getAddressBookEnabledNetworks()).map((function(e){return e.id}))})),[],{initResult:[]});return(0,u.jsxs)(o.Page,{children:[(0,u.jsx)(o.Page.Header,{title:e,headerRight:h}),(0,u.jsx)(o.Page.Body,{p:"$4",children:(0,u.jsxs)(o.Form,{form:g,children:[(0,u.jsx)(o.Form.Field,{label:b.formatMessage({id:m.ETranslations.address_book_add_address_chain}),name:"networkId",rules:{required:!0},children:(0,u.jsx)(l.P,{networkIds:x})}),(0,u.jsx)(o.Form.Field,{label:b.formatMessage({id:m.ETranslations.address_book_add_address_name}),name:"name",rules:{required:{value:!0,message:b.formatMessage({id:m.ETranslations.address_book_add_address_name_empty_error})},maxLength:{value:24,message:b.formatMessage({id:m.ETranslations.address_book_add_address_name_length_erro},{num:24})},validate:(v=(0,d.A)((function*(e){var a=yield n.A.serviceAddressBook.findItem({name:e});if(a&&s.id!==a.id)return b.formatMessage({id:m.ETranslations.address_book_add_address_name_exists})})),function validate(e){return v.apply(this,arguments)})},testID:"address-form-name-field",children:(0,u.jsx)(o.Input,{placeholder:b.formatMessage({id:m.ETranslations.address_book_add_address_name_required}),testID:"address-form-name"})}),(0,u.jsx)(o.Form.Field,{label:b.formatMessage({id:m.ETranslations.address_book_add_address_address}),name:"address",rules:{validate:(k=(0,d.A)((function*(e){if(!e.pending){var a;if(!e.resolved)return null!=(a=e.validateError?.message)?a:b.formatMessage({id:m.ETranslations.address_book_add_address_address_invalid_error});var d=yield n.A.serviceAddressBook.findItem({address:e.resolved});if(d&&s.id!==d.id)return b.formatMessage({id:m.ETranslations.address_book_add_address_address_exists})}})),function validate(e){return k.apply(this,arguments)})},description:p.startsWith("evm--")?(0,u.jsxs)(o.XStack,{alignItems:"center",mt:"$1",children:[(0,u.jsx)(o.Icon,{size:"$4",name:"CheckRadioSolid"}),(0,u.jsx)(o.SizableText,{size:"$bodyMd",ml:"$1",children:b.formatMessage({id:m.ETranslations.address_book_add_address_add_to_evm_chains})})]}):null,testID:"address-form-address-field",children:(0,u.jsx)(i.N,{networkId:p,placeholder:b.formatMessage({id:m.ETranslations.address_book_add_address_address}),autoError:!1,testID:"address-form-address",enableNameResolve:!0,enableAddressContract:!0})})]})}),(0,u.jsx)(o.Page.Footer,{onConfirmText:b.formatMessage({id:m.ETranslations.address_book_add_address_button_save}),confirmButtonProps:{variant:"primary",loading:g.formState.isSubmitting,disabled:!g.formState.isValid||I,onPress:g.handleSubmit(T),testID:"address-form-save"}})]})}},737327:(e,s,a)=>{a.r(s),a.d(s,{default:()=>__WEBPACK_DEFAULT_EXPORT__});var d=a(586330),r=a(514041),t=a(654266),o=a(908867),n=a(490343),i=a(610421),l=a(498356),m=a(334439),_=a(775892),u=a(831085);const __WEBPACK_DEFAULT_EXPORT__=function(){var e,s,a=(0,o.A)(),c=(0,l.A)(),f=(0,t.lq)(),k=(0,r.useCallback)((e=(0,d.A)((function*(e){try{yield i.A.serviceAddressBook.updateItem(e),n.Toast.success({title:a.formatMessage({id:m.ETranslations.address_book_add_address_toast_save_success})}),c.pop()}catch(e){n.Toast.error({title:e.message})}})),function(s){return e.apply(this,arguments)}),[c,a]),v=(0,r.useCallback)((s=(0,d.A)((function*(e){var s;n.Dialog.show({title:a.formatMessage({id:m.ETranslations.address_book_edit_address_delete_contact_title}),icon:"DeleteOutline",description:a.formatMessage({id:m.ETranslations.address_book_edit_address_delete_contact_message}),tone:"destructive",showConfirmButton:!0,showCancelButton:!0,onConfirm:(s=(0,d.A)((function*(){if(e.id)try{yield i.A.serviceAddressBook.removeItem(e.id),n.Toast.success({title:a.formatMessage({id:m.ETranslations.address_book_add_address_toast_delete_success})}),c.pop()}catch(e){n.Toast.error({title:e.message})}})),function onConfirm(){return s.apply(this,arguments)}),confirmButtonProps:{testID:"address-remove-confirm"},cancelButtonProps:{testID:"address-remove-cancel"}})})),function(e){return s.apply(this,arguments)}),[c,a]);return(0,u.jsx)(_.z,{title:a.formatMessage({id:m.ETranslations.address_book_edit_address_title}),item:f.params,onSubmit:k,onRemove:v})}}}]);