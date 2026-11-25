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
  const url = 'https://repo.totalbs.dev/api/v1/game';
  core.debug(`Fetching game from "${url}"...`);
  const response = await fetch(url, {
    headers: { 'User-Agent': userAgent }
  });

  if (!response.ok) {
    throw new Error(
      `LunarRepo did not return ok response [${response.status}]`
    );
  }

  const json = (await response.json()) as LunarRepoGame;
  return json.versions;
};

export const getMod = async (id: string) => {
  const url = 'https://repo.totalbs.dev/api/v1/mods/' + id;
  core.debug(`Fetching mod from "${url}"...`);
  const response = await fetch(url, {
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
  formData.append('channel', request.channel);
  formData.append('gameVersions', request.gameVersions);
  formData.append(
    'file',
    new File([request.file], request.fileName, { type: 'application/zip' })
  );
  const url = 'https://repo.totalbs.dev/api/v1/mods/' + id + '/upload';
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
