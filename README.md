<p align="center">
<img width="200" src="https://github.com/rayston92/graph_bed/blob/e3b2c938fc5b17d68531f69178908afb16266e6a/img/onekey_logo_badge_border.png?raw=trueg"/>
</p>

---

[![Github Stars](https://img.shields.io/github/stars/OneKeyHQ/app-monorepo?t&logo=github&style=for-the-badge&labelColor=000)](https://github.com/OneKeyHQ/app-monorepo/stargazers)
[![Version](https://img.shields.io/github/release/OneKeyHQ/app-monorepo.svg?style=for-the-badge&labelColor=000)](https://github.com/OneKeyHQ/app-monorepo/releases)
[![](https://img.shields.io/github/contributors-anon/OneKeyHQ/app-monorepo?style=for-the-badge&labelColor=000)](https://github.com/OneKeyHQ/app-monorepo/graphs/contributors)
[![Last commit](https://img.shields.io/github/last-commit/OneKeyHQ/app-monorepo.svg?style=for-the-badge&labelColor=000)](https://github.com/OneKeyHQ/app-monorepo/commits/onekey)
[![Issues](https://img.shields.io/github/issues-raw/OneKeyHQ/app-monorepo.svg?style=for-the-badge&labelColor=000)](https://github.com/OneKeyHQ/app-monorepo/issues?q=is%3Aissue+is%3Aopen)
[![Pull Requests](https://img.shields.io/github/issues-pr-raw/OneKeyHQ/app-monorepo.svg?style=for-the-badge&labelColor=000)](https://github.com/OneKeyHQ/app-monorepo/pulls?q=is%3Apr+is%3Aopen)
[![Discord](https://img.shields.io/discord/868309113942196295?style=for-the-badge&labelColor=000)](https://discord.gg/onekey)
[![Twitter Follow](https://img.shields.io/twitter/follow/OneKeyHQ?style=for-the-badge&labelColor=000)](https://twitter.com/OneKeyHQ)

<p align="center">
<img src="https://github.com/rayston92/graph_bed/blob/master/img/onekey_monorepo_desktop_transparent.png?raw=true"/>
</p>


## Community & Support

- [Community Forum](https://github.com/orgs/OneKeyHQ/discussions). Best for: help with building, discussion about best practices.
- [GitHub Issues](https://github.com/OneKeyHQ/app-monorepo/issues). Best for: bugs and errors you encounter using OneKey.
- [Discord](https://discord.gg/onekey). Best for: sharing your ideas and hanging out with the community.

## Status

- [x] Alpha: We are testing Supabase with a closed set of customers
- [ ] Public: Production-ready

We really need your support, star or watch this repo for latest updates.

<kbd><img src="https://github.com/rayston92/graph_bed/blob/e3b2c938fc5b17d68531f69178908afb16266e6a/img/onekey_monorepo_star.gif?raw=true" alt="Star this repo"/></kbd>

## 🚀 Getting Onboard

1. Install [node.js LTS version  (>= 16)](https://nodejs.org/en/)
2. Install [yarn package management tool](https://yarnpkg.com/)
3. Install [git lfs](https://git-lfs.github.com/) (some binaries are required for pulling and updating)

After pulling the latest code via the git command line tool, install the project dependencies in the root directory via the `yarn` command

```
# Install all JS dependencies and submodule dependencies

yarn

# Install the expo command line tool globally

npm install -g expo-cli
```

## 🛠 Develop

Execute the following commands in the root directory to develop different business code

- `yarn web`: Develop web mode, which starts a static server on port 3000 locally
- `yarn ios`: connect to iphone device via USB for development debugging
- `yarn android`: develop android
- `yarn desktop`: development in desktop mode

## 🗂 Multi-repository directory structure

The repositories are organized using the monorepo model to keep the code on different ends centralized and unaffected, while making it as reusable as possible during the packaging and compilation process

- `packages/components` holds UI components
- `packages/kit` holds reusable page-level UI content
- `packages/app` APP code
- `packages/desktop` Desktop electron code
- `packages/web` web-side code
- `packages/extension` Plugin-side code

## 🧲 Install dependencies

Each subdirectory under the `packages/` directory is a separate project, and the corresponding monorepo name is the value of the `name` field in the corresponding directory **package.json**.

When you need to install a dependency for a subdirectory, just use `yarn workspace @onekeyhq/web add axios`. With a prefix like `yarn workspace @onekeyhq/web`, the axios module can eventually be installed in the root directory in the web subproject.

Some of the dependencies have native parts, so you need to go into the `packages/app/ios` directory and do a `pod install` after installing the JS dependencies.

## 😷 Common problems

1. The app does not start

Clear the packaging tool cache with the `--reset-cache` command in `yarn native` in the root directory. Also run `yarn clean` in the root directory to clear all dependencies and generated files and then re-run `yarn` to install the dependencies.

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
