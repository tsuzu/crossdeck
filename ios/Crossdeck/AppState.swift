import Foundation
import SwiftUI

/// All app state, mirroring the desktop pair (main.ts profile store +
/// renderer.ts tab store) in one observable object.
@MainActor
final class AppState: ObservableObject {
    @Published private(set) var profiles: [ProfileData] = []
    @Published private(set) var tabs: [TabData] = []
    @Published var activeTabID: UUID?
    @Published var isColumnFullscreen: Bool = false
    @Published var fullscreenTabID: UUID?
    @Published var errorMessage: String?

    /// Live web views by tab ID, created lazily and kept out of the
    /// persisted model.
    private var webTabs: [UUID: WebTab] = [:]

    init() {
        load()
    }

    // MARK: - Loading / persistence

    private func load() {
        if let saved: [ProfileData] = Persistence.load([ProfileData].self, file: Persistence.profilesFile), !saved.isEmpty {
            profiles = saved
        } else {
            profiles = [ProfileData(name: "Default")]
            saveProfiles()
        }

        if let saved: [TabData] = Persistence.load([TabData].self, file: Persistence.tabsFile), !saved.isEmpty {
            tabs = saved.sorted { $0.order < $1.order }
        } else if let first = profiles.first {
            let tab = TabData(profile: first, url: first.homepage, order: 0)
            tabs = [tab]
            saveTabs()
        }
        activeTabID = tabs.first?.id
    }

    private func saveProfiles() {
        Persistence.save(profiles, file: Persistence.profilesFile)
    }

    private func saveTabs() {
        Persistence.save(tabs, file: Persistence.tabsFile)
    }

    // MARK: - WebTab registry

    func webTab(for tab: TabData) -> WebTab {
        if let existing = webTabs[tab.id] {
            return existing
        }
        let webTab = WebTab(tab: tab)
        webTab.onNavigate = { [weak self] tabID, url in
            self?.tabDidNavigate(tabID: tabID, url: url)
        }
        webTab.onActivate = { [weak self] tabID in
            guard let self, self.activeTabID != tabID else { return }
            self.activateTab(tabID)
        }
        webTabs[tab.id] = webTab
        return webTab
    }

    func webTabIfExists(for tabID: UUID) -> WebTab? {
        webTabs[tabID]
    }

    var activeWebTab: WebTab? {
        guard let activeTabID else { return nil }
        return webTabs[activeTabID]
    }

    func activeTabData() -> TabData? {
        tabs.first { $0.id == activeTabID }
    }

    private func tabDidNavigate(tabID: UUID, url: String) {
        guard let idx = tabs.firstIndex(where: { $0.id == tabID }), tabs[idx].url != url else { return }
        tabs[idx].url = url
        saveTabs()
    }

    // MARK: - Tabs

    func createTab(profile: ProfileData, url: String? = nil) {
        let order = (tabs.map(\.order).max() ?? -1) + 1
        let tab = TabData(profile: profile, url: url ?? profile.homepage, order: order)
        tabs.append(tab)
        activeTabID = tab.id
        saveTabs()
    }

    func closeTab(_ tabID: UUID) {
        guard let idx = tabs.firstIndex(where: { $0.id == tabID }) else { return }
        webTabs[tabID]?.teardown()
        webTabs[tabID] = nil
        tabs.remove(at: idx)
        renormalizeOrder()
        if activeTabID == tabID {
            activeTabID = tabs.first?.id
        }
        if tabs.isEmpty {
            isColumnFullscreen = false
            fullscreenTabID = nil
        }
        saveTabs()
    }

    func activateTab(_ tabID: UUID) {
        activeTabID = tabID
        if isColumnFullscreen {
            fullscreenTabID = tabID
        }
    }

    /// Switch by 1-based position, like the desktop Cmd/Ctrl+1-9 shortcut.
    func activateTabByPosition(_ position: Int) {
        let sorted = tabs.sorted { $0.order < $1.order }
        guard position >= 1, position <= sorted.count else { return }
        activateTab(sorted[position - 1].id)
    }

    func moveTab(_ tabID: UUID, before targetID: UUID) {
        guard tabID != targetID,
              let from = tabs.firstIndex(where: { $0.id == tabID }),
              let to = tabs.firstIndex(where: { $0.id == targetID }) else { return }
        let moving = tabs.remove(at: from)
        let newIndex = tabs.firstIndex(where: { $0.id == targetID }) ?? to
        tabs.insert(moving, at: newIndex)
        renormalizeOrder()
        saveTabs()
    }

    func moveTabByOffset(_ tabID: UUID, offset: Int) {
        guard let idx = tabs.firstIndex(where: { $0.id == tabID }) else { return }
        let destination = idx + offset
        guard destination >= 0, destination < tabs.count else { return }
        tabs.swapAt(idx, destination)
        renormalizeOrder()
        saveTabs()
    }

    private func renormalizeOrder() {
        tabs = tabs.sorted { $0.order < $1.order }
        for i in tabs.indices { tabs[i].order = i }
    }

    func toggleAutoReload(_ tabID: UUID) {
        guard let idx = tabs.firstIndex(where: { $0.id == tabID }) else { return }
        tabs[idx].autoReloadEnabled.toggle()
        webTabs[tabID]?.autoReloadEnabled = tabs[idx].autoReloadEnabled
        saveTabs()
    }

    // MARK: - Column fullscreen (desktop: Cmd/Ctrl+G)

    func toggleColumnFullscreen() {
        guard let activeTabID else { return }
        if isColumnFullscreen && fullscreenTabID == activeTabID {
            isColumnFullscreen = false
            fullscreenTabID = nil
        } else {
            isColumnFullscreen = true
            fullscreenTabID = activeTabID
        }
    }

    // MARK: - Profiles (validation mirrors main.ts IPC handlers)

    func createProfile(name: String, homepage: String) -> Bool {
        let name = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !name.isEmpty else { errorMessage = "Profile name cannot be empty"; return false }
        guard !profiles.contains(where: { $0.name == name }) else {
            errorMessage = "Profile already exists"
            return false
        }
        profiles.append(ProfileData(name: name, homepage: homepage.trimmingCharacters(in: .whitespacesAndNewlines)))
        saveProfiles()
        return true
    }

    func updateProfile(_ profileID: UUID, name: String, homepage: String) -> Bool {
        guard let idx = profiles.firstIndex(where: { $0.id == profileID }) else { return false }
        let name = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !name.isEmpty else { errorMessage = "Profile name cannot be empty"; return false }
        if name != profiles[idx].name, profiles.contains(where: { $0.name == name }) {
            errorMessage = "Profile with new name already exists"
            return false
        }
        profiles[idx].name = name
        profiles[idx].homepage = homepage.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            ? "https://x.com"
            : homepage.trimmingCharacters(in: .whitespacesAndNewlines)
        // Refresh the badge snapshot on this profile's tabs. The profile ID
        // (and therefore the login session) is preserved, like desktop.
        for i in tabs.indices where tabs[i].profileID == profileID {
            tabs[i].profileName = name
        }
        saveProfiles()
        saveTabs()
        return true
    }

    func deleteProfile(_ profileID: UUID) {
        guard let idx = profiles.firstIndex(where: { $0.id == profileID }) else { return }
        // Close this profile's tabs first: the data store cannot be removed
        // while a web view uses it.
        let doomed = tabs.filter { $0.profileID == profileID }
        for tab in doomed { closeTab(tab.id) }
        profiles.remove(at: idx)
        saveProfiles()
        DataStoreCache.shared.removeDataStore(for: profileID)
    }
}
