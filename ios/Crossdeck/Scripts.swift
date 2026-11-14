import Foundation

/// JavaScript injected into every column's web view, ported from the
/// Electron renderer (`src/renderer.ts`, `dom-ready` handler +
/// `getXCleanupScript()`).
///
/// Differences from desktop:
/// - Scripts run via WKUserScript on every navigation (document end),
///   instead of `webview.executeJavaScript` on `dom-ready`.
/// - WebAuthn is NOT disabled here. Electron had to neuter
///   `navigator.credentials` because of sandbox limitations; WKWebView
///   supports passkeys, so X logins can use them on iPad.
enum Scripts {

    /// Sidebar-hiding + promoted-content CSS, injected as a style element.
    /// The sidebar starts hidden, exactly like desktop: the
    /// `crossdeck-hide-sidebar` class is added on load and can be toggled.
    static let styleScript = #"""
    (() => {
      if (!document.getElementById('crossdeck-sidebar-style')) {
        const sidebarStyle = document.createElement('style');
        sidebarStyle.id = 'crossdeck-sidebar-style';
        sidebarStyle.textContent =
          'html.crossdeck-hide-sidebar header[role="banner"] { display: none !important; }' +
          'html.crossdeck-hide-sidebar main { margin-top: 0 !important; }';
        document.head.appendChild(sidebarStyle);
      }
      document.documentElement.classList.add('crossdeck-hide-sidebar');

      const adStyle = document.createElement('style');
      adStyle.textContent =
        '[aria-label="Promoted"], [aria-label*="Promoted"],' +
        ' [aria-label*="プロモーション"], [aria-label*="広告"] { display: none !important; }';
      document.head.appendChild(adStyle);

      // Prevent embedded pages from keeping the display awake.
      if ('wakeLock' in navigator) {
        try {
          Object.defineProperty(navigator, 'wakeLock', {
            value: { request: () => Promise.reject(new DOMException('Wake Lock disabled by crossdeck', 'NotAllowedError')) },
            writable: false, configurable: false
          });
        } catch (e) {}
      }
    })();
    """#

    /// Promoted-post cleanup with a MutationObserver — a direct port of
    /// `getXCleanupScript()` from the desktop renderer.
    static let cleanupScript = #"""
    (() => {
      const isXHost = location.hostname.includes('x.com') || location.hostname.includes('twitter.com');
      if (!isXHost) return;

      const hideElement = (element) => {
        if (!element) return;
        const target = element.closest('article, [data-testid="cellInnerDiv"]') || element;
        if (target instanceof HTMLElement) {
          target.style.setProperty('display', 'none', 'important');
        }
      };

      const hidePromotedContent = () => {
        const promotedPattern = /\bpromoted\b|\bpromoted post\b|プロモーション|広告/i;

        document.querySelectorAll('[aria-label]').forEach(element => {
          if (promotedPattern.test(element.getAttribute('aria-label') || '')) {
            hideElement(element);
          }
        });

        document.querySelectorAll('[data-testid="placementTracking"]').forEach(element => {
          if (element.closest('[data-testid="tweetPhoto"], [data-testid="videoPlayer"], [data-testid="videoComponent"]')) {
            return;
          }
          hideElement(element);
        });

        document.querySelectorAll('article').forEach(article => {
          const socialContext = article.querySelector('[data-testid="socialContext"]');
          if (socialContext && promotedPattern.test(socialContext.textContent || '')) {
            article.style.setProperty('display', 'none', 'important');
            return;
          }
          const text = (article.textContent || '').trim();
          if (promotedPattern.test(text)) {
            article.style.setProperty('display', 'none', 'important');
          }
        });
      };

      let scheduled = false;
      const scheduleCleanup = () => {
        if (scheduled) return;
        scheduled = true;
        requestAnimationFrame(() => {
          scheduled = false;
          hidePromotedContent();
        });
      };

      hidePromotedContent();

      const observer = new MutationObserver(scheduleCleanup);
      observer.observe(document.documentElement, {
        childList: true, subtree: true, characterData: true
      });
    })();
    """#

    /// Auto-reload probe — a direct port of the desktop renderer's
    /// 15-second interval body. Returns true when the home link was clicked:
    /// only on a home timeline, only when scrolled to the top.
    static let autoReloadProbe = #"""
    (function() {
      try {
        const isHomePage =
          (window.location.hostname.includes('x.com') && window.location.pathname === '/home') ||
          (window.location.hostname.includes('mixi.social') && window.location.pathname === '/home') ||
          (window.location.hostname.includes('bsky.app') && window.location.pathname === '/');
        if (!isHomePage) return false;
        if (window.scrollY != 0) return false;
        const homeLink = document.querySelector('a[href="/home"]');
        if (homeLink) { homeLink.click(); return true; }
        return false;
      } catch (e) {
        return false;
      }
    })();
    """#
}
