/**
 * Unit tests for src/manifest.ts
 */
import { jest } from '@jest/globals';
import { mockFetchBeatmods, mockFetchError } from './mockBeatmods.js';
import { uploadMod } from '../src/beatmods.js';
import { readTestFileSync } from './testFiles.js';

const { getVersions, getMod, getModsForVersion } = await import(
  '../src/beatmods.js'
);

describe('beatmods.ts', () => {
  beforeEach(() => {
    mockFetchBeatmods();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('getVersions', () => {
    it('gets game versions', async () => {
      await expect(getVersions()).resolves.toEqual(
        expect.arrayContaining([
          {
            id: 78,
            gameName: 'BeatSaber',
            version: '1.29.1',
            defaultVersion: false,
            createdAt: '2024-12-31T23:49:07.502Z',
            updatedAt: '2024-12-31T23:49:07.502Z',
            deletedAt: null
          }
        ])
      );
    });

    it('throws if error response', async () => {
      mockFetchError();
      await expect(getVersions()).rejects.toThrow(
        'Beatmods did not return ok response [404]'
      );
    });
  });

  describe('getMod', () => {
    it('gets mod', async () => {
      await expect(getMod('129')).resolves.toMatchObject({
        info: expect.objectContaining({
          id: 129,
          name: 'CustomJSONData',
          summary:
            'Lets mappers include arbitrary data in beatmaps, and lets modders access that data. Why did I m...',
          gameName: 'BeatSaber',
          category: 'library'
        })
      });
    });

    it('throws if error response', async () => {
      mockFetchError();
      await expect(getMod('129')).rejects.toThrow(
        'Beatmods did not return ok response [404]'
      );
    });
  });

  describe('getModsForVersion', () => {
    it('gets mods for version', async () => {
      await expect(getModsForVersion('1.29.1')).resolves.toEqual(
        expect.arrayContaining([
          {
            mod: expect.objectContaining({
              id: 129,
              name: 'CustomJSONData',
              gameName: 'BeatSaber',
              category: 'library',
              status: 'verified',
              iconFileName: 'default.png',
              gitUrl: 'https://github.com/Aeroluna/CustomJSONData',
              lastApprovedById: 8,
              lastUpdatedById: 8
            }),
            latest: expect.objectContaining({
              id: 1713,
              modId: 129,
              modVersion: '2.5.2',
              platform: 'universalpc',
              zipHash: '03a7c1a58f42a07b37d6486b05c95bbc',
              status: 'verified',
              dependencies: [1405],
              downloadCount: 39,
              fileSize: 233990
            })
          }
        ])
      );
    });

    it('throws if error response', async () => {
      mockFetchError();
      await expect(getModsForVersion('1.29.1')).rejects.toThrow(
        'Beatmods did not return ok response [404]'
      );
    });
  });

  describe('uploadMod', () => {
    const fileName = 'CustomJSONData-2.6.8+1.29.1-bs1.29.1-7c2c32c.zip';
    const file = readTestFileSync(fileName);
    const request = {
      file: file,
      fileName: fileName,
      modVersion: '2.6.8+1.29.1',
      platform: 'universalpc',
      dependencies: [1405],
      supportedGameVersionIds: [78]
    };

    it('uploads mod', async () => {
      await expect(uploadMod('129', request)).resolves.not.toThrow();
      expect(fetch).toHaveBeenCalledWith(
        'https://beatmods.com/api/mods/129/upload',
        expect.objectContaining({
          method: 'POST'
        })
      );
    });

    it('throws if error response', async () => {
      mockFetchError();
      await expect(uploadMod('129', request)).rejects.toThrow();
    });
  });
});
