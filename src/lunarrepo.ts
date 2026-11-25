import * as core from '@actions/core';

const userAgent = 'lunarrepo-upload/0.1';
const token = core.getInput('token');

interface LunarRepoGame {
  versions: string[];
}

export interface LunarRepoMod {
  id: number;
  name: string;
  versions: LunarRepoModVersion[];
}

export interface LunarRepoModVersion {
  version: string;
  gameVersions: string[];
}

export interface LunarRepoModVersionUpload {
  fileName: string;
  file: Buffer;
  channel: string;
  gameVersions: string[];
}

export const getVersions = async () => {
  const response = await fetch('https://repo.totalbs.dev/api/v1/game', {
    headers: { 'User-Agent': userAgent }
  });

  if (!response.ok) {
    throw new Error(`Beatmods did not return ok response [${response.status}]`);
  }

  const json = (await response.json()) as LunarRepoGame;
  return json.versions;
};

export const getMod = async (id: string) => {
  const response = await fetch('https://repo.totalbs.dev/api/v1/mods/' + id, {
    headers: { 'User-Agent': userAgent, Authorization: 'Bearer ' + token }
  });

  if (!response.ok) {
    throw new Error(
      `LunarRepo did not return ok response [${response.status}]`
    );
  }

  const json = (await response.json()) as LunarRepoMod;
  return json;
};

export const uploadMod = async (
  id: string,
  request: LunarRepoModVersionUpload
) => {
  const formData = new FormData();
  formData.append(
    'file',
    new File([request.file], request.fileName, { type: 'application/zip' })
  );
  formData.append('channel', request.channel);
  formData.append('gameVersions', request.gameVersions);
  const url = 'https://repo.lunarrepo.com/api/v1/mods/' + id + '/upload';
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'User-Agent': userAgent, Authorization: 'Bearer ' + token },
    body: formData
  });

  let json;
  await response
    .json()
    .then((n) => (json = JSON.stringify(n, null, 2)))
    .catch(() => (json = 'null'));
  core.debug(`POST ${url} (${response.status}) => ${json}`);

  if (!response.ok) {
    throw new Error(
      `LunarRepo did not return ok response [${response.status}]`
    );
  }
};
