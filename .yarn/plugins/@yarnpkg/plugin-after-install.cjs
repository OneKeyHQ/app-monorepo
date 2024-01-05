/* eslint-disable */
//prettier-ignore
module.exports = {
name: "@yarnpkg/plugin-after-install",
factory: function (require) {
"use strict";var plugin=(()=>{var s=Object.defineProperty;var g=Object.getOwnPropertyDescriptor;var x=Object.getOwnPropertyNames;var C=Object.prototype.hasOwnProperty;var r=(t=>typeof require<"u"?require:typeof Proxy<"u"?new Proxy(t,{get:(o,e)=>(typeof require<"u"?require:o)[e]}):t)(function(t){if(typeof require<"u")return require.apply(this,arguments);throw new Error('Dynamic require of "'+t+'" is not supported')});var I=(t,o)=>{for(var e in o)s(t,e,{get:o[e],enumerable:!0})},h=(t,o,e,a)=>{if(o&&typeof o=="object"||typeof o=="function")for(let n of x(o))!C.call(t,n)&&n!==e&&s(t,n,{get:()=>o[n],enumerable:!(a=g(o,n))||a.enumerable});return t};var k=t=>h(s({},"__esModule",{value:!0}),t);var P={};I(P,{default:()=>y});var d=r("@yarnpkg/core");var f=r("@yarnpkg/core"),c={afterInstall:{description:"Hook that will always run after install",type:f.SettingsType.STRING,default:""}};var p=r("clipanion"),u=r("@yarnpkg/core");var m=r("@yarnpkg/shell"),l=async(t,o)=>{let e=t.get("afterInstall"),a=!!t.projectCwd?.endsWith(`dlx-${process.pid}`);return e&&!a?(o&&console.log("Running `afterInstall` hook..."),(0,m.execute)(e,[],{cwd:t.projectCwd||void 0})):0};var i=class extends p.Command{async execute(){let o=await u.Configuration.find(this.context.cwd,this.context.plugins);return l(o,!1)}};i.paths=[["after-install"]];var w={configuration:c,commands:[i],hooks:{afterAllInstalled:async(t,o)=>{if(o?.mode===d.InstallMode.UpdateLockfile)return;if(await l(t.configuration,!0))throw new Error("The `afterInstall` hook failed, see output above.")}}},y=w;return k(P);})();
return plugin;
}
};
