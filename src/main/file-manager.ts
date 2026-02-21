import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

const RECENT_FILES_PATH = path.join(app.getPath('userData'), 'recent-files.json');
const MAX_RECENT = 10;

export async function readFile(filePath: string): Promise<string> {
  const stat = await fs.promises.stat(filePath);
  if (stat.size > 50 * 1024 * 1024) {
    throw new Error('File exceeds 50MB limit');
  }
  return fs.promises.readFile(filePath, 'utf-8');
}

export async function writeFile(filePath: string, content: string): Promise<void> {
  const tmpPath = filePath + '.marksidian-tmp';
  await fs.promises.writeFile(tmpPath, content, 'utf-8');
  await fs.promises.rename(tmpPath, filePath);
}

export function watchFile(filePath: string, onChange: () => void): fs.FSWatcher {
  return fs.watch(filePath, { persistent: false }, (eventType) => {
    if (eventType === 'change') {
      onChange();
    }
  });
}

export function getRecentFiles(): string[] {
  try {
    const data = fs.readFileSync(RECENT_FILES_PATH, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

export function addRecentFile(filePath: string): void {
  let recent = getRecentFiles();
  recent = recent.filter((p) => p !== filePath);
  recent.unshift(filePath);
  if (recent.length > MAX_RECENT) recent = recent.slice(0, MAX_RECENT);
  try {
    fs.writeFileSync(RECENT_FILES_PATH, JSON.stringify(recent), 'utf-8');
  } catch {
    // Ignore errors writing recent files
  }
}
