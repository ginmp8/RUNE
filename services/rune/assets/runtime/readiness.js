(async () => {
  window.__RUNE_RENDER_DONE__ = false;
  window.__RUNE_RENDER_ERROR__ = null;

  const waitForImages = () => Promise.all([...document.images].map(image => {
    if (image.complete) {
      if (image.naturalWidth === 0 && image.src) throw new Error(`Image failed to load: ${image.src}`);
      return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
      image.addEventListener('load', resolve, { once: true });
      image.addEventListener('error', () => reject(new Error(`Image failed to load: ${image.src}`)), { once: true });
    });
  }));

  const waitForDomQuiet = (quietMs = 120, timeoutMs = 5000) => new Promise((resolve, reject) => {
    let timer;
    const deadline = setTimeout(() => { observer.disconnect(); reject(new Error('DOM did not become quiet.')); }, timeoutMs);
    const finish = () => {
      clearTimeout(deadline);
      observer.disconnect();
      resolve();
    };
    const schedule = () => { clearTimeout(timer); timer = setTimeout(finish, quietMs); };
    const observer = new MutationObserver(schedule);
    observer.observe(document.documentElement, { subtree: true, childList: true, attributes: true, characterData: true });
    schedule();
  });

  const waitForStableSize = async (frames = 3) => {
    let previous = null;
    let stable = 0;
    for (let attempt = 0; attempt < 60; attempt += 1) {
      await new Promise(resolve => requestAnimationFrame(resolve));
      const current = `${document.documentElement.scrollWidth}x${document.documentElement.scrollHeight}`;
      if (current === previous) stable += 1;
      else stable = 0;
      if (stable >= frames) return;
      previous = current;
    }
    throw new Error('Document dimensions did not stabilize.');
  };

  const waitForCustomReady = async () => {
    const custom = window.__RUNE_READY__;
    if (typeof custom === 'function') await custom();
    else if (custom && typeof custom.then === 'function') await custom;
  };

  window.__RUNE_ASSERT_READY__ = () => {
    const nodes = [...document.querySelectorAll('[data-render-state]')];
    const errors = nodes.filter(node => node.dataset.renderState === 'error');
    const pending = nodes.filter(node => !['ready', 'error'].includes(node.dataset.renderState));
    if (errors.length) throw new Error(`${errors.length} renderer(s) failed.`);
    if (pending.length) throw new Error(`${pending.length} renderer(s) did not become ready.`);
    return { ready: nodes.filter(node => node.dataset.renderState === 'ready').length, error: 0, pending: 0 };
  };

  try {
    await window.__RUNE_RENDER_ALL__();
    await waitForCustomReady();
    await waitForImages();
    if (document.fonts?.ready) await document.fonts.ready;
    await waitForDomQuiet();
    await waitForStableSize();
    window.__RUNE_RENDER_SUMMARY__ = window.__RUNE_ASSERT_READY__();
    window.__RUNE_RENDER_DONE__ = true;
  } catch (error) {
    window.__RUNE_RENDER_ERROR__ = String(error?.stack || error);
    window.__RUNE_RENDER_SUMMARY__ = {
      ready: document.querySelectorAll('[data-render-state="ready"]').length,
      error: document.querySelectorAll('[data-render-state="error"]').length,
      pending: document.querySelectorAll('[data-render-state="pending"], [data-render-state="loading"]').length,
    };
  }
})();
