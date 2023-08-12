# Zap

<p align="center">
  <img width==360 height=360 src="./docs/logo.svg">
</p>

<p align="center">
  <strong>Instant | Intuitive | Independent<strong>
</p>

## ✨ Acknowledgements

First and foremost,we would like to extend our gratitude to [OneKey](<[url](http://onekey.so)>) for making their [source code](<[url](https://github.com/OneKeyHQ/app-monorepo)>) open source, allowing us to build upon their implementation to create **Zap**.

## 🚀 Getting Onboard

1. Install [node.js LTS version (>= 16)](https://nodejs.org/en/)
2. Install [yarn package management tool](https://yarnpkg.com/)
3. Install [git lfs](https://git-lfs.github.com/) (some binaries are required for pulling and updating)
4. To start the iOS project, make sure that the local XCode version is greater than or equal to 13.3
5. To start the Android project, make sure that the local JDK version is greater than or equal to 11

After pulling the latest code via the git command line tool, install the project dependencies in the root directory via the `yarn` command

```
# Install the expo command line tool globally at first.(Be careful not to modify the version, it may cause compilation failure.)

npm install -g expo-cli@6.0.8

# Next, install all JS dependencies and submodule dependencies.

yarn
```

## 🧑‍💻 Develop

Execute the following commands in the root directory to develop different business code

- `yarn web`: Develop web mode, which starts a static server on port 3000 locally
- `yarn ios`: connect to iphone device via USB for development debugging
- `yarn android`: develop android
- `yarn desktop`: development in desktop mode
- `yarn ext`: development in extension mode

## 🛠 Build for production

Execute the following commands in the root directory and build target for production. Make sure each platform starts correctly and environment variables are configured correctly. For expo build please read this [doc](https://docs.expo.dev/build/setup/) to **complete some prerequisites first**.

- web: `cd packages/web && yarn build`, build the static files at packages/web/web-build, for production build, see [release-web.yml](./.github/workflows/release-web.yml) job for details.
- ios: use expo server to build, see [release-ios.yml](./.github/workflows/release-ios.yml) job for details.
- android:
  - use expo server to build, see [release-android.yml](./.github/workflows/release-android.yml) job for details.
  - or use `cd packages/app/android && ./gradlew aR` to build in local.
- desktop: : `cd packages/desktop && yarn build`, see [release-desktop.yml](./.github/workflows/release-desktop.yml) job for details.
- ext: `cd packages/ext && yarn build:all`, see [release-ext.yml](./.github/workflows/release-ext.yml) job for details.

## 🗂 Multi-repository directory structure

The repositories are organized using the monorepo model to keep the code on different ends centralized and unaffected, while making it as reusable as possible during the packaging and compilation process

- `packages/components` holds UI components
- `packages/kit` holds reusable page-level UI content
- `packages/app` APP code
- `packages/desktop` Desktop electron code
- `packages/web` web-side code
- `packages/ext` chrome extension & firefox addon code

## 🧲 Install dependencies

Each subdirectory under the `packages/` directory is a separate project, and the corresponding monorepo name is the value of the `name` field in the corresponding directory **package.json**.

When you need to install a dependency for a subdirectory, just use `yarn workspace @onekeyhq/web add axios`. With a prefix like `yarn workspace @onekeyhq/web`, the axios module can eventually be installed in the root directory in the web subproject.

Some of the dependencies have native parts, so you need to go into the `packages/app/ios` directory and do a `pod install` after installing the JS dependencies.

## 😷 Common problems

1. The app does not start

For any environment, module and dependency issues in the startup phase, it is recommended to use the command `yarn clean` in the root directory first. The command will clear all sub-dependencies, as well as the module cache of yarn, the cache of tools such as metro / babel, and then restart the project to try.

2. Failed to run some post install scripts

Sorry, we only develop on macOS and haven't tested on other operating system platforms, so there may be some compatibility issues with some scripts. If you encounter script running errors on a Windows platform, we suggest you try using a Unix-like environment, such as WSL.

## 💬 Docs in your languages

| Available Languages                                        |
| :--------------------------------------------------------- |
| [Simplified Chinese / 简体中文](docs/i18n/README.zh-cn.md) |
| [German / Deutsch](docs/i18n/README.de.md)                 |
| [Japanese / 日本語](docs/i18n/README.jp.md)                |
| [French / Français](docs/i18n/README.fr.md)                |
| [Italian / Italiano](docs/i18n/README.it.md)               |
