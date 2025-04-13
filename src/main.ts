import * as core from '@actions/core';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  BeatmodsAllMod,
  BeatmodsGameVersion,
  BeatmodsMod,
  BeatmodsModVersionUpload,
  getMod,
  getModsForVersion,
  getVersions,
  uploadMod
} from './beatmods.js';
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
  const tmpDir: string = fs.mkdtempSync(path.join(os.tmpdir(), 'beatmods-'));
  try {
    const gameVersions = await getVersions();

    const modMap = JSON.parse(core.getInput('mods'));

    interface BeatmodsModsById {
      [key: number]: Promise<BeatmodsMod>;
    }

    interface BeatmodsModsByVersion {
      [key: string]: Promise<BeatmodsAllMod[]>;
    }

    let beatmodsModsById: BeatmodsModsById = {};
    const beatmodsModsByVersion: BeatmodsModsByVersion = {};

    interface ModToUpload {
      id: number;
      order: number;
      data: Buffer;
      file: fs.Dirent;
      manifest: Manifest;
      gameVersion: BeatmodsGameVersion;
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
            `No Beatmods id provided for "${manifest.id}", skipping...`
          );
          return;
        }

        const id: number = modMap[manifest.id];
        let remoteMod;
        if (id in beatmodsModsById) {
          remoteMod = await beatmodsModsById[id];
        } else {
          const modPromise = getMod(id.toString());
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
            `Version ${manifest.id}@${manifest.version} already exists on Beatmods, skipping...`
          );
          return;
        }

        const gameVersion = gameVersions.find(
          (n) => n.version == manifest.gameVersion
        );
        if (!gameVersion) {
          core.warning(
            `Game version ${manifest.gameVersion} not found on Beatmods, skipping...`
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
      (mod) => mod.gameVersion.id
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

            const dependencies: number[] = [];
            for (const depend in manifest.dependsOn) {
              const dependRange = manifest.dependsOn[depend];

              // if we know the mod's id, use that instead
              if (depend in modMap) {
                const id = modMap[depend];
                let beatmodDepend;
                if (id in beatmodsModsById) {
                  beatmodDepend = await beatmodsModsById[id];
                } else {
                  const modPromise = getMod(id);
                  beatmodsModsById[id] = modPromise;
                  beatmodDepend = await modPromise;
                  core.debug(`Found "${depend}" on BeatMods`);
                }

                const dependVersion = beatmodDepend.versions.find(
                  (n) =>
                    n.supportedGameVersions.some(
                      (m) => m.id == gameVersion.id
                    ) && semver.satisfies(n.modVersion, dependRange)
                );

                if (!dependVersion) {
                  core.warning(
                    `No valid version found for "${depend}" for "${fileName}", skipping...`
                  );
                  return;
                }

                dependencies.push(dependVersion.id);
              } else {
                const version = gameVersion.version;

                let remoteMods;
                if (version in beatmodsModsByVersion) {
                  remoteMods = await beatmodsModsByVersion[version];
                } else {
                  core.debug(`Getting Beatmods mods for ${version}`);
                  const modPromise = getModsForVersion(version);
                  beatmodsModsByVersion[version] = modPromise;
                  remoteMods = await modPromise;
                }

                const result = remoteMods.find(
                  (remote) => remote.mod.name == depend
                );
                if (!result) {
                  core.warning(
                    `Unable to resolve dependency "${depend}" for "${fileName}", skipping...`
                  );
                  return;
                }

                // Would prefer being able to just use the mod id instead of having to fetch individual mod versions
                // Obviously not a problem for most people... but extremely frustrating for me
                if (!semver.satisfies(result.latest.modVersion, dependRange)) {
                  core.warning(
                    `Invalid semver for "${depend}" for "${fileName}", skipping...`
                  );
                  return;
                }

                dependencies.push(result.latest.id);
              }
            }

            let supportedGameVersionIds: number[] = [];
            switch (extendGameVersions) {
              case 'all':
                {
                  const modGameVersions = foundGameVersions[manifest.id];
                  const index = modGameVersions.findIndex(
                    (n) => n == gameVersion.version
                  );
                  if (index >= modGameVersions.length - 1) {
                    supportedGameVersionIds = gameVersions
                      .filter((n) => semver.gte(n.version, gameVersion.version))
                      .map((n) => n.id);
                  } else {
                    const nextVersion = modGameVersions[index + 1];
                    supportedGameVersionIds = gameVersions
                      .filter(
                        (n) =>
                          semver.gte(n.version, gameVersion.version) &&
                          semver.lt(n.version, nextVersion)
                      )
                      .map((n) => n.id);
                  }
                }
                break;
              case 'latest':
                if (latestGameVersions[manifest.id] == manifest.gameVersion) {
                  supportedGameVersionIds = gameVersions
                    .filter((n) => semver.gte(n.version, gameVersion.version))
                    .map((n) => n.id);
                } else {
                  supportedGameVersionIds = [gameVersion.id];
                }
                break;
              default:
                supportedGameVersionIds = [gameVersion.id];
                break;
            }

            const json: BeatmodsModVersionUpload = {
              file: mod.data,
              fileName: fileName,
              modVersion: manifest.version,
              platform: 'universalpc',
              dependencies: dependencies,
              supportedGameVersionIds: supportedGameVersionIds
            };

            core.debug(`Uploading "${fileName}"...`);
            await uploadMod(mod.id.toString(), json);
            core.info(`Uploaded ${manifest.id}@${manifest.version}`);
          })
        );

        // Clear cache so we can re-fetch new depends
        beatmodsModsById = {};
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
