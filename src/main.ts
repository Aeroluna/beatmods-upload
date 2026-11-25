import * as core from '@actions/core';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  LunarRepoMod,
  LunarRepoModVersionUpload,
  getMod,
  getVersions,
  uploadMod
} from './lunarrepo.js';
import { getManifest, Manifest } from './manifest.js';
import decompress from 'decompress';
import semver from 'semver';
import { groupBy } from './groupBy.js';

/**
 * The main function for the action.
 *
 * @returns Resolves when the action is complete.
 */
export const run = async () => {
  const tmpDir: string = fs.mkdtempSync(path.join(os.tmpdir(), 'lunarrepo-'));
  try {
    const gameVersions = (await getVersions()).filter((n) => semver.valid(n));

    const modMap = JSON.parse(core.getInput('mods'));

    interface LunarRepoModsById {
      [key: string]: Promise<LunarRepoMod>;
    }

    let lunarRepoModsById: LunarRepoModsById = {};

    interface ModToUpload {
      id: string;
      order: number;
      data: Buffer;
      file: fs.Dirent;
      manifest: Manifest;
      gameVersion: string;
    }

    interface FoundGameVersions {
      [key: string]: string[];
    }

    const foundGameVersions: FoundGameVersions = {};
    const modsToUpload: ModToUpload[] = [];

    const files = await fs.promises.readdir(core.getInput('path'), {
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

        let assembly;

        const pluginsDir = path.join(subDir, 'Plugins');
        if (fs.existsSync(pluginsDir)) {
          assembly = (
            await fs.promises.readdir(pluginsDir, {
              withFileTypes: true
            })
          ).find((m) => m.name.endsWith('.dll'));
        }

        if (!assembly) {
          core.warning(`Could not find dll for "${fileName}", skipping...`);
          return;
        }

        const assemblyData = fs.readFileSync(
          path.join(assembly.parentPath, assembly.name)
        );
        const manifest = getManifest(assemblyData);
        core.debug(`Found manifest for "${fileName}"`);

        foundGameVersions[manifest.id] ??= [];
        foundGameVersions[manifest.id].push(manifest.gameVersion);

        if (!(manifest.id in modMap)) {
          core.warning(
            `No LunarRepo id provided for "${manifest.id}", skipping...`
          );
          return;
        }

        const id: string = modMap[manifest.id];
        let remoteMod;
        if (id in lunarRepoModsById) {
          remoteMod = await lunarRepoModsById[id];
        } else {
          const modPromise = getMod(id);
          lunarRepoModsById[id] = modPromise;
          remoteMod = await modPromise;
          core.debug(`Found "${manifest.id}" on LunarRepo`);
        }

        if (manifest.id != remoteMod.name) {
          core.warning(
            `Id mismatch, expected: "${manifest.id}", found: "${remoteMod.name}", skipping...`
          );
          return;
        }

        if (
          remoteMod.versions.some(
            (version) => version.version == manifest.version
          )
        ) {
          core.warning(
            `Version ${manifest.id}@${manifest.version} already exists on LunarRepo, skipping...`
          );
          return;
        }

        const gameVersion = gameVersions.find((n) => n == manifest.gameVersion);
        if (!gameVersion) {
          core.warning(
            `Game version ${manifest.gameVersion} not found on LunarRepo, skipping...`
          );
          return;
        }

        modsToUpload.push({
          id: id,
          order: 0,
          data: data,
          file: file,
          manifest: manifest,
          gameVersion: gameVersion
        });
      })
    );

    interface LatestGameVersions {
      [key: string]: string;
    }

    const extendGameVersions = core.getInput('extend-game-versions');
    const latestGameVersions: LatestGameVersions = {};
    for (const mod in foundGameVersions) {
      foundGameVersions[mod].sort(semver.compare);
      const modGameVersions = foundGameVersions[mod];
      latestGameVersions[mod] = modGameVersions[modGameVersions.length - 1];
    }

    for (const mods of groupBy(
      modsToUpload,
      (mod) => mod.gameVersion
    ).values()) {
      for (let changed = true; changed; ) {
        changed = false;

        mods.forEach((mod) => {
          const orders = Object.keys(mod.manifest.dependsOn)
            .map((depend) => {
              const dependMod = mods.find((n) => n.manifest.id == depend);
              if (dependMod) {
                return dependMod.order + 1;
              }
            })
            .filter((n) => n != null);

          let newOrder;
          if (!orders || orders.length == 0) {
            newOrder = 0;
          } else {
            newOrder = Math.max(...orders);
          }

          if (mod.order != newOrder) {
            mod.order = newOrder;
            changed = true;
          }
        });
      }

      for (const group of groupBy(
        mods.sort((a, b) => a.order - b.order),
        (n) => n.order
      ).values()) {
        await Promise.all(
          group.map(async (mod) => {
            const manifest = mod.manifest;
            const fileName = mod.file.name;
            const gameVersion = mod.gameVersion;

            let supportedGameVersions: string[] = [];
            switch (extendGameVersions) {
              case 'all':
                {
                  const modGameVersions = foundGameVersions[manifest.id];
                  const index = modGameVersions.findIndex(
                    (n) => n == gameVersion
                  );
                  if (index >= modGameVersions.length - 1) {
                    supportedGameVersions = gameVersions.filter((n) =>
                      semver.gte(n, gameVersion)
                    );
                  } else {
                    const nextVersion = modGameVersions[index + 1];
                    supportedGameVersions = gameVersions.filter(
                      (n) =>
                        semver.gte(n, gameVersion) && semver.lt(n, nextVersion)
                    );
                  }
                }
                break;
              case 'latest':
                if (latestGameVersions[manifest.id] == manifest.gameVersion) {
                  supportedGameVersions = gameVersions.filter((n) =>
                    semver.gte(n, gameVersion)
                  );
                } else {
                  supportedGameVersions = [gameVersion];
                }
                break;
              default:
                supportedGameVersions = [gameVersion];
                break;
            }

            const json: LunarRepoModVersionUpload = {
              fileName: fileName,
              file: mod.data,
              channel: 'Release',
              gameVersions: supportedGameVersions
            };

            core.debug(`Uploading "${fileName}"...`);
            await uploadMod(mod.id.toString(), json);
            core.info(`Uploaded ${manifest.id}@${manifest.version}`);
          })
        );

        // Clear cache so we can re-fetch new depends
        lunarRepoModsById = {};
      }
    }
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) {
      core.setFailed(error.message);
    }

    throw error;
  } finally {
    try {
      if (tmpDir) {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    } catch (e) {
      /* istanbul ignore next */
      console.error(
        `An error has occurred while removing the temp folder at ${tmpDir}: ${e}`
      );
    }
  }
};
