#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// 全球主要城市列表（全小写）
const CITIES = [
  'tokyo',
  'beijing',
  'shanghai',
  'mumbai',
  'london',
  'new-york',
  'los-angeles',
  'paris',
  'dubai',
  'singapore',
  'hong-kong',
  'sydney',
  'toronto',
  'mexico-city',
  'bangkok',
  'jakarta',
  'istanbul',
  'moscow',
  'seoul',
  'berlin',
  'madrid',
  'rome',
  'amsterdam',
  'vienna',
  'prague',
  'warsaw',
  'stockholm',
  'oslo',
  'copenhagen',
  'helsinki',
  'athens',
  'cairo',
  'johannesburg',
  'lagos',
  'nairobi',
  'cape-town',
  'buenos-aires',
  'sao-paulo',
  'rio',
];

function getRandomCity() {
  return CITIES[Math.floor(Math.random() * CITIES.length)];
}

function getDateString() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${month}${day}`;
}

function getCurrentBranch() {
  try {
    return execSync('git rev-parse --abbrev-ref HEAD', {
      encoding: 'utf-8',
    }).trim();
  } catch (_error) {
    console.error('❌ Failed to get current branch');
    process.exit(1);
  }
}

function getRepoRoot() {
  try {
    return execSync('git rev-parse --show-toplevel', {
      encoding: 'utf-8',
    }).trim();
  } catch (error) {
    console.error('❌ Failed to get repository root');
    process.exit(1);
  }
}

function createWorktreeAndRunCommand(commandToRun) {
  const repoRoot = getRepoRoot();
  const currentBranch = getCurrentBranch();
  const city = getRandomCity();
  const date = getDateString();

  // 生成分支名：城市-日期 (如: tokyo-0325)
  const branchName = `${city}-${date}`;
  const worktreePath = path.join(repoRoot, '.claude', 'worktrees', branchName);

  console.log(`\n📍 Current branch: ${currentBranch}`);
  console.log(`🌍 Random city: ${city}`);
  console.log(`📅 Date: ${date}`);
  console.log(`🌿 New branch: ${branchName}`);
  console.log(`📂 Worktree path: ${worktreePath}`);
  console.log(`📝 Command: ${commandToRun}\n`);

  try {
    // 确保 .claude/worktrees 目录存在
    const worktreeDir = path.join(repoRoot, '.claude', 'worktrees');
    if (!fs.existsSync(worktreeDir)) {
      fs.mkdirSync(worktreeDir, { recursive: true });
    }

    // 创建 worktree，基于当前分支 (HEAD)
    console.log('⚙️  Creating worktree...');
    execSync(`git worktree add "${worktreePath}" -b "${branchName}"`, {
      stdio: 'inherit',
    });

    console.log(`\n✅ Worktree created successfully!`);
    console.log(`\n🚀 Running command in this worktree...\n`);

    // 在新 worktree 中执行命令
    try {
      process.chdir(worktreePath);
      execSync(commandToRun, { stdio: 'inherit', shell: true });
    } catch (error) {
      console.log(`\n✋ Command ended`);
    }

    console.log(`\n🧹 To remove this worktree later, run:`);
    console.log(`   git worktree remove "${worktreePath}"`);
  } catch (error) {
    console.error('\n❌ Failed to create worktree');
    console.error(error.message);
    process.exit(1);
  }
}

function showHelp() {
  console.log(`
Usage: yarn worktree <command...>

Creates a new worktree (with random city+date branch name) based on current branch,
then executes the given command inside it.

Examples (quotes optional):
  yarn worktree claude
  yarn worktree yarn app:web
  yarn worktree yarn app:web --port 3000
  yarn worktree npm run test -- --watch
  yarn worktree help                # Show this help message
  `);
}

function main() {
  const args = process.argv.slice(2);
  const command = args.join(' ');

  if (
    !command ||
    command === 'help' ||
    command === '-h' ||
    command === '--help'
  ) {
    showHelp();
    return;
  }

  createWorktreeAndRunCommand(command);
}

main();
