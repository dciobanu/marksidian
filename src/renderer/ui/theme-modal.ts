/**
 * Settings / Appearance modal — browse, install, and activate Obsidian community themes.
 */

import type { ThemeRegistryEntry, InstalledTheme } from '../../shared/types';
import { applyThemeCss, removeThemeCss } from './theme-loader';

let overlayEl: HTMLElement | null = null;
let registryCache: ThemeRegistryEntry[] | null = null;

export function isSettingsOpen(): boolean {
  return overlayEl !== null;
}

export function closeThemeModal(): void {
  if (overlayEl) {
    overlayEl.remove();
    overlayEl = null;
  }
}

export async function openThemeModal(): Promise<void> {
  if (overlayEl) return; // already open

  // Create overlay
  overlayEl = document.createElement('div');
  overlayEl.className = 'settings-modal-overlay';
  overlayEl.addEventListener('mousedown', (e) => {
    if (e.target === overlayEl) closeThemeModal();
  });

  // Modal container
  const modal = document.createElement('div');
  modal.className = 'settings-modal';
  overlayEl.appendChild(modal);

  // Header
  const header = document.createElement('div');
  header.className = 'settings-modal-header';
  header.innerHTML = `
    <span class="settings-modal-title">Appearance</span>
    <button class="settings-modal-close" aria-label="Close">&times;</button>
  `;
  header.querySelector('.settings-modal-close')!.addEventListener('click', closeThemeModal);
  modal.appendChild(header);

  // Body
  const body = document.createElement('div');
  body.className = 'settings-modal-body';
  modal.appendChild(body);

  // Escape key handler
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      closeThemeModal();
      document.removeEventListener('keydown', onKeyDown);
    }
  };
  document.addEventListener('keydown', onKeyDown);

  document.body.appendChild(overlayEl);

  // Render content
  await renderModalContent(body);
}

async function renderModalContent(body: HTMLElement): Promise<void> {
  body.innerHTML = '';

  // ── Active theme section ──
  const settings = await window.marksidian.getThemeSettings();
  const installed = await window.marksidian.listInstalledThemes();
  const activeTheme = settings.activeTheme;

  const activeSection = document.createElement('div');
  activeSection.className = 'settings-active-theme';

  const label = document.createElement('div');
  label.className = 'settings-active-theme-label';
  label.textContent = 'Active Theme';
  activeSection.appendChild(label);

  const row = document.createElement('div');
  row.className = 'settings-active-theme-row';

  const nameSpan = document.createElement('span');
  nameSpan.className = 'settings-active-theme-name';
  nameSpan.textContent = activeTheme || 'Default';
  row.appendChild(nameSpan);

  if (activeTheme) {
    const removeBtn = document.createElement('button');
    removeBtn.className = 'settings-btn settings-btn-danger';
    removeBtn.textContent = 'Revert to Default';
    removeBtn.addEventListener('click', async () => {
      await window.marksidian.setActiveTheme(null);
      removeThemeCss();
      await renderModalContent(body);
    });
    row.appendChild(removeBtn);
  }

  activeSection.appendChild(row);
  body.appendChild(activeSection);

  // ── Search + gallery ──
  const searchRow = document.createElement('div');
  searchRow.className = 'settings-search-row';
  searchRow.innerHTML = `
    <label>Community Themes</label>
    <input class="settings-search-input" type="text" placeholder="Search themes..." />
  `;
  body.appendChild(searchRow);

  const gallery = document.createElement('div');
  gallery.className = 'settings-theme-gallery';
  body.appendChild(gallery);

  const searchInput = searchRow.querySelector('.settings-search-input') as HTMLInputElement;

  // Load registry
  if (!registryCache) {
    gallery.innerHTML = '<div class="settings-loading"><span class="settings-spinner"></span> Loading community themes...</div>';

    try {
      registryCache = await window.marksidian.fetchThemeRegistry();
    } catch (err) {
      gallery.innerHTML = `
        <div class="settings-error">
          Failed to load theme registry.
          <div class="settings-error-retry">
            <button class="settings-btn settings-btn-primary">Retry</button>
          </div>
        </div>
      `;
      gallery.querySelector('button')!.addEventListener('click', async () => {
        registryCache = null;
        await renderModalContent(body);
      });
      return;
    }
  }

  const registry = registryCache;

  // Render gallery
  function renderGallery(filter: string): void {
    gallery.innerHTML = '';
    const lowerFilter = filter.toLowerCase();

    // Filter out legacy themes
    const themes = registry.filter((t) => {
      if (t.legacy) return false;
      if (!lowerFilter) return true;
      return (
        t.name.toLowerCase().includes(lowerFilter) ||
        t.author.toLowerCase().includes(lowerFilter)
      );
    });

    if (themes.length === 0) {
      gallery.innerHTML = '<div class="settings-loading">No themes match your search.</div>';
      return;
    }

    for (const theme of themes) {
      const card = createThemeCard(theme, installed, activeTheme, body);
      gallery.appendChild(card);
    }
  }

  renderGallery('');

  // Search handler with debounce
  let searchTimeout: ReturnType<typeof setTimeout>;
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      renderGallery(searchInput.value.trim());
    }, 200);
  });

  // Focus search input
  searchInput.focus();
}

function createThemeCard(
  theme: ThemeRegistryEntry,
  installed: InstalledTheme[],
  activeTheme: string | null,
  body: HTMLElement,
): HTMLElement {
  const card = document.createElement('div');
  card.className = 'settings-theme-card';
  if (theme.name === activeTheme) {
    card.classList.add('settings-theme-card-active');
  }

  // Screenshot
  if (theme.screenshot) {
    const img = document.createElement('img');
    img.className = 'settings-theme-screenshot';
    img.loading = 'lazy';
    img.alt = theme.name;
    img.src = `https://raw.githubusercontent.com/${theme.repo}/HEAD/${theme.screenshot}`;
    img.addEventListener('error', () => {
      img.replaceWith(createPlaceholder());
    });
    card.appendChild(img);
  } else {
    card.appendChild(createPlaceholder());
  }

  // Info
  const info = document.createElement('div');
  info.className = 'settings-theme-info';

  const name = document.createElement('div');
  name.className = 'settings-theme-name';
  name.textContent = theme.name;
  name.title = theme.name;
  info.appendChild(name);

  const author = document.createElement('div');
  author.className = 'settings-theme-author';
  author.textContent = `by ${theme.author}`;
  info.appendChild(author);

  // Mode badges
  if (theme.modes && theme.modes.length > 0) {
    const modes = document.createElement('div');
    modes.className = 'settings-theme-modes';
    for (const mode of theme.modes) {
      const badge = document.createElement('span');
      badge.className = 'settings-theme-mode-badge';
      badge.textContent = mode;
      modes.appendChild(badge);
    }
    info.appendChild(modes);
  }

  card.appendChild(info);

  // Actions
  const actions = document.createElement('div');
  actions.className = 'settings-theme-actions';

  const isInstalled = installed.some((t) => t.name === theme.name);
  const isActive = theme.name === activeTheme;

  if (isInstalled) {
    if (!isActive) {
      // Use button
      const useBtn = document.createElement('button');
      useBtn.className = 'settings-btn settings-btn-primary';
      useBtn.textContent = 'Use';
      useBtn.addEventListener('click', async () => {
        try {
          const cssPath = await window.marksidian.getThemeCssPath(theme.name);
          await window.marksidian.setActiveTheme(theme.name);
          applyThemeCss(cssPath);
          await renderModalContent(body);
        } catch (err) {
          console.error('Failed to activate theme:', err);
        }
      });
      actions.appendChild(useBtn);
    } else {
      const activeLabel = document.createElement('span');
      activeLabel.className = 'settings-theme-author';
      activeLabel.textContent = 'Active';
      actions.appendChild(activeLabel);
    }

    // Uninstall button
    const uninstallBtn = document.createElement('button');
    uninstallBtn.className = 'settings-btn settings-btn-danger';
    uninstallBtn.textContent = 'Uninstall';
    uninstallBtn.addEventListener('click', async () => {
      try {
        if (isActive) {
          await window.marksidian.setActiveTheme(null);
          removeThemeCss();
        }
        await window.marksidian.uninstallTheme(theme.name);
        await renderModalContent(body);
      } catch (err) {
        console.error('Failed to uninstall theme:', err);
      }
    });
    actions.appendChild(uninstallBtn);
  } else {
    // Install button
    const installBtn = document.createElement('button');
    installBtn.className = 'settings-btn settings-btn-primary';
    installBtn.textContent = 'Install';
    installBtn.addEventListener('click', async () => {
      installBtn.disabled = true;
      installBtn.innerHTML = '<span class="settings-spinner"></span> Installing...';
      try {
        await window.marksidian.installTheme(theme.repo, theme.name);
        // Auto-activate after install
        const cssPath = await window.marksidian.getThemeCssPath(theme.name);
        await window.marksidian.setActiveTheme(theme.name);
        applyThemeCss(cssPath);
        await renderModalContent(body);
      } catch (err) {
        installBtn.disabled = false;
        installBtn.textContent = 'Failed — Retry';
        console.error('Failed to install theme:', err);
      }
    });
    actions.appendChild(installBtn);
  }

  card.appendChild(actions);
  return card;
}

function createPlaceholder(): HTMLElement {
  const placeholder = document.createElement('div');
  placeholder.className = 'settings-theme-screenshot-placeholder';
  placeholder.textContent = 'No preview';
  return placeholder;
}
