/**
 * Unit tests for the action's main functionality, src/main.ts
 */
import { jest } from '@jest/globals';
import * as core from './__fixtures__/core.js';
import * as beatmods from './__fixtures__/beatmods.js';
import { mockFetchBeatmods } from './mockBeatmods.js';
import { addArtifact, clearArtifacts } from './testFiles.js';

jest.unstable_mockModule('@actions/core', () => core);
jest.unstable_mockModule('../src/beatmods.js', () => beatmods);

const { run } = await import('../src/main.js');

interface Inputs {
  [key: string]: string
}

let inputs: Inputs = {};
const setInput = (name: string, input: string) => {
  inputs[name] = input;
};

describe('main.ts', () => {
  beforeEach(() => {
    inputs = {
      path: '__tests__/files/artifacts',
      mods: '{"CustomJSONData": 129}'
    };

    // Set the action's inputs as return values from core.getInput().
    core.getInput.mockImplementation((name: string) => {
      if (name in inputs) {
        return inputs[name];
      }

      throw new Error('Unexpected input');
    });

    beatmods.implement();

    mockFetchBeatmods();
  });

  afterEach(() => {
    jest.resetAllMocks();
    clearArtifacts();
  });

  it('uploads artifact', async () => {
    addArtifact('CustomJSONData-2.6.8+1.29.1-bs1.29.1-7c2c32c.zip');

    await run();

    expect(beatmods.uploadMod).toHaveBeenCalled();
  });

  it('uploads multiple artifacts of same mod', async () => {
    addArtifact('CustomJSONData-2.6.8+1.29.1-bs1.29.1-7c2c32c.zip');
    addArtifact('CustomJSONData-2.6.8+1.34.2-bs1.34.2-7c2c32c.zip');

    await run();

    expect(beatmods.uploadMod).toHaveBeenCalledTimes(2);
  });

  it('skips non-zips', async () => {
    addArtifact('ManifestTest.dll');

    await run();

    expect(core.info).toHaveBeenCalledWith('Skipping "ManifestTest.dll"...');
  });

  it('skips if no manifest', async () => {
    addArtifact('test.zip');

    await run();

    expect(core.warning).toHaveBeenCalledWith(
      'Could not find dll for "test.zip", skipping...'
    );
  });

  it('skips mods without provided id', async () => {
    addArtifact('CustomJSONData-2.6.8+1.29.1-bs1.29.1-7c2c32c.zip');
    setInput('mods', '{}');

    await run();

    expect(core.warning).toHaveBeenCalledWith(
      'No Beatmods id provided for "CustomJSONData", skipping...'
    );
  });

  it('skips on id mismatch', async () => {
    addArtifact('CustomJSONData-2.6.8+1.29.1-bs1.29.1-7c2c32c.zip');
    setInput('mods', '{"CustomJSONData": 1}');

    await run();

    expect(core.warning).toHaveBeenCalledWith(
      'Id mismatch, expected: "CustomJSONData", found: "BSIPA", skipping...'
    );
  });

  it('skips if mod is already uploaded', async () => {
    addArtifact('CustomJSONData-2.6.8+1.37.1-bs1.37.1-7c2c32c.zip');

    await run();

    expect(core.warning).toHaveBeenCalledWith(
      'Version CustomJSONData@2.6.8+1.37.1 already exists on Beatmods, skipping...'
    );
  });

  it('skips if game version does not exist', async () => {
    addArtifact('CustomJSONData-2.6.8+1.40.0-bs1.40.0-7c2c32c.zip');

    await run();

    expect(core.warning).toHaveBeenCalledWith(
      'Game version 1.40.0 not found on Beatmods, skipping...'
    );
  });
});
