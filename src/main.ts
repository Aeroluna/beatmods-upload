import * as core from '@actions/core';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  BeatmodsAllMod,
  BeatmodsMod,
  getMod,
  getModsForVersion,
  getVersions
} from './beatmods.js';
import { getManifest } from './manifest.js';
import decompress from 'decompress';
import { satisfies } from 'semver';

/**
 * The main function for the action.
 *
 * @returns Resolves when the action is complete.
 */
export const run = async () => {
  const tmpDir: string = fs.mkdtempSync(path.join(os.tmpdir(), 'beatmods-'));
  try {
    const gameVersions = await getVersions();

    const modMap = JSON.parse(core.getInput('mods'));
    const beatmodsModsById: BeatmodsModsById = {};
    const beatmodsModsByVersion: BeatmodsModsByVersion = {};

    const files = await fs.promises.readdir('local_action/artifacts', {
      withFileTypes: true
    });
    await Promise.all(
      files.map(async (file) => {
        const fileName = file.name;
        const fullZipName = path.join(file.parentPath, file.name);
        if (!fileName.endsWith('.zip')) {
          core.info(`Skipping "${fileName}"...`);
          return;
        }

        const noExt = fileName.slice(0, fileName.lastIndexOf('.'));
        const subDir = path.join(tmpDir, noExt);
        await fs.promises.mkdir(subDir);
        const data = await fs.promises.readFile(fullZipName);
        await decompress(data, subDir);
        const assembly = (
          await fs.promises.readdir(path.join(subDir, 'Plugins'), {
            withFileTypes: true
          })
        ).find((m) => m.name.endsWith('.dll'));
        if (!assembly) {
          core.warning(`Could not find dll for "${fileName}"`);
          return;
        }

        const assemblyData = fs.readFileSync(
          path.join(assembly.parentPath, assembly.name)
        );
        const manifest = getManifest(assemblyData);
        core.debug(`Found manifest for "${fileName}"`);

        if (!(manifest.id in modMap)) {
          core.warning(
            `No Beatmods id provided for "${manifest.id}", skipping...`
          );
          return;
        }

        const id = modMap[manifest.id];
        let remoteMod;
        if (id in beatmodsModsById) {
          remoteMod = await beatmodsModsById[id];
        } else {
          const modPromise = getMod(id);
          beatmodsModsById[id] = modPromise;
          remoteMod = await modPromise;
          core.debug(`Found "${manifest.id}" on BeatMods`);
        }

        if (manifest.id != remoteMod.info.name) {
          core.warning(
            `Id mismatch, expected: "${manifest.id}", found: "${remoteMod.info.name}", skipping...`
          );
          return;
        }

        if (
          remoteMod.versions.some(
            (version) => version.modVersion == manifest.version
          )
        ) {
          core.warning(
            `Version "${manifest.id}@${manifest.version}" already exists on Beatmods, skipping...`
          );
          return;
        }

        const gameVersion = gameVersions.find(
          (n) => n.version == manifest.gameVersion
        );
        if (!gameVersion) {
          core.warning(
            `Game version "${manifest.gameVersion}" not found on Beatmods, skipping...`
          );
          return;
        }

        const version = gameVersion.version;
        let remoteMods;
        if (version in beatmodsModsByVersion) {
          remoteMods = await beatmodsModsByVersion[version];
        } else {
          const modPromise = getModsForVersion(version);
          beatmodsModsByVersion[version] = modPromise;
          remoteMods = await modPromise;
        }

        const dependencies = [];
        for (const depend in manifest.dependsOn) {
          const result = remoteMods.find((remote) => remote.mod.name == depend);
          if (!result) {
            core.warning(
              // I really hate this...
              // Should be able to just say which mod instead of the individual mod version
              // Obviously not a problem for most people... but extremely frustrating for me
              `Unable to resolve dependency "${depend}" for "${fileName}", skipping...`
            );
            return;
          }

          if (
            !satisfies(result.latest.modVersion, manifest.dependsOn[depend])
          ) {
            core.warning(
              `Invalid semver for "${depend}" for "${fileName}", skipping...`
            );
            return;
          }

          dependencies.push(result);
        }

        const json = {
          modVersion: manifest.version,
          platform: 'universalpc',
          dependencies: dependencies.map((n) => n.latest.id),
          supportedGameVersionIds: [gameVersion.id]
        };

        core.debug(JSON.stringify(json));
      })
    );
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) core.setFailed(error.message);
    throw error;
  } finally {
    try {
      if (tmpDir) {
        fs.rmSync(tmpDir, { recursive: true });
      }
    } catch (e) {
      console.error(
        `An error has occurred while removing the temp folder at [${tmpDir}]: ${e}`
      );
    }
  }
};

interface BeatmodsModsById {
  [key: number]: Promise<BeatmodsMod>;
}

interface BeatmodsModsByVersion {
  [key: string]: Promise<BeatmodsAllMod[]>;
}
