/**
 * Theme CSS loader — injects/removes a <link> for community themes
 * using the marksidian-asset:// protocol (has bypassCSP: true).
 */

const LINK_ID = 'marksidian-community-theme';

/**
 * Apply a community theme CSS file by path.
 * Creates or updates a <link> tag after variables.css.
 */
export function applyThemeCss(cssPath: string): void {
  let link = document.getElementById(LINK_ID) as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement('link');
    link.id = LINK_ID;
    link.rel = 'stylesheet';
    link.type = 'text/css';

    // Insert after variables.css so theme overrides take effect
    const variablesLink = document.querySelector('link[href*="variables.css"]');
    if (variablesLink && variablesLink.nextSibling) {
      variablesLink.parentNode!.insertBefore(link, variablesLink.nextSibling);
    } else {
      document.head.appendChild(link);
    }
  }

  // Use marksidian-asset:// protocol which has bypassCSP: true
  link.href = `marksidian-asset://${cssPath}`;
}

/**
 * Remove the community theme CSS, reverting to default styling.
 */
export function removeThemeCss(): void {
  const link = document.getElementById(LINK_ID);
  if (link) {
    link.remove();
  }
}

/**
 * Load the active theme on startup.
 * Reads settings and applies the theme if one is set.
 */
export async function loadActiveTheme(): Promise<void> {
  if (!window.marksidian) return;

  try {
    const settings = await window.marksidian.getThemeSettings();
    if (settings.activeTheme) {
      const cssPath = await window.marksidian.getThemeCssPath(settings.activeTheme);
      applyThemeCss(cssPath);
    }
  } catch {
    // Theme may have been deleted — silently fall back to default
  }
}
