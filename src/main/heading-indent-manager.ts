import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import type { HeadingIndentSettings } from '../shared/types';

const DEFAULT_SETTINGS: HeadingIndentSettings = {
  enabledInEditor: true,
  enabledInReading: true,
  h1: 30,
  h2: 50,
  h3: 70,
  h4: 90,
  h5: 110,
  h6: 130,
};

function getSettingsPath(): string {
  return path.join(app.getPath('userData'), 'heading-indent-settings.json');
}

export async function getHeadingIndentSettings(): Promise<HeadingIndentSettings> {
  try {
    const raw = await fs.promises.readFile(getSettingsPath(), 'utf-8');
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function saveHeadingIndentSettings(settings: HeadingIndentSettings): Promise<void> {
  await fs.promises.writeFile(getSettingsPath(), JSON.stringify(settings, null, 2), 'utf-8');
}
