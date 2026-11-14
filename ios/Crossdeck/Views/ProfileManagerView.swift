import SwiftUI

struct ProfileManagerView: View {
    @EnvironmentObject var state: AppState
    @Environment(\.dismiss) private var dismiss

    @State private var newName: String = ""
    @State private var newHomepage: String = ""
    @State private var editing: ProfileData?
    @State private var editName: String = ""
    @State private var editHomepage: String = ""
    @State private var profileToDelete: ProfileData?

    var body: some View {
        NavigationStack {
            List {
                Section("Profiles") {
                    ForEach(state.profiles) { profile in
                        VStack(alignment: .leading, spacing: 4) {
                            Text(profile.name).font(.headline)
                            Text(profile.homepage).font(.caption).foregroundColor(.gray)
                        }
                        .contentShape(Rectangle())
                        .onTapGesture {
                            editing = profile
                            editName = profile.name
                            editHomepage = profile.homepage
                        }
                        .swipeActions(edge: .trailing) {
                            Button("Delete", role: .destructive) { profileToDelete = profile }
                            Button("Edit") {
                                editing = profile
                                editName = profile.name
                                editHomepage = profile.homepage
                            }
                        }
                    }
                }

                Section("Add Profile") {
                    TextField("Profile name", text: $newName)
                    TextField("Homepage URL (default: https://x.com)", text: $newHomepage)
                        .textInputAutocapitalization(.never)
                    Button("Add Profile") {
                        if state.createProfile(name: newName, homepage: newHomepage) {
                            newName = ""
                            newHomepage = ""
                        }
                    }
                }
            }
            .navigationTitle("Manage Profiles")
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
            .sheet(item: $editing) { profile in
                NavigationStack {
                    Form {
                        TextField("Profile name", text: $editName)
                        TextField("Homepage URL", text: $editHomepage)
                            .textInputAutocapitalization(.never)
                    }
                    .navigationTitle("Edit Profile")
                    .toolbar {
                        ToolbarItem(placement: .cancellationAction) {
                            Button("Cancel") { editing = nil }
                        }
                        ToolbarItem(placement: .confirmationAction) {
                            Button("Save") {
                                if state.updateProfile(profile.id, name: editName, homepage: editHomepage) {
                                    editing = nil
                                }
                            }
                        }
                    }
                }
            }
            .alert("Delete profile?", isPresented: Binding(
                get: { profileToDelete != nil },
                set: { if !$0 { profileToDelete = nil } }
            )) {
                Button("Cancel", role: .cancel) { profileToDelete = nil }
                Button("Delete", role: .destructive) {
                    if let profile = profileToDelete {
                        state.deleteProfile(profile.id)
                    }
                    profileToDelete = nil
                }
            } message: {
                Text("Its tabs will close and its login session will be deleted. This cannot be undone.")
            }
        }
    }
}
