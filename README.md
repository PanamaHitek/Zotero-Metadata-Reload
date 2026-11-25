# Metadata Reload for Zotero

Refresh the title, authors, publication date, and other citation details of existing Zotero items using their DOIs. Metadata Reload uses Zotero's built-in identifier lookup and saves the results to the selected records. Attachments, notes, tags, collections, and related items stay linked.

## Install

Metadata Reload supports Zotero Desktop 8.0 through 10.0.x.

1. Download `metadata-reload-1.0.xpi` from the [v1.0 release](https://github.com/PanamaHitek/Zotero-Metadata-Reload/releases/tag/v1.0) or build it from source.
2. Open **Tools → Plugins** in Zotero.
3. Drag the `.xpi` into the Plugins window and confirm the installation.

If you installed an earlier development build, remove it in **Tools → Plugins** before installing the public release. The release has its own add-on ID.

## Use

1. Select one or more editable library items.
2. Right-click the selection and choose **Reload Metadata**.
3. Check the results dialog when the lookup finishes. For multiple items, it reports how many were updated, already current, skipped, or failed.

The command uses the **DOI** field or a `DOI:` line in **Extra**. It replaces citation fields and creator lists when the lookup supplies new values, and keeps existing values for fields missing from the result. Items without a usable DOI and items in read-only libraries are skipped. Metadata reloads only when you run the command.

## Build from source

From the repository root, run the build script in PowerShell 5.1 or later. On Windows, this command sets the execution policy for the build process only.

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\build.ps1
```

On macOS or Linux with PowerShell installed, run `pwsh -NoProfile -File ./build.ps1`.

The script reads the version from `manifest.json` and writes the installable package to `dist/metadata-reload-<version>.xpi`. Upload that file as a GitHub release asset.
