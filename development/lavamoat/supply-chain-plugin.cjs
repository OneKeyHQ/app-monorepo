// cspell:ignore npath Syml
/* eslint-disable max-classes-per-file -- Yarn registers one command class per CLI route. */

module.exports = {
  name: 'onekey-supply-chain',
  factory(require) {
    const path = require('node:path');
    const { createRequire } = require('node:module');
    const { BaseCommand } = require('@yarnpkg/cli');
    const { Configuration, InstallMode, Project } = require('@yarnpkg/core');
    const { npath } = require('@yarnpkg/fslib');
    const { parseSyml } = require('@yarnpkg/parsers');
    const resolutionContexts = new WeakMap();
    const executionContexts = new WeakMap();

    function checkerFor(project) {
      const root = npath.fromPortablePath(project.cwd);
      const localRequire = createRequire(path.join(root, 'package.json'));
      const checker = localRequire('./development/lavamoat/supply-chain.cjs');
      const context = checker.loadContext(
        root,
        parseSyml,
        project.workspaces.map((workspace) =>
          npath.fromPortablePath(workspace.cwd),
        ),
      );
      return { checker, context };
    }

    class CheckCommand extends BaseCommand {
      static paths = [['supply-chain', 'check']];

      async execute() {
        const configuration = await Configuration.find(
          this.context.cwd,
          this.context.plugins,
        );
        const { project } = await Project.find(configuration, this.context.cwd);
        const { checker, context } = checkerFor(project);
        checker.checkConfiguration(context, configuration.get('enableScripts'));
        const installed = checker.checkInstalled(context);
        this.context.stdout.write(
          `LavaMoat supply chain: checked ${installed.length} installed package locations.\n`,
        );
      }
    }

    class InventoryCommand extends BaseCommand {
      static paths = [['supply-chain', 'inventory']];

      async execute() {
        const configuration = await Configuration.find(
          this.context.cwd,
          this.context.plugins,
        );
        const { project } = await Project.find(configuration, this.context.cwd);
        const { checker, context } = checkerFor(project);
        this.context.stdout.write(
          `${JSON.stringify(checker.inventory(context), null, 2)}\n`,
        );
      }
    }

    return {
      commands: [CheckCommand, InventoryCommand],
      hooks: {
        validateProject(project) {
          const current = checkerFor(project);
          resolutionContexts.set(project, current);
          const { checker, context } = current;
          checker.checkConfiguration(
            context,
            project.configuration.get('enableScripts'),
          );
        },
        reduceDependency(dependency, project) {
          let current = resolutionContexts.get(project);
          if (!current) {
            current = checkerFor(project);
            resolutionContexts.set(project, current);
          }
          current.checker.checkGitSpecifier(current.context, dependency.range);
          return dependency;
        },
        setupScriptEnvironment(project, env) {
          let current = executionContexts.get(project);
          if (!current) {
            current = checkerFor(project);
            executionContexts.set(project, current);
          }
          const { checker, context } = current;
          checker.checkConfiguration(
            context,
            project.configuration.get('enableScripts'),
          );
          checker.checkExecution(
            context,
            env.npm_package_json,
            env.npm_lifecycle_event,
          );
          if (env.npm_lifecycle_event === 'setup:dependencies') {
            // Manual setup and after-install use the same full admission gate.
            checker.checkInstalled(context);
          }
          // Keep nested npm/Yarn fallback installers from enabling their own hooks.
          env.npm_config_ignore_scripts = 'true';
          env.YARN_ENABLE_SCRIPTS = 'false';
        },
        afterAllInstalled(project, options) {
          // Only Yarn's lockfile-only mode omits linking. This hook receives the
          // official mode and runs before the configured after-install plugin.
          if (options?.mode === InstallMode.UpdateLockfile) return;
          const { checker, context } = checkerFor(project);
          checker.checkInstalled(context);
        },
      },
    };
  },
};
