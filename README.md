# 1stTab website

Static marketing website for [1stTab](https://1sttab-app.web.app), built with plain HTML, CSS, and JavaScript. Firebase Hosting serves the repository root.

## Preview locally

From the repository root, run:

```bash
python3 -m http.server 8766 --bind 127.0.0.1
```

Open [the local website](http://localhost:8766). Check affected pages at desktop and mobile widths and confirm relative links and assets work before opening an MR.

## GitHub Actions deployment pipeline

The workflow is [.github/workflows/deploy.yml](.github/workflows/deploy.yml).

| Event | Result |
| --- | --- |
| Push or merge into `integration` | No Firebase deployment |
| Push or merge into `main` | Deploy the checked-out website to Firebase Hosting |
| Extension release | No effect on this website repository |

The deployment job checks out the commit, installs `firebase-tools`, and runs `firebase deploy --only hosting --token … --project sttab-app`. It uses the `FIREBASE_TOKEN` repository secret. Repository variables are not used by this workflow.

## Set up Firebase deployment, step by step

1. Open [Firebase Console](https://console.firebase.google.com/) and select project ID **`sttab-app`**. The Hosting site ID is **`1sttab-app`**, served at [1sttab-app.web.app](https://1sttab-app.web.app). Project IDs matter even when projects have similar display names; do not substitute `sttab-495923` for this website workflow.
2. Confirm your Google account has permission to deploy Hosting to this project.
3. Install the Firebase CLI on your machine:

   ```bash
   npm install -g firebase-tools
   ```

4. Generate a CI token:

   ```bash
   firebase login:ci
   ```

   Complete the browser sign-in with the account from step 2. Save the token privately.
5. Open [repository Actions secrets](https://github.com/aleksandre-zaccone/1sttab-website/settings/secrets/actions). Choose **New repository secret**, or edit the existing secret. Set the name to `FIREBASE_TOKEN` and the value to the generated token. Use a **secret**, not a repository variable.
6. Alternatively, save it with GitHub CLI. The command prompts for the value; do not put the token in the command itself:

   ```bash
   gh auth login
   gh secret set FIREBASE_TOKEN --repo aleksandre-zaccone/1sttab-website
   ```

7. Confirm `firebase.json` still serves `public: "."` and selects Hosting site `1sttab-app`. If using a Hosting target instead, its `.firebaserc` mapping must resolve to that site. The workflow explicitly selects project `sttab-app`.

`FIREBASE_TOKEN` is the legacy authentication method used by the current workflow. Firebase recommends Application Default Credentials, such as service-account authentication, for CI. Adding a service-account secret alone does not switch the workflow; authentication commands must also be updated. See the [Firebase CLI CI instructions](https://firebase.google.com/docs/cli#use_the_cli_with_ci_systems).

## Deploy an update, step by step

1. Create a feature branch from `integration` and make the website changes.
2. Validate affected pages and open an MR from the feature branch to `integration`.
3. Merge that MR, then open an `integration` → `main` MR. Review all included changes.
4. Merge into `main`. This is the action that automatically starts the production deployment; no release tag is required.
5. Open [GitHub Actions](https://github.com/aleksandre-zaccone/1sttab-website/actions/workflows/deploy.yml) and wait for **Deploy to Firebase Hosting** to succeed.
6. Check the live website, including the changed pages. On a failure, inspect the deployment step before retrying.

You can inspect runs from CLI:

```bash
gh run list --repo aleksandre-zaccone/1sttab-website --workflow deploy.yml
gh run view RUN_ID --repo aleksandre-zaccone/1sttab-website --log-failed
```

Replace `RUN_ID` with the numeric run ID. The current workflow has no manual `workflow_dispatch` trigger. **Re-run jobs** on an existing run redeploys that run's original commit, not newer unmerged changes.

## Troubleshooting

- **Nothing deploys after an MR is merged:** confirm its target was `main`. Merging into `integration` does not trigger this workflow.
- **Missing/expired/revoked credentials:** generate a new CI token with `firebase login:ci`, replace `FIREBASE_TOKEN`, then rerun the intended deployment. Do not regenerate tokens merely because a build or configuration check failed.
- **Permission denied or wrong site:** verify the token owner's project access and the `sttab-app` / `1sttab-app` project and site IDs.
- **New page missing:** confirm it is committed, merged into `main`, and not excluded by `firebase.json` Hosting ignore rules.
- **Secret handling:** keep tokens out of source files, issue comments, logs, and chat. Store them in GitHub Actions secrets.

The extension has a separate publishing process: see its [README](https://github.com/aleksandre-zaccone/1stTab#github-actions-and-chrome-web-store-publishing).
