import Foundation
import WebKit

/// Cache of per-profile persistent data stores.
///
/// `WKWebsiteDataStore(forIdentifier:)` returns a *new* object on every call,
/// and web views holding different store objects do not share WebKit
/// processes even when the identifier matches. So each profile's store is
/// created once and reused — the iOS equivalent of Electron's
/// `session.fromPartition("persist:<id>")`.
final class DataStoreCache {
    static let shared = DataStoreCache()

    private var stores: [UUID: WKWebsiteDataStore] = [:]
    private let lock = NSLock()

    private init() {}

    func store(for profileID: UUID) -> WKWebsiteDataStore {
        lock.lock()
        defer { lock.unlock() }
        if let existing = stores[profileID] {
            return existing
        }
        let store = WKWebsiteDataStore(forIdentifier: profileID)
        stores[profileID] = store
        return store
    }

    /// Drop the cached reference. Must happen before `remove(forIdentifier:)`,
    /// which fails while anything still holds the store.
    func release(_ profileID: UUID) {
        lock.lock()
        stores[profileID] = nil
        lock.unlock()
    }

    /// Delete a profile's on-disk data store, retrying briefly to cover the
    /// gap between releasing the last reference and WebKit deallocating it.
    func removeDataStore(for profileID: UUID) {
        release(profileID)
        Task.detached {
            // Touch the default store first: the remove API can crash if no
            // data store instance has ever been created in the process.
            _ = WKWebsiteDataStore.default()
            for attempt in 0..<5 {
                do {
                    try await WKWebsiteDataStore.remove(forIdentifier: profileID)
                    return
                } catch {
                    if attempt == 4 {
                        print("Failed to remove data store for \(profileID): \(error)")
                    } else {
                        try? await Task.sleep(for: .milliseconds(250))
                    }
                }
            }
        }
    }
}
