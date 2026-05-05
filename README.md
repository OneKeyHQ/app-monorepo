<div align="center">

# OneKey: Secure Crypto Wallet

Anti-scam, open-source crypto wallet for every chain.
Supports Bitcoin, Ethereum, Solana, Tron, BNB Smart Chain, and more.

[![Github Stars](https://img.shields.io/github/stars/OneKeyHQ/app-monorepo?t&logo=github&style=for-the-badge&labelColor=000)](https://github.com/OneKeyHQ/app-monorepo/stargazers)
[![Version](https://img.shields.io/github/release/OneKeyHQ/app-monorepo.svg?style=for-the-badge&labelColor=000)](https://github.com/OneKeyHQ/app-monorepo/releases)
[![Contributors](https://img.shields.io/github/contributors-anon/OneKeyHQ/app-monorepo?style=for-the-badge&labelColor=000)](https://github.com/OneKeyHQ/app-monorepo/graphs/contributors)
[![Last commit](https://img.shields.io/github/last-commit/OneKeyHQ/app-monorepo.svg?style=for-the-badge&labelColor=000)](https://github.com/OneKeyHQ/app-monorepo/commits/onekey)
[![Issues](https://img.shields.io/github/issues-raw/OneKeyHQ/app-monorepo.svg?style=for-the-badge&labelColor=000)](https://github.com/OneKeyHQ/app-monorepo/issues?q=is%3Aissue+is%3Aopen)
[![Pull Requests](https://img.shields.io/github/issues-pr-raw/OneKeyHQ/app-monorepo.svg?style=for-the-badge&labelColor=000)](https://github.com/OneKeyHQ/app-monorepo/pulls?q=is%3Apr+is%3Aopen)
[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/OneKeyHQ/app-monorepo)
[![Twitter Follow](https://img.shields.io/twitter/follow/OneKeyHQ?style=for-the-badge&labelColor=000)](https://twitter.com/OneKeyHQ)

</div>

## 📥 Download

| Platform | Link |
|----------|------|
| iOS | [App Store](https://apps.apple.com/us/app/onekey-open-source-wallet/id1609559473) |
| Android | [Google Play](https://play.google.com/store/apps/details?id=so.onekey.app.wallet) |
| Desktop | [macOS / Windows / Linux](https://onekey.so/download?client=desktop) |
| Browser Extension | [Chrome Web Store](https://onekey.so/download?client=browserExtension) |
| Bridge | [Download](https://onekey.so/download?client=bridge) |

## 📋 Table of Contents

- [📥 Download](#-download)
- [📖 Documentation](#-documentation)
- [🗂 Project Structure](#-project-structure)
- [🚀 Getting Onboard](#-getting-onboard)
- [🧑‍💻 Development](#-development)
- [🏡 Community & Enterprise Edition](#-community--enterprise-edition)
- [💡 Support](#-support)
- [🔰 Security](#-security)
- [💬 Docs in Your Languages](#-docs-in-your-languages)
- [🪄 Repo Activity](#-repo-activity)
- [🙋‍♂️ We're Hiring!](#%EF%B8%8F-were-hiring)
- [✨ Contributors](#-contributors)
- [📄 License](#-license)

## 📖 Documentation

- [DeepWiki — Full Codebase Documentation](https://deepwiki.com/OneKeyHQ/app-monorepo)
- [Bug Bounty Rules](docs/BUG_RULES.md)
- [Security Policy](SECURITY.md)

## 🗂 Project Structure

This is a monorepo managed with Yarn workspaces.

```
app-monorepo/
├── apps/
│   ├── desktop/        # Electron desktop app (macOS, Windows, Linux)
│   ├── ext/            # Browser extension (Chrome)
│   ├── mobile/         # React Native mobile app (iOS, Android)
│   ├── web/            # Web application
│   └── web-embed/      # Embeddable web component
├── packages/
│   ├── components/     # Shared UI component library
│   ├── core/           # Core business logic & crypto utilities
│   ├── kit/            # Main UI kit
│   ├── kit-bg/         # Background service kit
│   ├── qr-wallet-sdk/  # QR-code hardware wallet SDK
│   └── shared/         # Shared utilities, constants, and types
├── development/        # Dev tooling & scripts
├── patches/            # Dependency patches
└── docs/               # Documentation & i18n
```

## 🚀 Getting Onboard

> **Prerequisites:** Node.js >= 22, Yarn 4.x (bundled via Corepack), [Git LFS](https://git-lfs.github.com/)

```bash
git clone https://github.com/OneKeyHQ/app-monorepo.git
cd app-monorepo
yarn
yarn app:web    # starts dev server at http://localhost:3000
```

<details>
<summary><strong>📱 Platform-specific requirements</strong></summary>

- **iOS:** Xcode >= 13.3
- **Android:** JDK >= 11

</details>

## 🧑‍💻 Development

Run these commands from the root directory:

| Command | Description |
|---------|-------------|
| `yarn app:web` | Start web dev server (port 3000) |
| `yarn app:ios` | Run iOS app via USB-connected device |
| `yarn app:android` | Run Android app |
| `yarn app:desktop` | Run desktop (Electron) app |
| `yarn app:ext` | Run browser extension |

## 🏡 Community & Enterprise Edition

- 🏡 🧔🏻‍♂️ **Community Edition** — Free forever for individuals and open-source communities.
- 🏦 💼 **Enterprise Edition** — Coming soon. Star this repo to get notified when it's ready.

## 💡 Support

- [Community Forum](https://github.com/orgs/OneKeyHQ/discussions) — Help with building, best practices discussion.
- [GitHub Issues](https://github.com/OneKeyHQ/app-monorepo/issues) — Bug reports and errors.

## 🔰 Security

- Please read the [Bug Bounty Rules](docs/BUG_RULES.md), we have detailed the exact plan in this article.
- Report suspected vulnerabilities privately to **dev@onekey.so** or via [BugRap](https://bugrap.io/bounties/OneKey).
- Please do **NOT** create publicly viewable issues for suspected security vulnerabilities.
- As an open source project, although we are not yet profitable, we try to give some rewards to white hat hackers who disclose vulnerabilities to us in a timely manner.
- See [SECURITY.md](SECURITY.md) for full details.

## 💬 Docs in Your Languages

| Available Languages |
|---------------------|
| [🇨🇳 简体中文](docs/i18n/README.zh-cn.md) |
| [🇩🇪 Deutsch](docs/i18n/README.de.md) |
| [🇯🇵 日本語](docs/i18n/README.jp.md) |
| [🇫🇷 Français](docs/i18n/README.fr.md) |
| [🇮🇹 Italiano](docs/i18n/README.it.md) |

## 🪄 Repo Activity

![Repo Activity](https://repobeats.axiom.co/api/embed/5f8b83656094956b2d6274929f6eaa2e068a6cfb.svg "Repobeats analytics image")

## 🙋‍♂️ We're Hiring!

We're hiring for remote roles worldwide — global pay, ESOP for everyone, open-source culture.

[**👉 View all open positions**](https://onekeyhq.atlassian.net/wiki/spaces/OC/overview)

<details>
<summary><strong>Why join OneKey?</strong></summary>

| English | 中文 |
|---------|------|
| 🌍 Remote (Live anywhere) | 🌍 远程 (生活在哪个城市都可以) |
| 💰 Global Pay (Literally) | 💰 全球一致的薪酬 (真的) |
| 📈 ESOP (For everybody) | 📈 ESOP 计划 |
| 🔓 Open Source (As you see) | 🔓 开源 (如你所见) |
| 🤝 Awesome Colleagues (Hell Yeah!) | 🤝 超级棒的同事 (爽呆!) |

</details>

## ✨ Contributors

[![Contributors](https://img.shields.io/github/contributors-anon/OneKeyHQ/app-monorepo?style=for-the-badge&labelColor=000)](https://github.com/OneKeyHQ/app-monorepo/graphs/contributors)

<a href="https://github.com/onekeyhq/app-monorepo/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=onekeyhq/app-monorepo&max=240&columns=24"/>
</a>

## 📄 License

This project is licensed under the [OneKey Standard Source License (O-SSL)](LICENSE.md).
