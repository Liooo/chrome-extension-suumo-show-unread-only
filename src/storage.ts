// ignore, skip, hide, visited
type Reason = 'ignored' | 'visited';
export type Type = 'roomLink' | 'buildingName';
export type Entry = Record<string, { addedAt?: Date; reason: Reason }>;

export const setEntry = (tp: Type, value: string, reason: Reason) => {
  chrome.storage.sync.set(toEntry(tp, value, reason));
};

export const getEntry = async (
  tp: Type,
  value: string,
): Promise<Entry[string]> => {
  const key = toKey(tp, value);
  const entry = await chrome.storage.sync.get<{ [k: string]: Entry[string] }>(
    key,
  );
  return entry[key];
};

export type Config = {
  applyStyle: 'grayout' | 'hide';
};

export const getConfig = async (): Promise<Config> => {
  const v = await chrome.storage.sync.get<{ config: Config }>('config');
  if (!v.config) {
    return { applyStyle: 'grayout' };
  }

  return v.config;
};

export const setConfig = async (config: Config) => {
  await chrome.storage.sync.set({ config });
};

const toKey = (tp: Type, value: string): string => {
  switch (tp) {
    case 'roomLink': {
      return `roomLink:"${value}"`;
    }
    case 'buildingName': {
      return `buildingName:"${value}"`;
    }
  }
};

const toEntry = (tp: Type, value: string, reason: Reason): Entry => {
  const key = toKey(tp, value);
  return { [key]: { addedAt: new Date(), reason } };
};
