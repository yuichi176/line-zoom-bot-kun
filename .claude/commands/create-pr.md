---
allowed-tools: Bash(git *:*, gh *)
argument-hint: "[title] [--draft]"
description: Create a pull request for the current branch using GitHub CLI
---

Create a pull request for the current branch using the GitHub CLI. Follow these steps:

1. First check the current git status and branch
2. Ensure we're not on the main branch
3. Check if there are any uncommitted changes that need to be committed first
4. Push the current branch to remote if it doesn't exist there yet
5. Use the gh CLI to create a pull request with the following:
   - Title: Use the provided title from arguments, or if none provided, use the latest commit message
   - Body: Include a summary of commits, list of changes, and basic test plan template
   - Base branch: main
   - If --draft flag is provided, create as draft PR
6. After creation, open the PR in the browser

Arguments: $ARGUMENTS

If any step fails, provide clear error messages and suggestions for resolution.