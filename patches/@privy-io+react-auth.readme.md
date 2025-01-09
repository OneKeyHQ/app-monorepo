# origin check support file and extension

```js
if( "undefined"!=typeof window && 0>["localhost","127.0.0.1"].indexOf(window.location.hostname) && 0>["https:","chrome-extension:","file:"].indexOf(window.location.protocol) )throw new Fe("Embedded wallet is only available over HTTPS/CHROME-EXTENSION/FILE");
```
