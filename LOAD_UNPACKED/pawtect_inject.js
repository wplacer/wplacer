(() => {
  const backend = 'https://backend.wplace.live';

  // Derive extension base URL from this script's src (works in page context)
  const EXT_BASE = (() => {
    try {
      const sc = document.currentScript || Array.from(document.scripts || []).find(s => (s && typeof s.src === 'string' && s.src.includes('pawtect_inject.js')));
      if (sc && sc.src) return new URL('.', sc.src).href;
    } catch {}
    return null;
  })();
  const extUrl = (p) => {
    try { return EXT_BASE ? new URL(p, EXT_BASE).href : null; } catch { return null; }
  };

  const importModule = async () => {
    const candidates = [
      // Prefer locally packaged immutable chunk inside the extension
      extUrl('solver.wasm/immutable/chunks/BBb1ALhY.js'),
      // Site-relative path (when running directly on the site)
      new URL('/_app/immutable/chunks/BBb1ALhY.js', location.origin).href,
      // Absolute site URL fallback
      'https://wplace.live/_app/immutable/chunks/BBb1ALhY.js'
    ];
    let lastErr;
    for (const url of candidates) {
      try {
        return await import(url);
      } catch (e) { lastErr = e; }
    }
    console.error('pawtect: failed to import module', lastErr?.message || lastErr);
    return null;
  };

  const run = async (url, body) => {
    try {
      const mod = await importModule();
      if (!mod || typeof mod._ !== 'function') {
        console.warn('pawtect: module not available');
        return;
      }
      // Try to initialize WASM with explicit packaged URL first, then fallback to default
      let wasm;
      try {
        wasm = await mod._(extUrl('solver.wasm/pawtect_wasm_bg.wasm'));
      } catch {
        try {
          // Some builds place wasm under immutable/assets
          wasm = await mod._(extUrl('solver.wasm/immutable/assets/pawtect_wasm_bg.BvxCe1S1.wasm'));
        } catch {
          wasm = await mod._();
        }
      }

      try {
        const me = await fetch(`${backend}/me`, { credentials: 'include' }).then(r => r.ok ? r.json() : null);
        if (me?.id && typeof mod.i === 'function') mod.i(me.id);
      } catch {}

      if (typeof mod.r === 'function') mod.r(url);

      const enc = new TextEncoder();
      const dec = new TextDecoder();
      const bytes = enc.encode(JSON.stringify(body));
      const inPtr = wasm.__wbindgen_malloc(bytes.length, 1);
      new Uint8Array(wasm.memory.buffer, inPtr, bytes.length).set(bytes);
      const out = wasm.get_pawtected_endpoint_payload(inPtr, bytes.length);
      const outPtr = Array.isArray(out) ? out[0] : out.ptr || out;
      const outLen = Array.isArray(out) ? out[1] : out.len || 0;
      const token = dec.decode(new Uint8Array(wasm.memory.buffer, outPtr, outLen));
      try { wasm.__wbindgen_free(outPtr, outLen, 1); } catch {}

      console.log('x-pawtect-token:', token);
      try { window.postMessage({ type: 'WPLACER_PAWTECT_TOKEN', token, fp: body.fp || null }, '*'); } catch {}
      return token;
    } catch (e) {
      console.error('pawtect run error:', e?.message || e);
    }
  };

  // Expose manual runner for DevTools
  window.wplacerRunPawtect = (urlOverride, bodyOverride) => {
    const url = urlOverride || `${backend}/s0/pixel/1663/1069`;
    const body = bodyOverride || { colors: [0,1,2], coords: [10,20,11,21], t: 'REPLACE_T', fp: 'REPLACE_FP' };
    return run(url, body);
  };

  console.log('pawtect helper ready: call window.wplacerRunPawtect(url, body) to generate a token.');
})();