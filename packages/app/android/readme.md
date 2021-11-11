# 如何生成加密字符串

### 生成加密字符串

1. 前往加密仓库获取相关的密钥

```
# /scripts/encrypt -k [需要加密的密文] -s [密钥]
scripts/encrypt -k "hello world!" -s 2033e3c32846fada488eeb1dae74197b
```

2. 前往加密仓库，复制结果放到加密仓库 `keys.secret` , 并在 `lib-keys-secret\src\main\cpp\keys.c` 和 `lib-keys-secret\src\main\java\so\onekey\app\wallet\keys\KeysNativeProvider.kt` 添加相关方法。
