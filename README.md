# Transments

> A lightweight, polished image format converter built with Electron.

Transments is a fast desktop image converter for everyday format migration, folder-based batch work, and clean local image workflows. It uses a lean Electron stack with a Telegram-inspired interface: calm, direct, responsive, and polished without getting in the way.

## Preview

![Transments UI preview](preview/main.png)

The interface is organized around four practical zones:

- Source selection: choose individual images, scan a folder, filter by input format, and include subfolders.
- Output settings: choose the target format, prefer lossless encoding, control overwrites, and select an output folder.
- Batch queue: review files, paths, and per-file conversion status.
- Action bar: track progress, cancel work, and start conversion.

## Highlights

- **Lightweight desktop app**: plain HTML/CSS/JS renderer with no frontend build pipeline.
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
|   `-- main.png
|-- scripts
|   `-- capture-preview.js
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
`-- README.md
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

Regenerate the README preview screenshot:

```bash
npm run capture:preview
```

## Usage

1. Click **Choose Images** to add individual files, or click **Choose Folder** to scan a directory.
2. Use **Scan Filter** to target a specific source format, such as PNG or HEIC.
3. Enable **Include Subfolders** when you want recursive folder processing.
4. Choose a target format in the **Output** section.
5. Click **Choose Output Folder** to select where converted files should be written.
6. Click **Start Conversion** and watch progress in the queue.

## Design Notes

Transments is designed as a practical productivity tool, not a landing page. The visual system takes cues from Telegram desktop:

- A dark left rail keeps source and output controls grouped together.
- A bright workspace keeps the queue readable and scannable.
- Buttons, selects, checkboxes, queue rows, and status elements use smooth hover, active, and focus transitions.
- Button hover states include subtle scale and shadow changes for a premium tactile feel.
- The font stack prefers `HarmonyOS Sans SC`, with strong weights throughout for crisp desktop readability.

## Development Notes

Conversion logic lives in `src/main/converter-service.js`:

- `scanFolder()` scans directories by source format.
- `start()` schedules batch conversion work.
- `convertOne()` handles one file at a time.
- HEIC input is decoded into RGBA with `heic-decode`.
- HEIC output is produced through the `elheif` WASM encoder.

The renderer communicates with the main process through the preload-exposed `window.transments` API. `contextIsolation` stays enabled, so Node capabilities are not exposed directly to the UI.

## Roadmap

- Add a quick action to open the output folder after conversion.
- Add drag-and-drop import for files and folders.
- Add conversion history.
- Add output filename templates.
- Add app packaging and installer generation.
- Add more real-world image fixtures for test coverage.

## License

MIT
