// Tab interface
interface Tab {
  id: string;
  title: string;
  url: string;
  profile: string;
  webview: Electron.WebviewTag | null;
  wrapper: HTMLDivElement | null;
}

class XBrowser {
  private tabs: Map<string, Tab> = new Map();
  private activeTabId: string | null = null;
  private profiles: string[] = [];
  private selectedProfile: string = '';
  private tabCounter: number = 0;

  constructor() {
    this.init();
  }

  async init() {
    await this.loadProfiles();
    this.setupEventListeners();
    this.updateProfileSelect();

    // Load saved tabs or create initial tab
    const savedTabs = this.loadSavedTabs();
    if (savedTabs.length > 0) {
      // Restore saved tabs
      for (const savedTab of savedTabs) {
        await this.createTab(savedTab.profile, savedTab.url);
      }
    } else if (this.profiles.length > 0) {
      // Create initial tab with first profile if no saved tabs
      this.selectedProfile = this.profiles[0];
      document.querySelector<HTMLSelectElement>('#profile-select')!.value = this.selectedProfile;
      await this.createTab(this.selectedProfile);
    }
  }

  async loadProfiles() {
    this.profiles = await window.electronAPI.getProfiles();
  }

  setupEventListeners() {
    // New tab button
    document.getElementById('new-tab-btn')!.addEventListener('click', () => {
      if (this.selectedProfile) {
        this.createTab(this.selectedProfile);
      } else {
        alert('Please select a profile first');
      }
    });

    // Profile select
    document.getElementById('profile-select')!.addEventListener('change', (e) => {
      this.selectedProfile = (e.target as HTMLSelectElement).value;
    });

    // Manage profiles button
    document.getElementById('manage-profiles-btn')!.addEventListener('click', () => {
      this.openProfileModal();
    });

    // Close modal
    document.getElementById('close-modal-btn')!.addEventListener('click', () => {
      this.closeProfileModal();
    });

    // Add profile
    document.getElementById('add-profile-btn')!.addEventListener('click', () => {
      this.addProfile();
    });

    // Enter key in profile input
    document.getElementById('new-profile-name')!.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.addProfile();
      }
    });
  }

  async createTab(profile: string, url: string = 'https://twitter.com') {
    const tabId = `tab-${++this.tabCounter}`;

    const tab: Tab = {
      id: tabId,
      title: 'X / Twitter',
      url: url,
      profile: profile,
      webview: null,
      wrapper: null
    };

    this.tabs.set(tabId, tab);
    await this.createWebview(tab);
    this.activateTab(tabId);
    this.saveTabs();
  }

  async createWebview(tab: Tab) {
    // Create wrapper div
    const wrapper = document.createElement('div');
    wrapper.className = 'webview-wrapper';
    wrapper.dataset.tabId = tab.id;

    // Create tab header
    const tabHeader = document.createElement('div');
    tabHeader.className = 'tab-header';
    tabHeader.dataset.tabId = tab.id;

    const badge = document.createElement('span');
    badge.className = 'tab-profile-badge';
    badge.textContent = tab.profile;

    const title = document.createElement('span');
    title.className = 'tab-title';
    title.textContent = tab.title;

    const closeBtn = document.createElement('button');
    closeBtn.className = 'tab-close';
    closeBtn.textContent = '×';
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.closeTab(tab.id);
    });

    tabHeader.appendChild(badge);
    tabHeader.appendChild(title);
    tabHeader.appendChild(closeBtn);

    tabHeader.addEventListener('click', () => {
      this.activateTab(tab.id);
      console.log("clicked", tab.id);
    });

    // Append tab header to wrapper
    wrapper.appendChild(tabHeader);

    // Create webview
    const webview = document.createElement('webview') as Electron.WebviewTag;
    const partition = await window.electronAPI.getPartition(tab.profile);

    webview.setAttribute('src', tab.url);
    webview.setAttribute('partition', partition);
    webview.setAttribute('allowpopups', 'true');
    webview.dataset.tabId = tab.id;

    // Webview event listeners
    webview.addEventListener('page-title-updated', (e) => {
      tab.title = (e as any).title || 'X / Twitter';
      this.updateTabTitle(tab.id);
    });

    webview.addEventListener('did-navigate', (e) => {
      tab.url = (e as any).url;
      this.saveTabs();
    });

    webview.addEventListener('did-navigate-in-page', (e) => {
      tab.url = (e as any).url;
      this.saveTabs();
    });

    // Disable WebAuthn API to prevent infinite loading
    webview.addEventListener('dom-ready', () => {
      webview.executeJavaScript(`
        // Override navigator.credentials to immediately reject
        if (navigator.credentials) {
          Object.defineProperty(navigator, 'credentials', {
            value: {
              get: () => Promise.reject(new Error('WebAuthn not supported')),
              create: () => Promise.reject(new Error('WebAuthn not supported')),
              preventSilentAccess: () => Promise.resolve()
            },
            writable: false,
            configurable: false
          });
        }

        // Also override PublicKeyCredential if it exists
        if (window.PublicKeyCredential) {
          window.PublicKeyCredential = undefined;
        }

        // Hide the Twitter/X header
        const style = document.createElement('style');
        style.textContent = \`
          header[role="banner"] {
            display: none !important;
          }
          /* Adjust main content to fill the space */
          main {
            margin-top: 0 !important;
          }
          /* Hide Ads */
          div[data-testid=cellInnerDiv]:has(path[d="M19.498 3h-15c-1.381 0-2.5 1.12-2.5 2.5v13c0 1.38 1.119 2.5 2.5 2.5h15c1.381 0 2.5-1.12 2.5-2.5v-13c0-1.38-1.119-2.5-2.5-2.5zm-3.502 12h-2v-3.59l-5.293 5.3-1.414-1.42L12.581 10H8.996V8h7v7z"]) {
            display: none;
          }
        \`;
        document.head.appendChild(style);

        // Also hide header dynamically if loaded later
        const observer = new MutationObserver(() => {
          const headers = document.querySelectorAll('header[role="banner"]');
          headers.forEach(header => {
            header.style.display = 'none';
          });
        });
        observer.observe(document.body, { childList: true, subtree: true });
      `).catch((err: Error) => {
        console.error('Failed to inject custom scripts:', err);
      });
    });

    // Append webview to wrapper
    wrapper.appendChild(webview);

    // Append wrapper to container
    document.getElementById('views-container')!.appendChild(wrapper);

    tab.webview = webview;
    tab.wrapper = wrapper;
  }

  activateTab(tabId: string) {
    const tab = this.tabs.get(tabId);
    if (!tab) return;

    // Update active tab tracking
    this.activeTabId = tabId;

    // Highlight active webview wrapper
    document.querySelectorAll('.webview-wrapper').forEach(wrapper => {
      wrapper.classList.remove('active');
    });
    if (tab.wrapper) {
      tab.wrapper.classList.add('active');
    }
  }

  updateTabTitle(tabId: string) {
    const tab = this.tabs.get(tabId);
    if (!tab) return;

    const tabElement = document.querySelector(`[data-tab-id="${tabId}"] .tab-title`);
    if (tabElement) {
      tabElement.textContent = tab.title;
    }
  }

  closeTab(tabId: string) {
    const tab = this.tabs.get(tabId);
    if (!tab) return;

    // Remove wrapper (which contains the tab header and webview)
    if (tab.wrapper) {
      tab.wrapper.remove();
    }

    // Remove from tabs map
    this.tabs.delete(tabId);

    // Activate another tab if this was active
    if (this.activeTabId === tabId) {
      const remainingTabs = Array.from(this.tabs.keys());
      if (remainingTabs.length > 0) {
        this.activateTab(remainingTabs[0]);
      } else {
        this.activeTabId = null;
      }
    }

    // Save tabs after closing
    this.saveTabs();
  }

  saveTabs() {
    const tabsToSave = Array.from(this.tabs.values()).map(tab => ({
      url: tab.url,
      profile: tab.profile
    }));
    localStorage.setItem('xbrowser-tabs', JSON.stringify(tabsToSave));
  }

  loadSavedTabs(): Array<{ url: string; profile: string }> {
    try {
      const saved = localStorage.getItem('xbrowser-tabs');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (err) {
      console.error('Failed to load saved tabs:', err);
    }
    return [];
  }


  updateProfileSelect() {
    const select = document.querySelector<HTMLSelectElement>('#profile-select')!;
    select.innerHTML = '<option value="">Select Profile</option>';

    this.profiles.forEach(profile => {
      const option = document.createElement('option');
      option.value = profile;
      option.textContent = profile;
      select.appendChild(option);
    });

    if (this.selectedProfile) {
      select.value = this.selectedProfile;
    }
  }

  openProfileModal() {
    this.updateProfileList();
    document.getElementById('profile-modal')!.style.display = 'flex';
  }

  closeProfileModal() {
    document.getElementById('profile-modal')!.style.display = 'none';
  }

  updateProfileList() {
    const list = document.getElementById('profile-list')!;
    list.innerHTML = '';

    this.profiles.forEach(profile => {
      const item = document.createElement('div');
      item.className = 'profile-item';

      const name = document.createElement('span');
      name.className = 'profile-name';
      name.textContent = profile;

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'profile-delete';
      deleteBtn.textContent = 'Delete';
      deleteBtn.addEventListener('click', () => {
        this.deleteProfile(profile);
      });

      item.appendChild(name);
      item.appendChild(deleteBtn);
      list.appendChild(item);
    });
  }

  async addProfile() {
    const input = document.querySelector<HTMLInputElement>('#new-profile-name')!;
    const profileName = input.value.trim();

    if (!profileName) {
      alert('Please enter a profile name');
      return;
    }

    const result = await window.electronAPI.createProfile(profileName);

    if (result.success) {
      await this.loadProfiles();
      this.updateProfileList();
      this.updateProfileSelect();
      input.value = '';
    } else {
      alert(result.error || 'Failed to create profile');
    }
  }

  async deleteProfile(profileName: string) {
    // Check if any tabs are using this profile
    const tabsUsingProfile = Array.from(this.tabs.values()).filter(
      tab => tab.profile === profileName
    );

    if (tabsUsingProfile.length > 0) {
      if (!confirm(`${tabsUsingProfile.length} tab(s) are using this profile. Close them and delete?`)) {
        return;
      }

      // Close all tabs using this profile
      tabsUsingProfile.forEach(tab => {
        this.closeTab(tab.id);
      });
    }

    const result = await window.electronAPI.deleteProfile(profileName);

    if (result.success) {
      await this.loadProfiles();
      this.updateProfileList();
      this.updateProfileSelect();

      if (this.selectedProfile === profileName) {
        this.selectedProfile = '';
      }
    } else {
      alert(result.error || 'Failed to delete profile');
    }
  }
}

// Initialize the app when DOM is ready
new XBrowser();
