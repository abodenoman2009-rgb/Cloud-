/**
 * Device (phone) copy registry.
 *
 * A native client queries the platform gallery API; on the web the device
 * library is tracked per-browser so the cleanup console has real data to
 * work with. Entries reference cloud files by id — the copy itself is never
 * uploaded anywhere by this module.
 */
export type DeviceEntry = {
  localId: string;
  fileId: string;
  name: string;
  size: number;
  mime: string;
  addedAt: number;
  cleared: boolean;
};

const KEY = "chd_device_v1";

export function readDevice(): DeviceEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as DeviceEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeDevice(list: DeviceEntry[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* quota / private mode */
  }
}

export function addDeviceEntry(entry: Omit<DeviceEntry, "localId" | "addedAt" | "cleared">) {
  const list = readDevice();
  if (list.some((e) => e.fileId === entry.fileId)) return;
  list.push({
    ...entry,
    localId: `loc_${entry.fileId}`,
    addedAt: Date.now(),
    cleared: false,
  });
  writeDevice(list);
}

export function markCleared(fileIds: string[]) {
  const set = new Set(fileIds);
  writeDevice(readDevice().map((e) => (set.has(e.fileId) ? { ...e, cleared: true } : e)));
}

export function pendingLocalEntries(): DeviceEntry[] {
  return readDevice().filter((e) => !e.cleared);
}
