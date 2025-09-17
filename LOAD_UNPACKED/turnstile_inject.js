(function () {
  const GEN_REQUEST_TYPE = 'WPLACER_TURNSTILE_REQUEST';
  const GEN_TOKEN_TYPE = 'WPLACER_TURNSTILE_TOKEN';

  const Manager = {
    _turnstileLoaded: false,
    _turnstileWidgetId: null,
    _turnstileContainer: null,
    _turnstileOverlay: null,
    _lastSitekey: null,
    _cachedSitekey: null,
    _cachedTokens: [],
    _lastGenerationTime: null,

    async loadTurnstile() {
      if (window.turnstile && typeof window.turnstile.render === 'function') {
        this._turnstileLoaded = true;
        return true;
      }
      if (this._turnstileLoaded) return true;

      await new Promise((resolve, reject) => {
        try {
          const existing = document.querySelector('script[src*="challenges.cloudflare.com/turnstile"]');
          if (existing) {
            existing.addEventListener('load', () => resolve(true), { once: true });
            existing.addEventListener('error', () => resolve(false), { once: true });
          } else {
            window.wplacerTurnstileOnload = () => resolve(true);
            const s = document.createElement('script');
            s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=wplacerTurnstileOnload&render=explicit';
            s.async = true;
            s.defer = true;
            s.crossOrigin = 'anonymous';
            s.addEventListener('error', () => resolve(false), { once: true });
            document.head.appendChild(s);
          }
        } catch (e) {
          resolve(false);
        }
        setTimeout(() => resolve(!!(window.turnstile && window.turnstile.render)), 3000);
      });

      this._turnstileLoaded = !!(window.turnstile && typeof window.turnstile.render === 'function');
      return this._turnstileLoaded;
    },

    ensureTurnstileContainer() {
      if (this._turnstileContainer && document.body.contains(this._turnstileContainer)) return this._turnstileContainer;
      const div = document.createElement('div');
      div.style.cssText = [
        'position: absolute !important',
        'left: -99999px !important',
        'top: -99999px !important',
        'width: 1px !important',
        'height: 1px !important',
        'pointer-events: none !important',
        'opacity: 0 !important',
        'visibility: hidden !important',
        'z-index: -99999 !important',
        'overflow: hidden !important'
      ].join('; ');
      div.id = 'turnstile-widget-container';
      div.setAttribute('aria-hidden', 'true');
      document.body.appendChild(div);
      this._turnstileContainer = div;
      return div;
    },

    ensureTurnstileOverlayContainer() {
      if (this._turnstileOverlay && document.body.contains(this._turnstileOverlay)) return this._turnstileOverlay;
      const overlay = document.createElement('div');
      overlay.id = 'turnstile-overlay-container';
      overlay.style.cssText = [
        'position: fixed !important',
        'bottom: 20px !important',
        'right: 20px !important',
        'z-index: 99999 !important',
        'background: rgba(0,0,0,0.9) !important',
        'border-radius: 12px !important',
        'padding: 20px !important',
        'box-shadow: 0 8px 32px rgba(0,0,0,0.4) !important',
        'backdrop-filter: blur(10px) !important',
        'border: 1px solid rgba(255,255,255,0.2) !important',
        'color: white !important',
        "font-family: 'Segoe UI', sans-serif !important",
        'display: none !important',
        'max-width: 350px !important',
        'min-width: 300px !important'
      ].join('; ');

      const title = document.createElement('div');
      title.textContent = 'Cloudflare Turnstile — please complete the check if shown';
      title.style.cssText = 'font: 600 12px/1.3 "Segoe UI",sans-serif; margin-bottom: 8px; opacity: 0.9;';

      const host = document.createElement('div');
      host.id = 'turnstile-overlay-host';
      host.style.cssText = 'width: 100%; min-height: 70px;';

      const hideBtn = document.createElement('button');
      hideBtn.textContent = 'Hide';
      hideBtn.style.cssText = [
        'margin-top: 10px',
        'padding: 4px 10px',
        'background: rgba(255,255,255,0.1)',
        'border: 1px solid rgba(255,255,255,0.2)',
        'border-radius: 4px',
        'color: white',
        'font: 400 11px/1 "Segoe UI",sans-serif',
        'cursor: pointer'
      ].join(';');
      hideBtn.onclick = () => {
        overlay.style.display = 'none';
      };

      overlay.appendChild(title);
      overlay.appendChild(host);
      overlay.appendChild(hideBtn);
      document.body.appendChild(overlay);
      this._turnstileOverlay = overlay;
      return overlay;
    },

    async getSitekey() {
      if (this._cachedSitekey) return this._cachedSitekey;
      try {
        // Try to find sitekey in the DOM
        const turnstileElements = document.querySelectorAll('[data-sitekey]');
        for (const el of turnstileElements) {
          const key = el.getAttribute('data-sitekey');
          if (key && key.length > 10) {
            this._cachedSitekey = key;
            return key;
          }
        }

        // Try to find sitekey in script tags
        const scripts = document.querySelectorAll('script');
        for (const script of scripts) {
          const content = script.textContent || '';
          const match = content.match(/sitekey["':\s]+([\w\d]+)/i);
          if (match && match[1] && match[1].length > 10) {
            this._cachedSitekey = match[1];
            return match[1];
          }
        }

        // Try to find in rendered turnstile iframes
        const iframes = document.querySelectorAll('iframe[src*="challenges.cloudflare.com"]');
        for (const iframe of iframes) {
          const src = iframe.src || '';
          const match = src.match(/[?&]sitekey=([\w\d]+)/i);
          if (match && match[1] && match[1].length > 10) {
            this._cachedSitekey = match[1];
            return match[1];
          }
        }

        // Fallback to known sitekey
        return '0x4AAAAAAABnRCVzx0HWNhXFY';
      } catch (e) {
        console.error('wplacer: Error getting sitekey:', e);
        return '0x4AAAAAAABnRCVzx0HWNhXFY';
      }
    },

    async generateToken(useOverlay = false) {
      try {
        // Ensure Turnstile is loaded
        const loaded = await this.loadTurnstile();
        if (!loaded) {
          console.warn('wplacer: Turnstile failed to load');
          return null;
        }

        // Get the sitekey
        const sitekey = await this.getSitekey();
        if (!sitekey) {
          console.warn('wplacer: No sitekey found');
          return null;
        }

        // Reset any existing widget
        if (this._turnstileWidgetId !== null) {
          try {
            window.turnstile.remove(this._turnstileWidgetId);
          } catch {}
          this._turnstileWidgetId = null;
        }

        // Create a container for the widget
        const container = useOverlay ? 
          this.ensureTurnstileOverlayContainer().querySelector('#turnstile-overlay-host') : 
          this.ensureTurnstileContainer();

        if (useOverlay) {
          this._turnstileOverlay.style.display = 'block';
        }

        // Create a promise to wait for the token
        return new Promise((resolve) => {
          let timeoutId = setTimeout(() => {
            console.warn('wplacer: Turnstile token generation timed out');
            resolve(null);
          }, 30000);

          // Render the widget
          this._turnstileWidgetId = window.turnstile.render(container, {
            sitekey: sitekey,
            callback: (token) => {
              clearTimeout(timeoutId);
              this._lastGenerationTime = Date.now();
              if (useOverlay) {
                setTimeout(() => {
                  try { this._turnstileOverlay.style.display = 'none'; } catch {}
                }, 1000);
              }
              resolve(token);
            },
            'expired-callback': () => {
              clearTimeout(timeoutId);
              console.warn('wplacer: Turnstile token expired');
              resolve(null);
            },
            'error-callback': () => {
              clearTimeout(timeoutId);
              console.warn('wplacer: Turnstile error');
              resolve(null);
            },
            theme: 'light',
            language: 'en',
            appearance: 'interaction-only'
          });
        });
      } catch (e) {
        console.error('wplacer: Error generating token:', e);
        return null;
      }
    },

    async getToken(forceNew = false, useOverlay = false) {
      // If we have a cached token and it's not forced to be new, return it
      if (!forceNew && this._cachedTokens.length > 0) {
        return this._cachedTokens.shift();
      }

      // Generate a new token
      const token = await this.generateToken(useOverlay);
      if (token) {
        // Cache the token
        this._cachedTokens.push(token);
        return token;
      }

      return null;
    },

    async pregenToken() {
      // Only pregen if we don't have any cached tokens
      if (this._cachedTokens.length === 0) {
        const token = await this.generateToken(false);
        if (token) {
          this._cachedTokens.push(token);
        }
      }
    }
  };

  // Listen for token requests from the content script
  window.addEventListener('message', async (event) => {
    if (event.source !== window) return;
    if (event.data && event.data.type === GEN_REQUEST_TYPE) {
      console.log('wplacer: Received token generation request');
      const token = await Manager.getToken(true, false);
      if (token) {
        window.postMessage({ type: GEN_TOKEN_TYPE, token }, '*');
      } else {
        window.postMessage({ type: GEN_TOKEN_TYPE, error: 'Failed to generate token' }, '*');
      }
    }
  });

  // Expose the manager for debugging
  window.wplacerTurnstileManager = Manager;

  // Start pregeneration after a delay
  setTimeout(() => {
    Manager.pregenToken();
  }, 5000);

  console.log('wplacer: Turnstile generator injected');
})();