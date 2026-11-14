import SwiftUI

struct ContentView: View {
    @EnvironmentObject var state: AppState
    @State private var showProfiles = false

    private var visibleTabs: [TabData] {
        let sorted = state.tabs.sorted { $0.order < $1.order }
        if state.isColumnFullscreen, let fid = state.fullscreenTabID {
            return sorted.filter { $0.id == fid }
        }
        return sorted
    }

    var body: some View {
        VStack(spacing: 0) {
            toolbar
            columns
        }
        .background(Color(red: 0.10, green: 0.10, blue: 0.10))
        .sheet(isPresented: $showProfiles) {
            ProfileManagerView()
        }
        .alert("Error", isPresented: Binding(
            get: { state.errorMessage != nil },
            set: { if !$0 { state.errorMessage = nil } }
        )) {
            Button("OK") { state.errorMessage = nil }
        } message: {
            Text(state.errorMessage ?? "")
        }
        .background(shortcutButtons)
    }

    // MARK: - Toolbar (mirrors the desktop top toolbar + active-tab nav)

    private var toolbar: some View {
        HStack(spacing: 8) {
            Menu {
                ForEach(state.profiles) { profile in
                    Button(profile.name) { state.createTab(profile: profile) }
                }
            } label: {
                Image(systemName: "plus")
                    .frame(width: 32, height: 28)
            }
            .accessibilityLabel("New tab")

            Button { showProfiles = true } label: {
                Image(systemName: "gearshape")
                    .frame(width: 32, height: 28)
            }
            .accessibilityLabel("Manage profiles")

            Divider().frame(height: 20)

            if let webTab = state.activeWebTab {
                NavButtons(webTab: webTab)
            }

            Spacer()

            if let tab = state.activeTabData() {
                Text(tab.profileName)
                    .font(.caption)
                    .foregroundColor(.gray)
                    .lineLimit(1)
            }

            Button { state.activeWebTab?.toggleSidebar() } label: { Image(systemName: "sidebar.left") }
                .accessibilityLabel("Toggle sidebar")
            Button { state.activeWebTab?.zoomOut() } label: { Image(systemName: "minus.magnifyingglass") }
            Button { state.activeWebTab?.zoomReset() } label: { Image(systemName: "magnifyingglass") }
            Button { state.activeWebTab?.zoomIn() } label: { Image(systemName: "plus.magnifyingglass") }
            Button { state.toggleColumnFullscreen() } label: {
                Image(systemName: state.isColumnFullscreen ? "rectangle.split.3x1" : "rectangle.expand.vertical")
            }
            .accessibilityLabel("Toggle column fullscreen")
        }
        .buttonStyle(.bordered)
        .controlSize(.small)
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(Color(red: 0.16, green: 0.16, blue: 0.16))
    }

    // MARK: - Columns (desktop: horizontal grid, min 400px per column)

    private var columns: some View {
        GeometryReader { geo in
            ScrollViewReader { proxy in
                ScrollView(.horizontal, showsIndicators: true) {
                    HStack(spacing: 1) {
                        ForEach(visibleTabs) { tab in
                            ColumnView(tab: tab)
                                .frame(width: state.isColumnFullscreen ? geo.size.width : 400)
                                .id(tab.id)
                        }
                    }
                }
                .background(Color(red: 0.23, green: 0.23, blue: 0.23))
                .onChange(of: state.activeTabID) { _, newValue in
                    guard let newValue, !state.isColumnFullscreen else { return }
                    withAnimation { proxy.scrollTo(newValue, anchor: .center) }
                }
            }
        }
    }

    // MARK: - Keyboard shortcuts (desktop menu accelerators)
    // Hidden buttons so hardware keyboards on iPad get the same bindings:
    // ⌘1-9 switch tab, ⌘R reload, ⌘G column fullscreen, ⌘\ sidebar,
    // ⌘0 / ⌘+ / ⌘- zoom, ⌘[ / ⌘] back / forward.

    private var shortcutButtons: some View {
        ZStack {
            ForEach(1...9, id: \.self) { n in
                Button("") { state.activateTabByPosition(n) }
                    .keyboardShortcut(KeyEquivalent(Character("\(n)")), modifiers: .command)
            }
            Button("") { state.activeWebTab?.reload() }
                .keyboardShortcut("r", modifiers: .command)
            Button("") { state.toggleColumnFullscreen() }
                .keyboardShortcut("g", modifiers: .command)
            Button("") { state.activeWebTab?.toggleSidebar() }
                .keyboardShortcut("\\", modifiers: .command)
            Button("") { state.activeWebTab?.zoomReset() }
                .keyboardShortcut("0", modifiers: .command)
            Button("") { state.activeWebTab?.zoomIn() }
                .keyboardShortcut("+", modifiers: .command)
            Button("") { state.activeWebTab?.zoomOut() }
                .keyboardShortcut("-", modifiers: .command)
            Button("") { state.activeWebTab?.goBack() }
                .keyboardShortcut("[", modifiers: .command)
            Button("") { state.activeWebTab?.goForward() }
                .keyboardShortcut("]", modifiers: .command)
        }
        .opacity(0)
        .frame(width: 0, height: 0)
        .accessibilityHidden(true)
    }
}

/// Back / forward / reload for the active tab, observing its live state.
private struct NavButtons: View {
    @ObservedObject var webTab: WebTab

    var body: some View {
        HStack(spacing: 8) {
            Button { webTab.goBack() } label: { Image(systemName: "chevron.left") }
                .disabled(!webTab.canGoBack)
            Button { webTab.goForward() } label: { Image(systemName: "chevron.right") }
                .disabled(!webTab.canGoForward)
            Button { webTab.reload() } label: { Image(systemName: "arrow.clockwise") }
        }
    }
}
