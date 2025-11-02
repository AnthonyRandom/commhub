# Auto-Update Setup Guide

This guide explains how to set up automatic updates for CommHub so your friends don't need manual app rebuilds.

## How It Works

CommHub now has a built-in auto-updater that:

- Checks for new versions on GitHub Releases
- Downloads and installs updates automatically
- Only requires a one-time setup

## Initial Setup (One Time)

### Step 1: Build and Create GitHub Release

1. **Build the app for the FIRST TIME** (v1.0.1):

   ```bash
   cd packages/client
   npm run tauri build
   ```

2. **Locate the built files** in `packages/client/src-tauri/target/release/bundle/`:
   - Windows: `CommHub_1.0.1_x64_en-US.msi` (installer) or `.exe` (portable)
   - The `.msi.zip` file

3. **Create a GitHub Release**:
   - Go to https://github.com/AnthonyRandom/commhub/releases
   - Click "Create a new release"
   - Tag: `v1.0.1`
   - Title: `v1.0.1 - Auto-Update Release`
   - Upload these files:
     - `CommHub_1.0.1_x64_en-US.msi` (or .exe)
     - `CommHub_1.0.1_x64_en-US.msi.zip`

4. **Create the `latest.json` file**:
   Create a file named `latest.json` with this content:

   ```json
   {
     "version": "1.0.1",
     "notes": "Auto-update feature added with live message/member updates and signup validation",
     "pub_date": "2025-11-02T00:00:00Z",
     "platforms": {
       "windows-x86_64": {
         "signature": "",
         "url": "https://github.com/AnthonyRandom/commhub/releases/download/v1.0.1/CommHub_1.0.1_x64_en-US.msi.zip"
       }
     }
   }
   ```

   - Upload this `latest.json` file to the same release

5. **Publish the release**

6. **Distribute to friends**: Send them the `.msi` installer or `.exe` portable file

## Future Updates (The Easy Way!)

### For You (Developer):

1. **Make your code changes** (features, bug fixes, etc.)

2. **Bump the version** in `packages/client/src-tauri/tauri.conf.json`:

   ```json
   "version": "1.0.2"  // Increment this
   ```

3. **Commit and push** to GitHub:

   ```bash
   git add -A
   git commit -m "feat: your new feature description"
   git push origin main
   ```

4. **Build the new version**:

   ```bash
   cd packages/client
   npm run tauri build
   ```

5. **Create a new GitHub Release** (same as Step 1, but with new version):
   - Tag: `v1.0.2`
   - Upload the new `.msi` and `.msi.zip` files
   - Update and upload new `latest.json`:
     ```json
     {
       "version": "1.0.2",
       "notes": "Your update description here",
       "pub_date": "2025-11-03T00:00:00Z",
       "platforms": {
         "windows-x86_64": {
           "signature": "",
           "url": "https://github.com/AnthonyRandom/commhub/releases/download/v1.0.2/CommHub_1.0.2_x64_en-US.msi.zip"
         }
       }
     }
     ```

### For Your Friends (Users):

**They do NOTHING!** 🎉

The app automatically:

1. Checks for updates when they click the Settings button → "Check for Updates"
2. Shows them a notification if an update is available
3. Downloads and installs with one click
4. Restarts automatically

## Settings Location

Users can access updates from:

1. Click the **Settings gear icon** (⚙️) next to the Logout button at the bottom of the channel list
2. Click "Check for Updates"
3. If an update is available, click "Install Update"
4. App restarts automatically with the new version!

## Important Notes

### Do You Still Need to Rebuild?

**For THIS update (v1.0.1):** ✅ YES

- This is the LAST time you'll need to manually distribute
- Your friends need this version to get future auto-updates

**For FUTURE updates:** ❌ NO

- Just create GitHub releases as described above
- Your friends get updates automatically through the app

### Backend vs Frontend

- **Backend changes**: Auto-deploy via Railway (no rebuild needed)
- **Frontend changes**: Auto-update via GitHub Releases (one-click for users)

### Version Numbering

Follow semantic versioning:

- `1.0.0` → `1.0.1`: Bug fixes
- `1.0.0` → `1.1.0`: New features
- `1.0.0` → `2.0.0`: Breaking changes

### Testing Updates

Before distributing to friends:

1. Build and release v1.0.1
2. Have friends install it
3. Test by releasing v1.0.2 and having them check for updates

## Troubleshooting

**"Failed to check for updates":**

- Ensure the GitHub release is public
- Verify the `latest.json` URL is correct
- Check that the `.msi.zip` file is uploaded

**Update doesn't install:**

- Make sure the signature field in `latest.json` matches (leave empty for now)
- Verify the file URL is accessible
- Check if antivirus is blocking the download

## Security Note

The `pubkey` field in `tauri.conf.json` is currently empty. For production, you should:

1. Generate a keypair: `npm run tauri signer generate`
2. Add the public key to `tauri.conf.json`
3. Sign releases with the private key
4. Add signatures to `latest.json`

For now, the updater works without signatures for testing.

## Summary

**One-time effort:** Build v1.0.1, create GitHub release, distribute to friends  
**Future updates:** Bump version, build, create release → Friends get it automatically  
**Result:** No more manual distribution! 🚀
