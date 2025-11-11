// Tab interface
interface Tab {
  id: string;
  title: string;
  url: string;
  profile: string;
  webview: Electron.WebviewTag | null;
  wrapper: HTMLDivElement | null;
  order: number;
}

class CrossDeck {
  private tabs: Map<string, Tab> = new Map();
  private activeTabId: string | null = null;
  private profiles: string[] = [];
  private selectedProfile: string = '';
  private tabCounter: number = 0;
  private draggedTabId: string | null = null;

  constructor() {
    this.init();
  }

  async init() {
    await this.loadProfiles();
    this.setupEventListeners();
    this.updateProfileSelect();

    // Setup keyboard shortcut listener
    window.electronAPI.onSwitchTabShortcut((tabNumber) => {
      this.focusTabByPosition(tabNumber - 1); // Convert to 0-based index
    });

    // Load saved tabs or create initial tab
    const savedTabs = this.loadSavedTabs();
    if (savedTabs.length > 0) {
      // Restore saved tabs in order
      const sortedTabs = savedTabs.sort((a, b) => (a.order || 0) - (b.order || 0));
      for (const savedTab of sortedTabs) {
        await this.createTab(savedTab.profile, savedTab.url, savedTab.order);
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

  focusTabByPosition(position: number) {
    // Get tabs sorted by order
    const sortedTabs = Array.from(this.tabs.values()).sort((a, b) => a.order - b.order);

    if (position < sortedTabs.length) {
      const tab = sortedTabs[position];
      this.activateTab(tab.id);

      // Focus the webview
      if (tab.webview) {
        tab.webview.focus();
      }
    }
  }

  async createTab(profile: string, url: string = 'https://twitter.com', order?: number) {
    const tabId = `tab-${++this.tabCounter}`;

    const tab: Tab = {
      id: tabId,
      title: 'X / Twitter',
      url: url,
      profile: profile,
      webview: null,
      wrapper: null,
      order: order !== undefined ? order : this.tabs.size
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
    tabHeader.draggable = true;

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
    });

    // Drag and drop event handlers
    tabHeader.addEventListener('dragstart', (e) => this.handleDragStart(e, tab.id));
    tabHeader.addEventListener('dragend', (e) => this.handleDragEnd(e));

    wrapper.addEventListener('dragover', (e) => this.handleDragOver(e, tab.id));
    wrapper.addEventListener('drop', (e) => this.handleDrop(e, tab.id));
    wrapper.addEventListener('dragleave', (e) => this.handleDragLeave(e));

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

    // Activate tab when webview receives focus
    webview.addEventListener('focus', () => {
      this.activateTab(tab.id);
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

    // Remove focus from all webviews and deactivate wrappers
    this.tabs.forEach(t => {
      if (t.wrapper) {
        t.wrapper.classList.remove('active');
      }
      if (t.webview) {
        // Remove focus from inactive webviews
        if (t.id !== tabId) {
          t.webview.blur();
        }
      }
    });

    // Activate the selected tab
    if (tab.wrapper) {
      tab.wrapper.classList.add('active');

      // Scroll into view if not visible
      tab.wrapper.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'nearest'
      });
    }

    // Focus the active webview
    if (tab.webview) {
      tab.webview.focus();
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
    const tabsToSave = Array.from(this.tabs.values())
      .sort((a, b) => a.order - b.order)
      .map(tab => ({
        url: tab.url,
        profile: tab.profile,
        order: tab.order
      }));
    localStorage.setItem('xbrowser-tabs', JSON.stringify(tabsToSave));
  }

  loadSavedTabs(): Array<{ url: string; profile: string; order: number }> {
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
      item.dataset.profile = profile;

      const name = document.createElement('span');
      name.className = 'profile-name';
      name.textContent = profile;

      const buttonGroup = document.createElement('div');
      buttonGroup.className = 'profile-buttons';

      const renameBtn = document.createElement('button');
      renameBtn.className = 'profile-rename';
      renameBtn.textContent = 'Rename';
      renameBtn.addEventListener('click', () => {
        this.showRenameInput(item, profile);
      });

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'profile-delete';
      deleteBtn.textContent = 'Delete';
      deleteBtn.addEventListener('click', () => {
        this.deleteProfile(profile);
      });

      buttonGroup.appendChild(renameBtn);
      buttonGroup.appendChild(deleteBtn);

      item.appendChild(name);
      item.appendChild(buttonGroup);
      list.appendChild(item);
    });
  }

  showRenameInput(item: HTMLElement, oldName: string) {
    const nameSpan = item.querySelector('.profile-name') as HTMLElement;
    const buttonGroup = item.querySelector('.profile-buttons') as HTMLElement;

    // Hide current name and buttons
    nameSpan.style.display = 'none';
    buttonGroup.style.display = 'none';

    // Create input field
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'profile-rename-input';
    input.value = oldName;
    input.style.flex = '1';
    input.style.padding = '6px 10px';
    input.style.background = '#2a2a2a';
    input.style.border = '1px solid #1da1f2';
    input.style.borderRadius = '4px';
    input.style.color = '#ffffff';
    input.style.fontSize = '14px';

    // Create confirm/cancel buttons
    const confirmBtn = document.createElement('button');
    confirmBtn.textContent = '✓';
    confirmBtn.className = 'btn';
    confirmBtn.style.padding = '6px 12px';
    confirmBtn.style.background = '#27ae60';

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = '✗';
    cancelBtn.className = 'btn';
    cancelBtn.style.padding = '6px 12px';

    const inputGroup = document.createElement('div');
    inputGroup.style.display = 'flex';
    inputGroup.style.gap = '8px';
    inputGroup.style.flex = '1';
    inputGroup.appendChild(input);
    inputGroup.appendChild(confirmBtn);
    inputGroup.appendChild(cancelBtn);

    item.insertBefore(inputGroup, buttonGroup);
    input.focus();
    input.select();

    const cleanup = () => {
      inputGroup.remove();
      nameSpan.style.display = '';
      buttonGroup.style.display = '';
    };

    const confirm = async () => {
      const newName = input.value.trim();
      if (newName && newName !== oldName) {
        await this.renameProfile(oldName, newName);
      }
      cleanup();
    };

    confirmBtn.addEventListener('click', confirm);
    cancelBtn.addEventListener('click', cleanup);

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        confirm();
      } else if (e.key === 'Escape') {
        cleanup();
      }
    });

    input.addEventListener('blur', () => {
      // Delay to allow button clicks to register
      setTimeout(cleanup, 200);
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

  async renameProfile(oldName: string, newName: string) {
    if (this.profiles.includes(newName)) {
      alert('A profile with this name already exists');
      return;
    }

    const result = await window.electronAPI.renameProfile(oldName, newName);

    if (result.success) {
      // Update all tabs using this profile
      this.tabs.forEach(tab => {
        if (tab.profile === oldName) {
          tab.profile = newName;
          // Update the badge text in the tab header
          const badge = tab.wrapper?.querySelector('.tab-profile-badge');
          if (badge) {
            badge.textContent = newName;
          }
        }
      });

      // Update selected profile if it was the renamed one
      if (this.selectedProfile === oldName) {
        this.selectedProfile = newName;
      }

      // Reload profiles and update UI
      await this.loadProfiles();
      this.updateProfileList();
      this.updateProfileSelect();

      // Update selected profile in dropdown
      if (this.selectedProfile === newName) {
        document.querySelector<HTMLSelectElement>('#profile-select')!.value = newName;
      }

      // Save tabs with updated profile names
      this.saveTabs();
    } else {
      alert(result.error || 'Failed to rename profile');
    }
  }

  // Drag and drop handlers
  handleDragStart(e: DragEvent, tabId: string) {
    this.draggedTabId = tabId;
    const tabHeader = e.target as HTMLElement;
    tabHeader.classList.add('dragging');

    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/html', tabId);
    }
  }

  handleDragEnd(e: DragEvent) {
    const tabHeader = e.target as HTMLElement;
    tabHeader.classList.remove('dragging');

    // Remove all drag-over classes
    document.querySelectorAll('.webview-wrapper').forEach(wrapper => {
      wrapper.classList.remove('drag-over');
    });

    this.draggedTabId = null;
  }

  handleDragOver(e: DragEvent, targetTabId: string) {
    e.preventDefault();

    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'move';
    }

    if (this.draggedTabId && this.draggedTabId !== targetTabId) {
      const targetWrapper = e.currentTarget as HTMLElement;
      targetWrapper.classList.add('drag-over');
    }
  }

  handleDragLeave(e: DragEvent) {
    const wrapper = e.currentTarget as HTMLElement;
    wrapper.classList.remove('drag-over');
  }

  handleDrop(e: DragEvent, targetTabId: string) {
    e.preventDefault();
    e.stopPropagation();

    const wrapper = e.currentTarget as HTMLElement;
    wrapper.classList.remove('drag-over');

    if (this.draggedTabId && this.draggedTabId !== targetTabId) {
      this.reorderTabs(this.draggedTabId, targetTabId);
    }
  }

  reorderTabs(draggedId: string, targetId: string) {
    const draggedTab = this.tabs.get(draggedId);
    const targetTab = this.tabs.get(targetId);

    if (!draggedTab || !targetTab || !draggedTab.wrapper || !targetTab.wrapper) return;

    const container = document.getElementById('views-container')!;

    // Move dragged wrapper before target wrapper
    container.insertBefore(draggedTab.wrapper, targetTab.wrapper);

    // Update order for all tabs based on current DOM position
    const wrappers = Array.from(container.children);
    wrappers.forEach((wrapper, index) => {
      const tabId = (wrapper as HTMLElement).dataset.tabId;
      if (tabId) {
        const tab = this.tabs.get(tabId);
        if (tab) {
          tab.order = index;
        }
      }
    });

    // Save the new order
    this.saveTabs();
  }
}

// Initialize the app when DOM is ready
new CrossDeck();
