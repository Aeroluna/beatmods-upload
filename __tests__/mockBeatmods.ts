import { jest } from '@jest/globals';
import { readTestFileSync, testExistsSync } from './testFiles';

const fetchMock = jest.fn(global.fetch);
global.fetch = fetchMock;

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
            const versions = readTestFileSync('beatmods_versions.json');
            return Promise.resolve(
              new Response(versions, {
                status: 200
              })
            );
          }

          if (input.startsWith('https://beatmods.com/api/mods/')) {
            const id = input.substring(30);
            const filePath = `beatmods_mod_${id}.json`;
            if (testExistsSync(filePath)) {
              const versions = readTestFileSync(filePath);
              return Promise.resolve(
                new Response(versions, {
                  status: 200
                })
              );
            }
          }

          if (input.startsWith('https://beatmods.com/api/mods?gameVersion=')) {
            const id = input.substring(42);
            const filePath = `beatmods_mods_${id}.json`;
            if (testExistsSync(filePath)) {
              const versions = readTestFileSync(filePath);
              return Promise.resolve(
                new Response(versions, {
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

export const mockFetchError = () => {
  fetchMock.mockImplementation(() => {
    return Promise.resolve(
      new Response(null, {
        status: 404
      })
    );
  });
};
