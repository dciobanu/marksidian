import * as fs from 'fs';
import * as path from 'path';
import { app, net } from 'electron';
import type { ThemeRegistryEntry, InstalledTheme, ThemeSettings } from '../shared/types';

const REGISTRY_URL =
  'https://raw.githubusercontent.com/obsidianmd/obsidian-releases/master/community-css-themes.json';

function getThemesDir(): string {
  return path.join(app.getPath('userData'), 'themes');
}

function getSettingsPath(): string {
  return path.join(app.getPath('userData'), 'theme-settings.json');
}

export async function ensureThemesDir(): Promise<void> {
  await fs.promises.mkdir(getThemesDir(), { recursive: true });
}

// ── Registry ──────────────────────────────────────────────────

export async function fetchThemeRegistry(): Promise<ThemeRegistryEntry[]> {
  const response = await net.fetch(REGISTRY_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch theme registry: ${response.status}`);
  }
  const data = await response.json();
  return data as ThemeRegistryEntry[];
}

// ── Installed themes ──────────────────────────────────────────

export async function listInstalledThemes(): Promise<InstalledTheme[]> {
  const themesDir = getThemesDir();
  let entries: fs.Dirent[];
  try {
    entries = await fs.promises.readdir(themesDir, { withFileTypes: true });
  } catch {
    return [];
  }

  const themes: InstalledTheme[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const manifestPath = path.join(themesDir, entry.name, 'manifest.json');
    try {
      const raw = await fs.promises.readFile(manifestPath, 'utf-8');
      const manifest = JSON.parse(raw);
      themes.push({
        name: manifest.name || entry.name,
        author: manifest.author || 'Unknown',
        version: manifest.version || '0.0.0',
        repo: manifest.repo || '',
      });
    } catch {
      // Skip directories without a valid manifest
    }
  }
  return themes;
}

// ── Install / Uninstall ───────────────────────────────────────

export async function installTheme(repo: string, name: string): Promise<void> {
  const themeDir = path.join(getThemesDir(), name);
  await fs.promises.mkdir(themeDir, { recursive: true });

  try {
    // Download theme CSS — try theme.css first (modern format), fall back to obsidian.css (legacy)
    let cssResponse = await net.fetch(`https://raw.githubusercontent.com/${repo}/HEAD/theme.css`);
    if (!cssResponse.ok) {
      cssResponse = await net.fetch(`https://raw.githubusercontent.com/${repo}/HEAD/obsidian.css`);
    }
    if (!cssResponse.ok) {
      throw new Error(`Failed to download theme CSS: ${cssResponse.status}`);
    }
    const cssText = await cssResponse.text();
    await fs.promises.writeFile(path.join(themeDir, 'theme.css'), cssText, 'utf-8');

    // Download manifest.json
    const manifestUrl = `https://raw.githubusercontent.com/${repo}/HEAD/manifest.json`;
    const manifestResponse = await net.fetch(manifestUrl);
    if (manifestResponse.ok) {
      const manifestText = await manifestResponse.text();
      // Augment manifest with the repo field for future reference
      try {
        const manifest = JSON.parse(manifestText);
        manifest.repo = repo;
        await fs.promises.writeFile(
          path.join(themeDir, 'manifest.json'),
          JSON.stringify(manifest, null, 2),
          'utf-8',
        );
      } catch {
        await fs.promises.writeFile(path.join(themeDir, 'manifest.json'), manifestText, 'utf-8');
      }
    } else {
      // No manifest.json — create a minimal one
      const minimalManifest = { name, repo, version: '0.0.0', author: 'Unknown' };
      await fs.promises.writeFile(
        path.join(themeDir, 'manifest.json'),
        JSON.stringify(minimalManifest, null, 2),
        'utf-8',
      );
    }
  } catch (err) {
    // Clean up partial install
    await fs.promises.rm(themeDir, { recursive: true, force: true });
    throw err;
  }
}

export async function uninstallTheme(name: string): Promise<void> {
  const themeDir = path.join(getThemesDir(), name);
  await fs.promises.rm(themeDir, { recursive: true, force: true });
}

// ── Settings ──────────────────────────────────────────────────

export async function getThemeSettings(): Promise<ThemeSettings> {
  try {
    const raw = await fs.promises.readFile(getSettingsPath(), 'utf-8');
    return JSON.parse(raw) as ThemeSettings;
  } catch {
    return { activeTheme: null };
  }
}

export async function saveThemeSettings(settings: ThemeSettings): Promise<void> {
  await fs.promises.writeFile(getSettingsPath(), JSON.stringify(settings, null, 2), 'utf-8');
}

// ── CSS path ──────────────────────────────────────────────────

export function getThemeCssPath(name: string): string {
  return path.join(getThemesDir(), name, 'theme.css');
}
