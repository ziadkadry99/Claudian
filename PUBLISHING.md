# Publishing Claudian to Obsidian Community Plugins

## Prerequisites

- Public GitHub repository with the plugin source
- `README.md` describing the plugin
- `LICENSE` file
- A GitHub Release tagged with the version (e.g. `1.0.0`) with `main.js`, `manifest.json`, and `styles.css` attached as release assets

## Steps

### 1. Push to GitHub

```bash
git init
git remote add origin https://github.com/ziadkadry/claudian
git add .
git commit -m "Initial release"
git push -u origin main
```

### 2. Create a GitHub Release

```bash
gh release create 1.0.0 main.js manifest.json styles.css \
  --title "1.0.0" \
  --notes "Initial release"
```

Or do it manually via GitHub UI: **Releases → Draft a new release → Tag: 1.0.0** → attach `main.js`, `manifest.json`, `styles.css`.

### 3. Fork obsidian-releases

Fork https://github.com/obsidianmd/obsidian-releases

### 4. Add entry to community-plugins.json

Add at the end of the array in `community-plugins.json`:

```json
{
  "id": "claudian",
  "name": "Claudian",
  "author": "Ziad Kadry",
  "description": "Run Claude Code CLI from within Obsidian to read and write your vault.",
  "repo": "ziadkadry/claudian"
}
```

### 5. Open a Pull Request

Open a PR from your fork to `obsidianmd/obsidian-releases`. Switch to **Preview** mode and select the plugin submission checklist. Complete all checklist items.

### 6. Wait for Review

The Obsidian team reviews against their [plugin guidelines](https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines). Once approved, Claudian will appear in the community plugins list.

## Releasing Updates

For each new version:
1. Update `version` in `manifest.json`
2. Rebuild: `npm run build`
3. Create a new GitHub Release tagged with the new version, attaching the updated `main.js`, `manifest.json`, `styles.css`

Obsidian fetches release assets by matching the tag to the version in `manifest.json`.
