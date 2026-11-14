import SwiftUI
import WebKit

struct WebViewRepresentable: UIViewRepresentable {
    let webTab: WebTab

    func makeUIView(context: Context) -> WKWebView {
        webTab.webView
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}
}

/// One column: tab header (badge / title / auto-reload / close) over the
/// web view. Mirrors the desktop `.webview-wrapper`.
struct ColumnView: View {
    @EnvironmentObject var state: AppState
    let tab: TabData

    var body: some View {
        ColumnContent(tab: tab, webTab: state.webTab(for: tab))
    }
}

private struct ColumnContent: View {
    @EnvironmentObject var state: AppState
    let tab: TabData
    @ObservedObject var webTab: WebTab

    private var isActive: Bool { state.activeTabID == tab.id }

    var body: some View {
        VStack(spacing: 0) {
            header
            WebViewRepresentable(webTab: webTab)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            if webTab.estimatedProgress > 0 && webTab.estimatedProgress < 1 {
                ProgressView(value: webTab.estimatedProgress)
                    .progressViewStyle(.linear)
                    .frame(height: 2)
            }
        }
        .background(Color(red: 0.10, green: 0.10, blue: 0.10))
        .contentShape(Rectangle())
        .onTapGesture { state.activateTab(tab.id) }
        // On first appearance, the initially active column takes keyboard
        // focus so page shortcuts work from launch. Later appearances
        // (e.g. after scrolling) must not steal focus, so only the tab
        // that is active at appearance time does this; activation changes
        // afterwards go through AppState.activateTab.
        .onAppear {
            if state.activeTabID == tab.id {
                webTab.takeKeyboardFocus()
            }
        }
        .dropDestination(for: String.self) { items, _ in
            guard let uuidString = items.first,
                  let draggedID = UUID(uuidString: uuidString) else { return false }
            state.moveTab(draggedID, before: tab.id)
            return true
        }
    }

    private var header: some View {
        HStack(spacing: 8) {
            Text(tab.profileName)
                .font(.system(size: 10, weight: .semibold))
                .padding(.horizontal, 6)
                .padding(.vertical, 2)
                .background(Color.white.opacity(0.25))
                .cornerRadius(3)
                .lineLimit(1)

            Text(webTab.title)
                .font(.system(size: 13, weight: .medium))
                .lineLimit(1)
                .truncationMode(.tail)
                .frame(maxWidth: .infinity, alignment: .leading)

            Button {
                state.toggleAutoReload(tab.id)
            } label: {
                Image(systemName: "arrow.clockwise")
                    .font(.system(size: 12))
                    // Enabled = blue, except on the active (blue) header
                    // where it must be white to stay visible.
                    .foregroundColor(tab.autoReloadEnabled ? (isActive ? .white : Color(red: 0.11, green: 0.63, blue: 0.95)) : .gray)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Auto-reload")

            Button {
                state.closeTab(tab.id)
            } label: {
                Image(systemName: "xmark")
                    .font(.system(size: 12))
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Close tab")
        }
        .padding(.horizontal, 12)
        .frame(height: 32)
        .background(isActive ? Color(red: 0.11, green: 0.63, blue: 0.95) : Color(red: 0.16, green: 0.16, blue: 0.16))
        .foregroundColor(.white)
        // Drag the header to reorder, like the desktop tab headers.
        .draggable(tab.id.uuidString)
        .contextMenu {
            Button("Move Left") { state.moveTabByOffset(tab.id, offset: -1) }
            Button("Move Right") { state.moveTabByOffset(tab.id, offset: 1) }
            Button("Reload") { webTab.reload() }
            Button("Close") { state.closeTab(tab.id) }
        }
    }
}
