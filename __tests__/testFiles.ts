import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const testFilesDirectory = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'files'
);

export const readTestFileSync = (fileName: string) => {
  return fs.readFileSync(path.join(testFilesDirectory, fileName));
};

export const testExistsSync = (fileName: string) => {
  return fs.existsSync(path.join(testFilesDirectory, fileName));
};
