import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

export const testFilesDirectory = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'files'
);

const artifactDirectory = path.join(testFilesDirectory, 'artifacts');

export const readTestFileSync = (fileName: string) => {
  return fs.readFileSync(path.join(testFilesDirectory, fileName));
};

export const testExistsSync = (fileName: string) => {
  return fs.existsSync(path.join(testFilesDirectory, fileName));
};

export const addArtifact = (fileName: string) => {
  if (!fs.existsSync(artifactDirectory)) {
    fs.mkdirSync(artifactDirectory);
  }

  return fs.copyFileSync(
    path.join(testFilesDirectory, fileName),
    path.join(artifactDirectory, fileName)
  );
};

export const clearArtifacts = () => {
  return fs.rmSync(artifactDirectory, { recursive: true, force: true });
};
