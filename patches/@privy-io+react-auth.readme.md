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
Embedded wallet is only available over HTTPS/CHROME-EXTENSION/FILE
```



