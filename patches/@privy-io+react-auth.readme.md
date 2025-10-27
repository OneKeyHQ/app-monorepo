# origin check support file and extension


## Protocol check

```js
"https:"!==window.location.protocol
```

to 

```js
0>["https:","chrome-extension:","file:"].indexOf(window.location.protocol)
```

## Error message

```js
Embedded wallet is only available over HTTPS
``` 

to 

```js
Privy Embedded wallet is only available over HTTPS/CHROME-EXTENSION/FILE
```


## Domain whitelist

```js
["localhost","127.0.0.1"].indexOf(window.location.hostname)
```

to 

```js
["localhost","127.0.0.1","localhost.app.onekeytest.com"].indexOf(window.location.hostname)
```
