export function setupContainer(): void {
  const container = document.querySelector('.app-container');
  if (container) {
    container.classList.add('readable-line-width');
  }
}

export function toggleReadableLineWidth(enabled: boolean): void {
  const container = document.querySelector('.app-container');
  if (container) {
    container.classList.toggle('readable-line-width', enabled);
  }
}
