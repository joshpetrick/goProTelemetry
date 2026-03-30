#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import gpmfExtract from 'gpmf-extract';
import goproTelemetry from 'gopro-telemetry';

async function main() {
  const [inputPathArg, outputPathArg] = process.argv.slice(2);

  if (!inputPathArg) {
    console.error('Usage: node extract-gps.js <input.mp4> [output.json]');
    process.exit(1);
  }

  const inputPath = path.resolve(inputPathArg);
  const outputPath = path.resolve(outputPathArg ?? 'gps-data.json');

  const inputBuffer = await fs.readFile(inputPath);
  const extracted = await gpmfExtract(inputBuffer);

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
