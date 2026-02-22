import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import type { ThemeModeSettings } from '../shared/types';

const DEFAULT_SETTINGS: ThemeModeSettings = { mode: 'system' };

function getSettingsPath(): string {
  return path.join(app.getPath('userData'), 'theme-mode-settings.json');
}

export async function getThemeModeSettings(): Promise<ThemeModeSettings> {
  try {
    const raw = await fs.promises.readFile(getSettingsPath(), 'utf-8');
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function saveThemeModeSettings(settings: ThemeModeSettings): Promise<void> {
  await fs.promises.writeFile(getSettingsPath(), JSON.stringify(settings, null, 2), 'utf-8');
}
