#!/usr/bin/env node

import { createReadStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import gpmfExtract from 'gpmf-extract';
import goproTelemetry from 'gopro-telemetry';

async function main() {
  const [inputPathArg, outputPathArg, chunkSizeMbArg] = process.argv.slice(2);

  if (!inputPathArg) {
    console.error('Usage: node extract-gps.js <input.mp4> [output.json] [chunkSizeMb]');
    process.exit(1);
  }

  const inputPath = path.resolve(inputPathArg);
  const outputPath = path.resolve(outputPathArg ?? 'gps-data.json');
  const chunkSizeMb = Number(chunkSizeMbArg ?? 8);

  if (!Number.isFinite(chunkSizeMb) || chunkSizeMb <= 0) {
    console.error('chunkSizeMb must be a positive number, e.g. 8');
    process.exit(1);
  }

  const extracted = await gpmfExtract(createMp4ChunkReader(inputPath, chunkSizeMb));

  const telemetry = await goproTelemetry(extracted, {
    stream: ['GPS5', 'GPS9'],
    groupTimes: 'frames',
    timeIn: 'GPS',
    preset: 'default',
    tolerant: true,
    promisify: true
  });

  const interpreted = normalizeGps(telemetry);
  await fs.writeFile(outputPath, JSON.stringify(interpreted, null, 2), 'utf-8');

  console.log(`Wrote ${interpreted.length} GPS points to ${outputPath}`);
}

function createMp4ChunkReader(filePath, chunkSizeMb = 8) {
  const chunkSize = Math.round(chunkSizeMb * 1024 * 1024);

  return (mp4boxFile) => {
    let fileStart = 0;
    const stream = createReadStream(filePath, { highWaterMark: chunkSize });

    stream.on('data', (chunk) => {
      stream.pause();
      const arrayBuffer = chunk.buffer.slice(chunk.byteOffset, chunk.byteOffset + chunk.byteLength);
      arrayBuffer.fileStart = fileStart;
      fileStart += chunk.byteLength;
      mp4boxFile.appendBuffer(arrayBuffer);
      stream.resume();
    });

    stream.on('end', () => {
      mp4boxFile.flush();
    });

    stream.on('error', (error) => {
      if (typeof mp4boxFile.onError === 'function') {
        mp4boxFile.onError(error);
      }
    });
  };
}

function normalizeGps(telemetry) {
  const rows = [];

  for (const [deviceName, streams] of Object.entries(telemetry ?? {})) {
    for (const [streamName, samples] of Object.entries(streams ?? {})) {
      if (!Array.isArray(samples) || !streamName.startsWith('GPS')) {
        continue;
      }

      for (const sample of samples) {
        const value = sample?.value;
        if (!Array.isArray(value) || value.length < 3) {
          continue;
        }

        const [latitude, longitude, altitude, speed2d, speed3d] = value;
        rows.push({
          device: deviceName,
          stream: streamName,
          timestamp: sample.date ?? null,
          cts: sample.cts ?? null,
          latitude,
          longitude,
          altitude,
          speed2d: speed2d ?? null,
          speed3d: speed3d ?? null
        });
      }
    }
  }

  return rows;
}

main().catch((error) => {
  console.error('Failed to extract GPS telemetry.');
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
