# Transments

> A lightweight, polished image format converter built with Electron.

Transments is a fast desktop image converter for everyday format migration, folder-based batch work, and clean local image workflows. It uses a lean Electron stack with a Telegram-inspired interface: calm, direct, responsive, bilingual, and polished without getting in the way.

## Languages

- English: this file
- Chinese: [README.zh-CN.md](README.zh-CN.md)

The app supports in-app language switching between English and Chinese from the language/settings button in the top-right toolbar.

## Preview

![Transments English UI preview](preview/main.png)

The interface is organized around five practical zones:

- Source selection: choose individual images, scan a folder, drag in files or folders, filter by input format, and include subfolders.
- Output settings and presets: apply conversion presets, choose the target format, prefer lossless encoding, control overwrites, and select an output folder.
- Batch queue: review files, paths, and per-file conversion status.
- Results panel: see a completion summary, failed files, and open the output folder immediately.
- Action bar: track progress, cancel work, and start conversion.

## Highlights

- **Lightweight desktop app**: plain HTML/CSS/JS renderer with no frontend build pipeline.
- **Bilingual interface**: switch between English and Chinese inside the app.
- **Drag-and-drop import**: drop image files or folders into the queue area, using the current filter and recursive setting.
- **Conversion presets**: one-click workflows for WebP archiving, JPEG sharing, HEIC-to-PNG, and AVIF batch conversion.
- **Post-conversion results**: review success/failure counts, failed filenames, and open the output folder directly.
- **Batch folder conversion**: scan an entire folder and convert only the source format you need.
- **Custom output location**: send converted files exactly where you want them.
- **Recursive scanning**: include subfolders while preserving relative directory structure.
- **Common format conversion**: PNG, JPEG, WebP, TIFF, AVIF, GIF, and BMP.
- **HEIC support**: decode HEIC/HEIF input and encode HEIC output through a WASM encoder.
- **Premium Telegram-style UI**: dark navigation rail, clean workspace, smooth interaction states, and a HarmonyOS Sans SC-first font stack.

## Format Support

| Format | Input | Output | Notes |
| --- | --- | --- | --- |
| PNG | Yes | Yes | Best for transparent and lossless workflows |
| JPEG / JPG | Yes | Yes | Encoded with high-quality settings |
| WebP | Yes | Yes | Supports lossless output |
| TIFF / TIF | Yes | Yes | Uses LZW compression |
| AVIF | Yes | Yes | Supports lossless output |
| GIF | Yes | Yes | Handles common static and animated input scenarios |
| BMP | Yes | Yes | Uses a built-in BMP writer |
| HEIC / HEIF | Yes | Yes | HEIC decode plus WASM HEIC encode |

## Tech Stack

- **Electron**: desktop runtime
- **Sharp**: high-performance image processing
- **heic-decode**: HEIC/HEIF input decoding
- **elheif**: WASM HEIC encoding
- **Vanilla HTML/CSS/JS**: lean renderer with no extra UI framework

## Project Structure

```text
Transments
|-- preview
|   |-- main.png
|   `-- main.zh-CN.png
|-- scripts
|   |-- capture-preview.js
|   `-- verify-i18n.js
|-- src
|   |-- main
|   |   |-- index.js
|   |   `-- converter-service.js
|   |-- preload
|   |   `-- index.js
|   `-- renderer
|       |-- index.html
|       |-- renderer.js
|       `-- styles.css
|-- test
|   `-- converter.test.js
|-- package.json
|-- README.md
`-- README.zh-CN.md
```

## Getting Started

Install dependencies:

```bash
npm install
```

Start the app:

```bash
npm start
```

Run tests:

```bash
npm test
```

Verify in-app language switching:

```bash
npm run verify:i18n
```

Regenerate preview screenshots:

```bash
npm run capture:preview:all
```

Generate only the English preview:

```bash
npm run capture:preview:en
```

Generate only the Chinese preview:

```bash
npm run capture:preview:zh
```

## Usage

1. Click **Choose Images** to add individual files, or click **Choose Folder** to scan a directory.
2. Drag images or folders into the queue area when you want a faster import path.
3. Use **Scan Filter** to target a specific source format, such as PNG or HEIC.
4. Apply a preset, or manually choose a target format in the **Output** section.
5. Enable **Include Subfolders** when you want recursive folder processing.
6. Click **Choose Output Folder** to select where converted files should be written.
7. Click **Start Conversion** and watch progress in the queue.
8. Review the **Conversion Results** panel, then open the output folder directly if needed.
9. Use the language/settings button in the top-right toolbar to switch between English and Chinese.

## Design Notes

Transments is designed as a practical productivity tool, not a landing page. The visual system takes cues from Telegram desktop:

- A dark left rail keeps source and output controls grouped together.
- A bright workspace keeps the queue readable and scannable.
- Buttons, selects, checkboxes, queue rows, and status elements use smooth hover, active, and focus transitions.
- Preset cards keep frequent workflows visible without forcing extra dialogs.
- Drag-and-drop feedback appears directly over the queue, where the imported files will land.
- Button hover states include subtle scale and shadow changes for a premium tactile feel.
- The font stack prefers `HarmonyOS Sans SC`, with strong weights throughout for crisp desktop readability in both languages.

## Development Notes

Conversion logic lives in `src/main/converter-service.js`:

- `scanFolder()` scans directories by source format.
- `resolvePaths()` turns dropped files and folders into a deduplicated conversion queue.
- `start()` schedules batch conversion work.
- `convertOne()` handles one file at a time.
- HEIC input is decoded into RGBA with `heic-decode`.
- HEIC output is produced through the `elheif` WASM encoder.

The renderer communicates with the main process through the preload-exposed `window.transments` API. `contextIsolation` stays enabled, so Node capabilities are not exposed directly to the UI.

## Roadmap

- Add conversion history.
- Add output filename templates.
- Add signed installer generation.
- Add more real-world image fixtures for test coverage.

## License

MIT
