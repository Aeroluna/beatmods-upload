import { jest } from '@jest/globals';
import * as beatmods from '../../src/beatmods.js';

export const getVersions = jest.fn<typeof beatmods.getVersions>();
export const getMod = jest.fn<typeof beatmods.getMod>();
export const getModsForVersion = jest.fn<typeof beatmods.getModsForVersion>();
export const uploadMod = jest.fn<typeof beatmods.uploadMod>();
