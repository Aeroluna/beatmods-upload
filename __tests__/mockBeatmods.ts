import { jest } from '@jest/globals';
import {
  readTestFileSync,
  testExistsSync,
  testFilesDirectory
} from './testFiles';
import fs from 'fs';
import path from 'path';

const fetchMock = jest.fn(global.fetch);
global.fetch = fetchMock;

interface ModData {
  // eslint-disable-next-line  @typescript-eslint/no-explicit-any
  [key: string]: any;
}

const versions = JSON.parse(
  readTestFileSync('beatmods_versions.json').toString()
);

let incrementalId = 5000;
let modData: ModData = {};

fs.readdirSync(testFilesDirectory, { withFileTypes: true }).forEach((file) => {
  if (file.name.startsWith('beatmods_mod_')) {
    modData[file.name.substring(13).split('.')[0]] = JSON.parse(
      fs.readFileSync(path.join(file.parentPath, file.name), 'utf8')
    );
  }
});

const original = JSON.parse(JSON.stringify(modData));

export const mockFetchBeatmods = () => {
  fetchMock.mockImplementation(
    (input: string | URL | globalThis.Request, init?: RequestInit) => {
      const headers = init?.headers;
      if (!headers || !('User-Agent' in headers) || !headers['User-Agent']) {
        return Promise.resolve(
          new Response('you must specify a User-Agent header', { status: 403 })
        );
      }

      if (typeof input === 'string') {
        if (init.method == 'POST') {
          if (
            input.startsWith('https://beatmods.com/api/mods/') &&
            input.endsWith('/upload')
          ) {
            if (!(init.body instanceof FormData)) {
              throw new Error('Cannot upload without FormData');
            }

            if (!('Authorization' in headers) || !headers['Authorization']) {
              return Promise.resolve(new Response(null, { status: 403 }));
            }

            const formData = init.body;
            const id = input.substring(30).split('/')[0];
            const supportedGameVersions = JSON.parse(
              formData.get('supportedGameVersionIds')!.toString()
            ).map((id: number) =>
              versions.versions.find(
                (version: { id: number }) => version.id == id
              )
            );
            const upload = {
              id: incrementalId++,
              modId: id,
              modVersion: formData.get('modVersion'),
              platform: 'universalpc',
              status: 'unverified',
              dependencies: formData.get('dependencies'),
              supportedGameVersions: supportedGameVersions
            };
            modData[id].mod.versions.push(upload);
            return Promise.resolve(
              new Response(null, {
                status: 200
              })
            );
          }
        } else {
          if (
            input === 'https://beatmods.com/api/versions?gameName=beatsaber'
          ) {
            return Promise.resolve(
              new Response(JSON.stringify(versions), {
                status: 200
              })
            );
          }

          if (input.startsWith('https://beatmods.com/api/mods/')) {
            const id = input.substring(30);
            if (id in modData) {
              const mod = JSON.stringify(modData[id]);
              return Promise.resolve(
                new Response(mod, {
                  status: 200
                })
              );
            } else {
              return Promise.resolve(
                new Response(null, {
                  status: 404
                })
              );
            }
          }

          if (input.startsWith('https://beatmods.com/api/mods?gameVersion=')) {
            const id = input.substring(42);
            const filePath = `beatmods_mods_${id}.json`;
            if (testExistsSync(filePath)) {
              const mods = readTestFileSync(filePath);
              return Promise.resolve(
                new Response(mods, {
                  status: 200
                })
              );
            }
          }
        }
      }

      throw new Error(`Unexpected web request to ${input}`);
    }
  );
};

export const resetBeatmodsMock = () => {
  modData = JSON.parse(JSON.stringify(original));
};

export const mockFetchError = () => {
  fetchMock.mockImplementation(() => {
    return Promise.resolve(
      new Response(null, {
        status: 404
      })
    );
  });
};
