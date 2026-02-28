import { Plugin, TFile } from "obsidian";
import { ClaudianSettings, DEFAULT_SETTINGS, ClaudianSettingTab } from "./src/settings";
import { ClaudianModal } from "./src/modal";

export default class ClaudianPlugin extends Plugin {
  settings!: ClaudianSettings;

  async onload(): Promise<void> {
    await this.loadSettings();

    this.addSettingTab(new ClaudianSettingTab(this.app, this));

    this.addCommand({
      id: "open-claudian-modal",
      name: "Open Claudian",
      hotkeys: [{ modifiers: ["Mod", "Shift"], key: "c" }],
      callback: () => this.openModal(),
    });

    this.addRibbonIcon("bot", "Open Claudian", () => this.openModal());
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    // Ensure nested permissions object is fully merged
    this.settings.permissions = Object.assign(
      {},
      DEFAULT_SETTINGS.permissions,
      this.settings.permissions
    );
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  openModal(): void {
    const vaultPath = this.getVaultPath();
    if (!vaultPath) {
      console.error("Claudian: Could not determine vault path");
      return;
    }

    const activeFile = this.app.workspace.getActiveFile();
    const currentFilePath: string | null = activeFile instanceof TFile
      ? activeFile.path
      : null;

    new ClaudianModal(
      this.app,
      this.settings,
      vaultPath,
      currentFilePath
    ).open();
  }

  private getVaultPath(): string | null {
    const adapter = this.app.vault.adapter as { getBasePath?: () => string };
    if (typeof adapter.getBasePath === "function") {
      return adapter.getBasePath();
    }
    return null;
  }
}
