// ignore, skip, hide, visited
type Reason = 'ignored' | 'visited';
export type Type = 'roomLink' | 'buildingName';
export type Entry = Record<string, { addedAt?: Date; reason: Reason }>;

export const setEntry = (value: string, reason: Reason) => {
  const key = normalizeKey(value);
  chrome.storage.local.set(toEntry(key, reason));
};

export const getEntry = async (value: string): Promise<Entry[string]> => {
  const key = normalizeKey(value);
  const entry = await chrome.storage.local.get<{ [k: string]: Entry[string] }>(
    key,
  );
  return entry[key];
};

export type Config = {
  applyStyle: 'grayout' | 'hide';
};

export const getConfig = async (): Promise<Config> => {
  const v = await chrome.storage.local.get<{ config: Config }>('config');
  if (!v.config) {
    return { applyStyle: 'grayout' };
  }

  return v.config;
};

export const setConfig = async (config: Config) => {
  await chrome.storage.local.set({ config });
};

const toEntry = (value: string, reason: Reason): Entry => {
  return { [value]: { addedAt: new Date(), reason } };
};

const normalizeKey = (key: string) => key.replace(/["']/g, '');
