/**
 * Unit tests for the action's main functionality, src/main.ts
 */
import { jest } from '@jest/globals';
import * as core from './__fixtures__/core.js';
import * as beatmods from './__fixtures__/beatmods.js';
import { mockFetchBeatmods } from './mockBeatmods.js';

jest.unstable_mockModule('@actions/core', () => core);
jest.unstable_mockModule('../src/beatmods.js', () => beatmods);

const { run } = await import('../src/main.js');

describe('main.ts', () => {
  beforeEach(() => {
    // Set the action's inputs as return values from core.getInput().
    core.getInput.mockImplementation((name: string) => {
      switch (name) {
        case 'path':
          return '__tests__/files/artifacts';

        case 'mods':
          return '{"CustomJSONData": 129}';
      }

      throw new Error('Unexpected input');
    });

    mockFetchBeatmods();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('uploads artifact', async () => {
    await run();

    expect(beatmods.uploadMod).toHaveBeenCalled();
  });
});
