# SSH Key Handling Policy

Status: Canonical security rule
Branch owner: platform
Last updated: 2026-06-16

## 1. Rule

Never commit SSH private keys to this repository.

Private keys include files such as:

```text
*.key
*.pem
*.ppk
id_rsa
id_ed25519
ssh-key*
deploy_key*
```

These files must stay outside Git.

## 2. Correct place for VPS SSH keys

A developer's local SSH key should stay on the developer machine only, for example:

```text
C:\Users\<user>\.ssh\vlgn-vps.key
```

or another local-only private folder.

Do not copy private keys into:

```text
repo root
backend/
src/
docs/
scripts/
infra/
```

## 3. Correct usage from Windows PowerShell

Use the key directly from its local path:

```powershell
ssh -i "F:\path\to\ssh-key.key" ubuntu@40.233.83.234
```

If permissions are rejected on Windows, restrict the key ACL before using it.

## 4. Correct usage from scripts

Scripts must accept the key path as an environment variable or argument.

Example:

```powershell
$env:VLGN_SSH_KEY="F:\path\to\ssh-key.key"
```

Then scripts should read `VLGN_SSH_KEY` without printing it.

## 5. GitHub Actions or CI

If CI/CD later needs SSH access, store the private key as a GitHub Secret, not as a file in the repository.

Allowed:

```text
GitHub repository secret: VPS_SSH_PRIVATE_KEY
GitHub repository secret: VPS_HOST
GitHub repository secret: VPS_USER
```

Forbidden:

```text
committed private key file
committed .env with key content
committed deployment credential dump
```

## 6. Public keys

Public keys can be copied to the server's `authorized_keys`, but they should still be handled carefully.

Private key stays local.
Public key goes to the server.

## 7. If a private key was committed by mistake

If a private key is ever committed:

```text
1. Treat it as compromised immediately.
2. Remove the key from the VPS authorized_keys.
3. Generate a new SSH key pair.
4. Add only the new public key to the VPS.
5. Remove the committed secret from Git history if required.
6. Do not reuse the leaked key.
```
