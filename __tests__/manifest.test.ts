/**
 * Unit tests for src/manifest.ts
 */

import { readTestFileSync } from './testFiles.js';

const { getManifest } = await import('../src/manifest.js');

describe('manifest.ts', () => {
  it('gets the manifest', async () => {
    const input = readTestFileSync('ManifestTest.dll');

    expect(getManifest(input)).toMatchObject({
      id: 'test',
      name: 'test',
      author: 'test',
      version: '0.0.1',
      icon: 'test.png',
      description: 'test',
      gameVersion: '1.40.0',
      dependsOn: {
        BSIPA: '^4.3.0'
      }
    });
  });

  it('throws if not a portable executable', () => {
    const input = Buffer.from('abc');

    expect(() => getManifest(input)).toThrow(
      'Failed to read portable executable'
    );
  });

  it('throws if portable executable has no manifest', () => {
    const input = readTestFileSync('ManifestTest.NoManifest.dll');

    expect(() => getManifest(input)).toThrow('Manifest not found');
  });

  it('throws if manifest is malformed', () => {
    const input = readTestFileSync('ManifestTest.Malformed.dll');

    expect(() => getManifest(input)).toThrow(
      'Bad control character in string literal in JSON at position 195 (line 7 column 19)'
    );
  });
});
