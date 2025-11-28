# Create PR from Current Changes

Execute the following workflow to create a Pull Request from current changes:

## Workflow Steps

1. **Check current branch status**
   - Run `git status` to see all changes
   - Run `git branch --show-current` to get current branch name

2. **Branch handling**
   - **If on `x` branch**: Create a new feature branch first
     - Analyze the current changes (staged and unstaged)
     - Generate a descriptive branch name based on the changes (e.g., `feat/add-new-feature`, `fix/resolve-bug-issue`)
     - Branch naming convention:
       - `feat/` for new features
       - `fix/` for bug fixes
       - `refactor/` for refactoring
       - `chore/` for maintenance tasks
     - Create and switch to the new branch: `git checkout -b <branch-name>`
   - **If already on a feature branch (not `x`)**: Skip branch creation, proceed directly to commit

3. **Stage and commit changes**
   - Stage all changes: `git add .`
   - Create a descriptive commit message based on the changes
   - Commit with the message following conventional commits format
   - **Do NOT add any Claude signatures, Co-Authored-By, or Generated with Claude Code messages**

4. **Push to remote**
   - Push the branch to origin: `git push -u origin <branch-name>`

5. **Create Pull Request**
   - Use `gh pr create` to create a PR targeting the `x` branch
   - Generate a clear PR title and description based on the changes
   - Include a summary of what was changed

6. **Update branch and enable auto-merge**
   - Update the PR branch with latest base branch: `gh pr update-branch <PR_NUMBER>`
   - Enable auto-merge with squash: `gh pr merge <PR_NUMBER> --auto --squash`

7. **Return the PR URL**
   - Display the PR URL to the user

8. **Open the PR in browser**
   - Automatically open the PR URL in the default browser: `open <PR_URL>`

## Important Notes

- Always target `x` as the base branch for the PR
- The commit message should follow the format: `type: description`
