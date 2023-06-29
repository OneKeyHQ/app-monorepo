# OneKey - Open Source Crypto Wallet

[![Github Stars](https://img.shields.io/github/stars/OneKeyHQ/app-monorepo?t&logo=github&style=for-the-badge&labelColor=000)](https://github.com/OneKeyHQ/app-monorepo/stargazers)
[![Version](https://img.shields.io/github/release/OneKeyHQ/app-monorepo.svg?style=for-the-badge&labelColor=000)](https://github.com/OneKeyHQ/app-monorepo/releases)
[![](https://img.shields.io/github/contributors-anon/OneKeyHQ/app-monorepo?style=for-the-badge&labelColor=000)](https://github.com/OneKeyHQ/app-monorepo/graphs/contributors)
[![Last commit](https://img.shields.io/github/last-commit/OneKeyHQ/app-monorepo.svg?style=for-the-badge&labelColor=000)](https://github.com/OneKeyHQ/app-monorepo/commits/onekey)
[![Issues](https://img.shields.io/github/issues-raw/OneKeyHQ/app-monorepo.svg?style=for-the-badge&labelColor=000)](https://github.com/OneKeyHQ/app-monorepo/issues?q=is%3Aissue+is%3Aopen)
[![Pull Requests](https://img.shields.io/github/issues-pr-raw/OneKeyHQ/app-monorepo.svg?style=for-the-badge&labelColor=000)](https://github.com/OneKeyHQ/app-monorepo/pulls?q=is%3Apr+is%3Aopen)
[![Discord](https://img.shields.io/discord/868309113942196295?style=for-the-badge&labelColor=000)](https://discord.gg/onekey)
[![Twitter Follow](https://img.shields.io/twitter/follow/OneKeyHQ?style=for-the-badge&labelColor=000)](https://twitter.com/OneKeyHQ)


[![Appstore](https://github.com/rayston92/graph_bed/blob/275d053220d5b54b32b01ce4c4985210951043c5/img/app_store.svg)](https://apps.apple.com/us/app/onekey-open-source-wallet/id1609559473)
[![Playstore](https://github.com/rayston92/graph_bed/blob/275d053220d5b54b32b01ce4c4985210951043c5/img/play.svg
)](https://play.google.com/store/apps/details?id=so.onekey.app.wallet)

- [Desktop clients: macOS, Windows & Linux](https://onekey.so/zh_CN/download?client=desktop)
- [Browser extensions: Chrome, Firefox, Edge & Brave](https://onekey.so/zh_CN/download?client=browserExtension)
- [Bridge](https://onekey.so/zh_CN/download?client=bridge)

## Community & Enterprise Edition

- 🏡 🧔🏻‍♂️ For Community Edition. It will always remain FREE FOREVER for open-source projects by individuals and communities.
- 🏦 💼 For Enterprise Edition. We've got this plan on the radar, but we're not quite ready yet. Just star our repo, and you'll be pinged as soon as we're all set.







## Support

- [Community Forum](https://github.com/orgs/OneKeyHQ/discussions). Best for: help with building, discussion about best practices.
- [GitHub Issues](https://github.com/OneKeyHQ/app-monorepo/issues). Best for: bugs and errors you encounter using OneKey.
- [Discord](https://discord.gg/onekey). Best for: sharing your ideas and hanging out with the community.

## Repo Status

- ✅ Public: Production-ready

We really need your support, star or watch this repo for latest updates.

<kbd><img src="https://github.com/rayston92/graph_bed/blob/e3b2c938fc5b17d68531f69178908afb16266e6a/img/onekey_monorepo_star.gif?raw=true" alt="Star this repo"/></kbd>


## 🚀 Getting Onboard

1. Install [node.js LTS version  (>= 16)](https://nodejs.org/en/)
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

## 🕋 Roadmap

Check out where we are now!

<kbd><img src="https://github.com/rayston92/graph_bed/blob/master/img/roadmap_light.png?raw=true" alt="Roadmap of OneKey"/></kbd>


## 💬 Docs in your languages
| Available Languages               |
| :--------------------------- |
| [Simplified Chinese / 简体中文](docs/i18n/README.zh-cn.md)|
| [German / Deutsch](docs/i18n/README.de.md)|
| [Japanese / 日本語](docs/i18n/README.jp.md)|
| [French / Français](docs/i18n/README.fr.md)|
| [Italian / Italiano](docs/i18n/README.it.md)|


## 🔰 Security

- Please read [Bug Bunty Rules](https://github.com/OneKeyHQ/app-monorepo/blob/onekey/docs/BUG_RULES.md), we have detailed the exact plan in this article.
- Please report suspected security vulnerabilities in private to dev@onekey.so
- Please do NOT create publicly viewable issues for suspected security vulnerabilities.
- As an open source project, although we are not yet profitable, we try to give some rewards to white hat hackers who disclose vulnerabilities to us in a timely manner.

## 🙋‍♂️We're Hiring!

<table>
    <thead>
        <tr>
            <th colspan="2"> We are hiring many roles (Remote)
            <a href="https://onekeyhq.atlassian.net/wiki/spaces/OC/overview">👉 Click here to check all open positions</a>
            </th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>
            <li>Remote (Live anywhere)</li>
            <li>Global Pay (Literally)</li>
            <li>ESOP (For everybody)</li>
            <li>Open Source (As you see)</li>
            <li>Awesome Colleagues (Hell Yeah!)</li>
            </td>
            <td>
            <li>远程 (生活在哪个城市都可以)</li>
            <li>全球一致的薪酬 (真的)</li>
            <li>全员持股计划 (每个人都有)</li>
            <li>开源 (如你所见)</li>
            <li>超级棒的同事 (爽呆!)</li>
            </td>
        </tr>
    </tbody>
</table>

## ✨ Salute!

[![](https://img.shields.io/github/contributors-anon/OneKeyHQ/app-monorepo?style=for-the-badge&labelColor=000)](https://github.com/OneKeyHQ/app-monorepo/graphs/contributors)

<a href="https://github.com/onekeyhq/app-monorepo/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=onekeyhq/app-monorepo&max=240&columns=24"/>
</a>

## ⚖️ License

OneKey is available under the [Apache-2.0 license](https://github.com/OneKeyHQ/app-monorepo/blob/onekey/LICENSE) license.
Free for commercial and non-commercial use.
