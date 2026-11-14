import Foundation
import UIKit
import WebKit

/// One column's live web view, kept alive outside the SwiftUI view tree so
/// that re-renders never recreate it (recreating a WKWebView loses the page
/// and, with a fresh data-store object, the shared WebKit process).
final class WebTab: NSObject, ObservableObject {
    let tabID: UUID
    let webView: WKWebView

    @Published var title: String = "X / Twitter"
    @Published var estimatedProgress: Double = 0
    @Published var canGoBack: Bool = false
    @Published var canGoForward: Bool = false

    var autoReloadEnabled: Bool {
        didSet { restartAutoReloadTimer() }
    }

    /// Called on every navigation with the tab's current URL (mirrors the
    /// desktop renderer's did-navigate / did-navigate-in-page -> saveTabs).
    var onNavigate: ((UUID, String) -> Void)?

    /// Called when the user touches this column's web view, so the column
    /// becomes the active one. Without this, activation only happened via
    /// the SwiftUI tap gesture on the column container, which WKWebView
    /// content touches never reach — so the active tab stayed on the
    /// leftmost column and every keyboard shortcut acted on it.
    var onActivate: ((UUID) -> Void)?

    private var observations: [NSKeyValueObservation] = []
    private var interactionRecognizers: [UIGestureRecognizer] = []
    private var autoReloadTimer: Timer?

    /// Desktop Safari UA so X serves the desktop layout, like the
    /// Electron (Chromium desktop) build does.
    private static let desktopUserAgent =
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15"

    init(tab: TabData) {
        self.tabID = tab.id
        self.autoReloadEnabled = tab.autoReloadEnabled

        let config = WKWebViewConfiguration()
        // Profile isolation: one persistent data store per profile UUID.
        config.websiteDataStore = DataStoreCache.shared.store(for: tab.profileID)
        config.allowsInlineMediaPlayback = true

        let controller = WKUserContentController()
        controller.addUserScript(WKUserScript(source: Scripts.styleScript, injectionTime: .atDocumentEnd, forMainFrameOnly: false))
        controller.addUserScript(WKUserScript(source: Scripts.cleanupScript, injectionTime: .atDocumentEnd, forMainFrameOnly: false))
        config.userContentController = controller

        let webView = WKWebView(frame: .zero, configuration: config)
        webView.customUserAgent = Self.desktopUserAgent
        webView.allowsBackForwardNavigationGestures = false
        webView.scrollView.backgroundColor = UIColor(red: 0.10, green: 0.10, blue: 0.10, alpha: 1)
        self.webView = webView

        super.init()

        webView.navigationDelegate = self
        webView.uiDelegate = self

        // Activation tracking: any touch (tap or scroll drag) inside the
        // web view marks this column active. The recognizers observe only —
        // they never cancel or delay the web view's own handling, and they
        // recognize simultaneously with its internal recognizers.
        let tapRecognizer = UITapGestureRecognizer(target: self, action: #selector(handleInteractionGesture))
        tapRecognizer.cancelsTouchesInView = false
        tapRecognizer.delegate = self
        webView.addGestureRecognizer(tapRecognizer)
        let panRecognizer = UIPanGestureRecognizer(target: self, action: #selector(handleInteractionGesture))
        panRecognizer.cancelsTouchesInView = false
        panRecognizer.delegate = self
        webView.addGestureRecognizer(panRecognizer)
        interactionRecognizers = [tapRecognizer, panRecognizer]

        observations.append(webView.observe(\.title, options: [.new]) { [weak self] wv, _ in
            DispatchQueue.main.async { self?.title = wv.title ?? "X / Twitter" }
        })
        observations.append(webView.observe(\.estimatedProgress, options: [.new]) { [weak self] wv, _ in
            DispatchQueue.main.async { self?.estimatedProgress = wv.estimatedProgress }
        })
        observations.append(webView.observe(\.url, options: [.new]) { [weak self] wv, _ in
            guard let self, let url = wv.url?.absoluteString else { return }
            DispatchQueue.main.async {
                self.canGoBack = wv.canGoBack
                self.canGoForward = wv.canGoForward
                self.onNavigate?(self.tabID, url)
            }
        })

        if let url = URL(string: tab.url) {
            webView.load(URLRequest(url: url))
        }
        restartAutoReloadTimer()
    }

    deinit {
        autoReloadTimer?.invalidate()
        observations.forEach { $0.invalidate() }
    }

    @objc private func handleInteractionGesture() {
        onActivate?(tabID)
    }

    /// Move iOS keyboard focus (first responder) to this web view.
    ///
    /// Hardware-keyboard key events — including X's own in-page shortcuts
    /// such as "g h" / "g n" sequences and j/k — are delivered only to the
    /// page whose web view is first responder. Marking a column active in
    /// SwiftUI state does NOT move that focus: a web view that once took
    /// focus (usually the leftmost) keeps it until another web view
    /// explicitly becomes first responder, so keys kept being absorbed by
    /// the leftmost column even after activation tracking was fixed.
    func takeKeyboardFocus() {
        guard !webView.isFirstResponder else { return }
        webView.becomeFirstResponder()
    }

    func teardown() {
        autoReloadTimer?.invalidate()
        autoReloadTimer = nil
        for recognizer in interactionRecognizers {
            webView.removeGestureRecognizer(recognizer)
        }
        interactionRecognizers = []
        observations.forEach { $0.invalidate() }
        observations = []
        webView.stopLoading()
        webView.navigationDelegate = nil
        webView.uiDelegate = nil
        webView.removeFromSuperview()
    }

    // MARK: - Actions (mirror the desktop menu shortcuts)

    func reload() { webView.reload() }
    func goBack() { if webView.canGoBack { webView.goBack() } }
    func goForward() { if webView.canGoForward { webView.goForward() } }

    func zoomReset() { webView.pageZoom = 1.0 }
    func zoomIn() { webView.pageZoom = min(webView.pageZoom * 1.2, 3.0) }
    func zoomOut() { webView.pageZoom = max(webView.pageZoom / 1.2, 0.5) }

    func toggleSidebar() {
        webView.evaluateJavaScript("document.documentElement.classList.toggle('crossdeck-hide-sidebar'); void 0;")
    }

    // MARK: - Auto-reload (desktop: 15s interval per tab)

    private func restartAutoReloadTimer() {
        autoReloadTimer?.invalidate()
        autoReloadTimer = nil
        guard autoReloadEnabled else { return }
        autoReloadTimer = Timer.scheduledTimer(withTimeInterval: 15, repeats: true) { [weak self] _ in
            self?.runAutoReloadProbe()
        }
    }

    private func runAutoReloadProbe() {
        webView.evaluateJavaScript(Scripts.autoReloadProbe) { _, _ in }
    }
}

extension WebTab: WKNavigationDelegate {
    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url, let scheme = url.scheme?.lowercased() else {
            decisionHandler(.allow)
            return
        }
        // Only a small set of user-facing schemes goes to the system.
        // Everything else non-web (app deep links such as twitter:// that
        // pages attempt automatically on load, App Store schemes, ...) is
        // cancelled silently: opening it would yank the user out of the app
        // into Safari / another app, unlike a deliberate link tap.
        if ["mailto", "tel", "sms"].contains(scheme) {
            UIApplication.shared.open(url)
            decisionHandler(.cancel)
            return
        }
        if !["http", "https", "about", "file", "data"].contains(scheme) {
            decisionHandler(.cancel)
            return
        }
        decisionHandler(.allow)
    }
}

extension WebTab: UIGestureRecognizerDelegate {
    func gestureRecognizer(_ gestureRecognizer: UIGestureRecognizer, shouldRecognizeSimultaneouslyWith otherGestureRecognizer: UIGestureRecognizer) -> Bool {
        true
    }
}

extension WebTab: WKUIDelegate {
    /// window.open / target=_blank: load in the same column instead of
    /// dropping the navigation (desktop allows popups in the webview).
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if navigationAction.targetFrame == nil || navigationAction.targetFrame?.isMainFrame == false {
            webView.load(navigationAction.request)
        }
        return nil
    }
}
