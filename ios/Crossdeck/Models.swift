import Foundation

/// Mirrors the desktop (Electron) ProfileData: `src/main.ts`.
struct ProfileData: Codable, Identifiable, Equatable {
    var id: UUID
    var name: String
    var homepage: String

    init(id: UUID = UUID(), name: String, homepage: String = "https://x.com") {
        self.id = id
        self.name = name
        self.homepage = homepage.isEmpty ? "https://x.com" : homepage
    }
}

/// Mirrors the desktop renderer's saved tab (`xbrowser-tabs` in localStorage).
struct TabData: Codable, Identifiable, Equatable {
    var id: UUID
    /// The profile this tab belongs to. The UUID is also the
    /// WKWebsiteDataStore identifier, exactly like Electron's
    /// `persist:<profile-id>` partition.
    var profileID: UUID
    /// Snapshot of the profile name, shown as the column badge.
    var profileName: String
    var url: String
    var order: Int
    var autoReloadEnabled: Bool

    init(id: UUID = UUID(), profile: ProfileData, url: String, order: Int, autoReloadEnabled: Bool = true) {
        self.id = id
        self.profileID = profile.id
        self.profileName = profile.name
        self.url = url
        self.order = order
        self.autoReloadEnabled = autoReloadEnabled
    }
}

/// JSON file persistence, mirroring the desktop app:
/// profiles in `profiles.json`, tabs (previously localStorage) in `tabs.json`,
/// both under Application Support/crossdeck.
enum Persistence {
    private static var directory: URL {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        let dir = base.appendingPathComponent("crossdeck", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir
    }

    static func load<T: Codable>(_ type: T.Type, file: String) -> T? {
        let url = directory.appendingPathComponent(file)
        guard let data = try? Data(contentsOf: url) else { return nil }
        return try? JSONDecoder().decode(type, from: data)
    }

    static func save<T: Codable>(_ value: T, file: String) {
        let url = directory.appendingPathComponent(file)
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        guard let data = try? encoder.encode(value) else { return }
        try? data.write(to: url, options: [.atomic])
    }

    static let profilesFile = "profiles.json"
    static let tabsFile = "tabs.json"
}
