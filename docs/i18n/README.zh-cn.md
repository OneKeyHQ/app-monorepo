
## 🌍 环境配置

1. 安装 [node.js LTS 版本（>= 16）](https://nodejs.org/en/)
2. 安装 [yarn 包管理工具](https://yarnpkg.com/) 1.18.0 版本。（安装完成最新版本的 yarn 之后，根目录执行 `yarn policies set-version 1.18.0`）
3. 安装 [git lfs](https://git-lfs.github.com/)（部分二进制文件在拉取和更新时需要）
4. 启动 iOS 项目需确保本地 XCode 版本大于等于 13.3
5. 启动 Android 项目需确保本地 JDK 版本大于等于 11

通过 git 命令行工具拉取最新的代码之后，通过 `yarn` 命令在根目录安装项目依赖

安装所有 JS 依赖及子模块依赖

```
yarn
```

## 🛠 开发

在根目录执行以下命令，从而开发不同的业务代码

- `yarn web`: 开发网页模式，会启动静态服务器在本地 3000 端口
- `yarn ios`: 通过 USB 连接 iphone 设备进行开发调试
- `yarn android`: 调试安卓
- `yarn desktop`: 开发桌面端模式
- `yarn ext`: 开发浏览器插件

### Android 项目配置

#### 第一种方式：适用于社区开发人员

在 `apps/android/lib-keys-secret/src/main/cpp/keys.c` 中配置相关 key，也可以使用默认选项。可能一些 API 会有限制。

#### 第二种方式：适用于官方开发人员

1. 前往加密仓库获取 `debug.keystore` 文件，放入 `apps/android/keystores` 目录中，没有该目录请自行创建。
2. 前往加密仓库获取 `keys.secret` 文件，放入 `apps/android` 目录中。

## 🗂 多仓库目录结构

仓库使用 monorepo 模式进行组织，在保证不同端的代码集中且互相不影响的大前提下，又尽可能的在打包和编译过程中让代码复用

- `packages/components` 存放 UI 组件
- `packages/kit` 存放可复用页面级别 UI 内容
- `apps` APP 代码
- `apps/desktop` 桌面端 electron 代码
- `apps/web` 网页端代码
- `apps/ext` 插件端代码

## 🧲 安装依赖

`packages/` 目录下的每一个子目录即一个独立的项目，对应在 monorepo 名称即为对应目录中 **package.json** 的 `name` 字段的值。

当需要给某一个子目录安装依赖时，只需要使用 `yarn workspace @onekeyhq/web add axios`。通过 `yarn workspace @onekeyhq/web` 这样的前缀，最终可以在根目录把 axios 模块安装到 web 这个子项目当中。

部分依赖有原生部分，所以执行安装完 JS 依赖后需要进入 `apps/ios` 目录下执行 `pod install`。

## 😷 常见问题

1. app 无法启动及各类环境启动问题

任何启动阶段的环境，模块及依赖问题，都推荐先使用根目录下命令 `yarn clean`。命令中会清除所有子依赖，同时清除 yarn 的模块缓存，metro / babel 等工具缓存，之后重新启动项目尝试。

2. yarn 安装依赖过程中或新增依赖时，提示 **error An unexpected error occurred: "expected workspace package to exist for**

参考 https://github.com/yarnpkg/yarn/issues/7807，通过命令 `yarn policies set-version 1.18.0` 设置当前环境 yarn 版本为 1.18.0