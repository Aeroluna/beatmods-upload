import { load, rvaToOffset } from 'pe-struct';

// Loosely based off https://stackoverflow.com/questions/64393919/load-resource-from-assembly-without-loading-the-assembly
export const getManifest = (data: Buffer) => {
  const buffer = data.buffer;
  let pe;
  try {
    pe = load(buffer);
  } catch {
    throw new Error('Failed to read portable executable');
  }

  const stringsOffset = pe.mdsStrings!._off;
  const manifestResource = pe.mdtManifestResource!.values.find((resource) => {
    const nameLocation = resource.Name;

    let name = '';
    for (
      let i = stringsOffset + nameLocation.value;
      i < buffer.byteLength;
      i++
    ) {
      const char = String.fromCharCode(pe.data.getUint8(i));
      if (char != '\0') {
        name += char;
        continue;
      }

      if (name.endsWith('manifest.json')) {
        return true;
      } else {
        return false;
      }
    }
  });

  if (!manifestResource) {
    throw new Error('Manifest not found');
  }

  const resourcesResource = pe.cliHeader!.Resources;
  const decoder = new TextDecoder();
  let pos =
    rvaToOffset(pe, resourcesResource.Rva.value) +
    manifestResource.Offset.value;
  const size = pe.data.getUint32(pos, true);
  pos += 4;
  return JSON.parse(decoder.decode(buffer.slice(pos, pos + size))) as Manifest;
};

export interface Manifest {
  id: string;
  version: string;
  gameVersion: string;
  dependsOn: {
    [key: string]: string;
  };
}
