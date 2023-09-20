import { Box, Center, Markdown, ScrollView } from '@onekeyhq/components';

const MarkdownGallery = () => {
  const md = `
  # OneKey App Monorepo [English]

  ## 🌍 Environment Configuration
  
  - Install [node.js LTS version (>= 16)](https://nodejs.org/en/)
  - Install [yarn package management tool](https://yarnpkg.com/)
  - Install [git lfs](https://git-lfs.github.com/) (some binaries are required for pulling and updating)
  
  After pulling the latest code via the git command line tool, install the project dependencies in the root directory via the \`yarn\` command
  
  \`\`\`
  # Install all JS dependencies and submodule dependencies
  yarn
  \`\`\`
  
  ## 🛠 Develop
  
  Execute the following commands in the root directory to develop different business code
  
  - \`yarn web\`: Develop web mode, which starts a static server on port 3000 locally
  - \`yarn ios\`: connect to iphone device via USB for development debugging
  - \`yarn android\`: develop android
  - \`yarn desktop\`: development in desktop mode
  
  ## 🗂 Multi-repository directory structure
  
  The repositories are organized using the monorepo model to keep the code on different ends centralized and unaffected, while making it as reusable as possible during the packaging and compilation process
  
  - \`packages/components\` holds UI components
  - \`packages/kit\` holds reusable page-level UI content
  - \`packages/app\` APP code
  - \`packages/desktop\` Desktop electron code
  - \`packages/web\` web-side code
  - \`packages/extension\` Plugin-side code
  
  ## 🧲 Install dependencies
  
  Each subdirectory under the \`packages/\` directory is a separate project, and the corresponding monorepo name is the value of the \`name\` field in the corresponding directory **package.json**.
  
  When you need to install a dependency for a subdirectory, just use \`yarn workspace @onekeyhq/web add axios\`. With a prefix like \`yarn workspace @onekeyhq/web\`, the axios module can eventually be installed in the root directory in the web subproject.
  
  Some of the dependencies have native parts, so you need to go into the \`packages/app/ios\` directory and do a \`pod install\` after installing the JS dependencies.
  
  ## 😷 Common problems
  
  1. The app does not start
  
  Clear the packaging tool cache with the \`--reset-cache\` command in \`yarn native\` in the root directory. Also run \`-yarn clean\` in the root directory to clear all dependencies and generated files and then re-run \`-yarn\` to install the dependencies.
  
  # OneKey App Monorepo [Chinese]
  
  ## 🌍 环境配置
  
  - 安装 [node.js LTS 版本（>= 16）](https://nodejs.org/en/)
  - 安装 [yarn 包管理工具](https://yarnpkg.com/)
  - 安装 [git lfs](https://git-lfs.github.com/)（部分二进制文件在拉取和更新时需要）
  
  通过 git 命令行工具拉取最新的代码之后，通过 \`yarn\` 命令在根目录安装项目依赖
  
  \`\`\`
  # 安装所有 JS 依赖及子模块依赖
  yarn
  \`\`\`
  
  ## 🛠 开发
  
  在根目录执行以下命令，从而开发不同的业务代码
  
  - \`yarn web\`: 开发网页模式，会启动静态服务器在本地 3000 端口，需同时本地启动[connect](https://github.com/OneKeyHQ/connect) 项目
  - \`yarn ios\`: 通过 USB 连接 iphone 设备进行开发调试
  - \`yarn android\`: 调试安卓
  - \`yarn desktop\`: 开发桌面端模式
  
  ### Android 项目配置
  
  #### 第一种方式：适用于社区开发人员
  
  在 \`packages/app/android/lib-keys-secret/src/main/cpp/keys.c\` 中配置相关 key，也可以使用默认选项。可能一些 API 会有限制。
  
  #### 第二种方式：适用于官方开发人员
  
  1. 前往加密仓库获取 \`debug.keystore\` 文件，放入 \`packages/app/android/keystores\` 目录中，没有该目录请自行创建。
  2. 前往加密仓库获取 \`keys.secret\` 文件，放入 \`packages/app/android\` 目录中。
  
  ## 🗂 多仓库目录结构
  
  仓库使用 monorepo 模式进行组织，在保证不同端的代码集中且互相不影响的大前提下，又尽可能的在打包和编译过程中让代码复用
  
  - \`packages/components\` 存放 UI 组件
  - \`packages/kit\` 存放可复用页面级别 UI 内容
  - \`packages/app\` APP 代码
  - \`packages/desktop\` 桌面端 electron 代码
  - \`packages/web\` 网页端代码
  - \`packages/extension\` 插件端代码
  
  ## 🧲 安装依赖
  
  \`packages/\` 目录下的每一个子目录即一个独立的项目，对应在 monorepo 名称即为对应目录中 **package.json** 的 \`name\` 字段的值。
  
  当需要给某一个子目录安装依赖时，只需要使用 \`yarn workspace @onekeyhq/web add axios\`。通过 \`yarn workspace @onekeyhq/web\` 这样的前缀，最终可以在根目录把 axios 模块安装到 web 这个子项目当中。
  
  部分依赖有原生部分，所以执行安装完 JS 依赖后需要进入 \`packages/app/ios\` 目录下执行 \`pod install\`。
  
  ## 😷 常见问题
  
  1. app 无法启动
  
  通过根目录下的 \`yarn native\` 中 \`--reset-cache\` 命令清除打包工具缓存。同时配合根目录下命令 \`yarn clean\` 清除所有依赖及生成文件后重新执行 \`yarn\` 安装依赖。`;
  return (
    <Center flex="1" bg="background-hovered">
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={{ height: '100%' }}
      >
        <Box width="100%">
          <Markdown>{md}</Markdown>
        </Box>
      </ScrollView>
    </Center>
  );
};

export default MarkdownGallery;
