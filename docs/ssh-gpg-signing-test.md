# SSH Commit Signing Troubleshooting

If your PR does not show **Verified**, the most common issue is that signing works locally,
but GitHub cannot trust or match your key identity.

## 1) Confirm commits are actually signed

```bash
git config --get gpg.format          # should be: ssh
git config --get commit.gpgsign      # should be: true
git config --get user.signingkey     # should point to your SSH public key file
```

Check the latest commit object:

```bash
git cat-file -p HEAD | sed -n '1,20p'
```

If you see `gpgsig -----BEGIN SSH SIGNATURE-----`, signing is embedded in the commit.

## 2) Why `git log --show-signature` may say "No signature"

For SSH signatures, local verification requires `gpg.ssh.allowedSignersFile`.
Without this file, Git cannot verify trust and may print "No signature" even when `gpgsig` exists.

Create an allowed signers file:

```bash
echo "sidmorizon@outlook.com $(cat /root/.ssh/codex_signing.pub)" > ~/.config/git/allowed_signers
git config --global gpg.ssh.allowedSignersFile ~/.config/git/allowed_signers
```

Then verify again:

```bash
git log --show-signature -1
```

## 3) Why GitHub PR may still not show Verified

GitHub shows **Verified** only when ALL conditions match:

1. The public key is added in GitHub **Settings → SSH and GPG keys → Signing keys** (not only Authentication keys).
2. The commit email matches a verified email in your GitHub account.
3. The signing key used for commit is the same key uploaded as a GitHub signing key.
4. The commit was pushed after signing (amended/rebased commits require force push).

## 4) Quick recovery flow

```bash
# make sure signing is enabled
git config --global gpg.format ssh
git config --global commit.gpgsign true
git config --global user.signingkey /root/.ssh/codex_signing.pub

# re-sign the latest commit
git commit --amend -S --no-edit

git push --force-with-lease
```

If needed, generate a dedicated signing key and add it to GitHub as a **Signing key**.
