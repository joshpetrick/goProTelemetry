# GoPro MP4 GPS Exporter

Small Node.js utility that reads a GoPro `.mp4` and exports GPS telemetry to JSON using [`gpmf-extract`](https://www.npmjs.com/package/gpmf-extract) + [`gopro-telemetry`](https://www.npmjs.com/package/gopro-telemetry).

## Requirements

- Node.js 18+

## Install

```bash
npm install
```

## Usage

```bash
node extract-gps.js /path/to/video.mp4 /path/to/output.json
```

Optional third argument controls MP4 read chunk size in MB (default `8`):

```bash
node extract-gps.js /path/to/video.mp4 /path/to/output.json 8
```

If you omit the output path, it writes to `gps-data.json` in the current directory.

## Large-file memory notes

This script reads the MP4 in chunks instead of loading the full video into memory, which helps avoid Node heap crashes on large files.

If your file is still very large, you can also raise Node heap size when running:

```bash
node --max-old-space-size=8192 extract-gps.js /path/to/video.mp4 /path/to/output.json
```

## Output shape

Each JSON entry includes:

- `device`
- `stream` (`GPS5` or `GPS9`)
- `timestamp`
- `cts`
- `latitude`
- `longitude`
- `altitude`
- `speed2d`
- `speed3d`

## Example

```json
[
  {
    "device": "1",
    "stream": "GPS5",
    "timestamp": "2024-05-31T18:22:07.000Z",
    "cts": 0,
    "latitude": 37.7749,
    "longitude": -122.4194,
    "altitude": 15.2,
    "speed2d": 0.4,
    "speed3d": 0.5
  }
]
```
