const userAgent = 'beatmods-upload/0.1';

interface GetVersionsResponse {
  versions: BeatmodsGameVersion[];
}

export interface BeatmodsGameVersion {
  id: number;
  version: string;
}

interface GetModResponse {
  mod: BeatmodsMod;
}

export interface BeatmodsMod {
  info: BeatmodsModInfo;
  versions: BeatmodsModVersion[];
}

export interface BeatmodsModInfo {
  id: number;
  name: string;
}

export interface BeatmodsModVersion {
  id: number;
  modVersion: string;
  supportedGameVersions: BeatmodsGameVersion[];
}

interface GetModsResponse {
  mods: BeatmodsAllMod[];
}

export interface BeatmodsAllMod {
  mod: BeatmodsModInfo;
  latest: BeatmodsModVersion;
}

export interface BeatmodsModVersionUpload {
  fileName: string;
  file: Buffer;
  modVersion: string;
  platform: string;
  dependencies: number[];
  supportedGameVersionIds: number[];
}

export const getVersions = async () => {
  const response = await fetch(
    'https://beatmods.com/api/versions?gameName=beatsaber',
    {
      headers: { 'User-Agent': userAgent }
    }
  );

  if (!response.ok) {
    throw new Error(`Beatmods did not return ok response [${response.status}]`);
  }

  const json = (await response.json()) as GetVersionsResponse;
  return json.versions;
};

export const getMod = async (id: string) => {
  const response = await fetch('https://beatmods.com/api/mods/' + id, {
    headers: { 'User-Agent': userAgent }
  });

  if (!response.ok) {
    throw new Error(`Beatmods did not return ok response [${response.status}]`);
  }

  const json = (await response.json()) as GetModResponse;
  return json.mod;
};

export const getModsForVersion = async (gameVersion: string) => {
  const response = await fetch(
    'https://beatmods.com/api/mods?gameVersion=' + gameVersion,
    {
      headers: { 'User-Agent': userAgent }
    }
  );

  if (!response.ok) {
    throw new Error(`Beatmods did not return ok response [${response.status}]`);
  }

  const json = (await response.json()) as GetModsResponse;
  return json.mods;
};

export const uploadMod = async (
  token: string,
  id: string,
  request: BeatmodsModVersionUpload
) => {
  const formData = new FormData();
  formData.append('file', new Blob([request.file]), request.fileName);
  formData.append('modVersion', request.modVersion);
  formData.append('platform', request.platform);
  formData.append('dependencies', JSON.stringify(request.dependencies));
  formData.append(
    'supportedGameVersionIds',
    JSON.stringify(request.supportedGameVersionIds)
  );
  const response = await fetch(
    'https://beatmods.com/api/mods/' + id + '/upload',
    {
      method: 'POST',
      headers: { 'User-Agent': userAgent, Authorization: 'Bearer ' + token },
      body: formData
    }
  );

  if (!response.ok) {
    throw new Error(`Beatmods did not return ok response [${response.status}]`);
  }
};
