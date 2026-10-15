# Git Workflow & Commit Authority Policy

**CRITICAL INVARIANT**: The AI assistant has had all commit and push privileges permanently revoked.

---

## Strict Rules for the AI Assistant

1. **NO GIT COMMITS**:
   - The AI assistant is strictly forbidden from running `git commit`, `git commit -a`, `git commit -m`, or any command that creates commits.
   - All commits must be made manually by the user.

2. **NO GIT PUSHES**:
   - The AI assistant is strictly forbidden from running `git push` under any circumstance.
   - Pushing code to any remote repository (`origin`, `upstream`, etc.) is reserved exclusively for the human user.

3. **NO BRANCH OR HISTORY MUTATIONS**:
   - The AI assistant must not run `git merge`, `git rebase`, `git tag`, `git reset`, or `git cherry-pick` unless explicitly instructed for a specific one-off command by the user.

4. **PERMITTED ACTIONS**:
   - Creating, viewing, and modifying code files locally (`replace_file_content`, `write_to_file`, `view_file`).
   - Running local builds (e.g. `node frontend/build.js`) and tests.
   - Running read-only git inspection (`git status`, `git diff`) to verify working directory changes.

5. **HANDOFF TO USER**:
   - When code changes or fixes are complete, the assistant must show a summary of changes and let the user review and commit them themselves.
