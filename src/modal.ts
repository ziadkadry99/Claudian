import { App, Modal } from "obsidian";
import {
  ClaudeRunner,
  ToolUseEvent,
  ToolResultEvent,
  runClaude,
} from "./claude-runner";
import type { ClaudianSettings } from "./settings";

interface ToolCard {
  toolUse: ToolUseEvent;
  toolResult?: ToolResultEvent;
  headerEl: HTMLElement;
  bodyEl: HTMLElement;
  resultEl: HTMLElement;
  isExpanded: boolean;
}

type ModalStatus = "idle" | "running" | "done" | "error" | "cancelled";

export class ClaudianModal extends Modal {
  private settings: ClaudianSettings;
  private vaultPath: string;
  private currentFilePath: string | null;

  private promptTextarea!: HTMLTextAreaElement;
  private outputEl!: HTMLElement;
  private statusEl!: HTMLElement;
  private runBtn!: HTMLButtonElement;
  private cancelBtn!: HTMLButtonElement;

  private runner: ClaudeRunner | null = null;
  private status: ModalStatus = "idle";
  private toolCards: Map<string, ToolCard> = new Map();
  private turns = 0;
  private costUsd = 0;
  private currentTextBlock: HTMLElement | null = null;

  constructor(
    app: App,
    settings: ClaudianSettings,
    vaultPath: string,
    currentFilePath: string | null
  ) {
    super(app);
    this.settings = settings;
    this.vaultPath = vaultPath;
    this.currentFilePath = currentFilePath;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.addClass("claudian-modal");
    this.modalEl.addClass("claudian-modal-outer");

    // Header
    const headerEl = contentEl.createDiv("claudian-header");
    headerEl.createEl("h2", { text: "Claudian", cls: "claudian-title" });
    if (this.currentFilePath) {
      headerEl.createEl("span", {
        text: `Active file: ${this.currentFilePath}`,
        cls: "claudian-active-file",
      });
    } else {
      headerEl.createEl("span", {
        text: "No active file",
        cls: "claudian-active-file claudian-active-file--none",
      });
    }

    // Prompt area
    const promptEl = contentEl.createDiv("claudian-prompt-area");
    this.promptTextarea = promptEl.createEl("textarea", {
      cls: "claudian-textarea",
      attr: {
        placeholder: "What should Claude do? (Ctrl+Enter to run)",
        rows: "3",
      },
    });

    this.promptTextarea.addEventListener("keydown", (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        this.handleRun();
      }
      if (e.key === "Escape") {
        this.handleCancel();
      }
    });

    // Buttons
    const buttonsEl = contentEl.createDiv("claudian-buttons");
    this.cancelBtn = buttonsEl.createEl("button", {
      text: "Cancel",
      cls: "claudian-btn claudian-btn--cancel",
    });
    this.cancelBtn.addEventListener("click", () => this.handleCancel());

    this.runBtn = buttonsEl.createEl("button", {
      text: "Run (Ctrl+\u23CE)",
      cls: "claudian-btn claudian-btn--run",
    });
    this.runBtn.addEventListener("click", () => this.handleRun());

    // Divider
    contentEl.createEl("hr", { cls: "claudian-divider" });

    // Output area
    this.outputEl = contentEl.createDiv("claudian-output");

    // Status line
    this.statusEl = contentEl.createDiv("claudian-status");
    this.statusEl.style.display = "none";

    // Focus textarea
    setTimeout(() => this.promptTextarea.focus(), 50);
  }

  onClose(): void {
    if (this.runner) {
      this.runner.kill();
      this.runner = null;
    }
    const { contentEl } = this;
    contentEl.empty();
  }

  private handleRun(): void {
    if (this.status === "running") return;

    const prompt = this.promptTextarea.value.trim();
    if (!prompt) return;

    // Clear previous output
    this.outputEl.empty();
    this.toolCards.clear();
    this.currentTextBlock = null;
    this.turns = 0;
    this.costUsd = 0;

    this.setStatus("running");

    this.runner = runClaude({
      prompt,
      vaultPath: this.vaultPath,
      currentFilePath: this.currentFilePath,
      settings: this.settings,
      callbacks: {
        onText: (text) => this.handleText(text),
        onToolUse: (event) => this.handleToolUse(event),
        onToolResult: (event) => this.handleToolResult(event),
        onSystemInit: (_sessionId, _tools) => {
          // Could display session info if desired
        },
        onDone: (turns, costUsd) => {
          this.turns = turns;
          this.costUsd = costUsd;
          this.setStatus("done");
        },
        onError: (message) => {
          this.appendError(message);
          this.setStatus("error");
        },
      },
    });
  }

  private handleCancel(): void {
    if (this.status === "running" && this.runner) {
      this.runner.kill();
      this.runner = null;
      this.setStatus("cancelled");
    } else {
      this.close();
    }
  }

  private handleText(text: string): void {
    // Append to current text block or create a new one
    if (!this.currentTextBlock) {
      this.currentTextBlock = this.outputEl.createDiv("claudian-text-block");
    }
    this.currentTextBlock.textContent =
      (this.currentTextBlock.textContent ?? "") + text;
    this.scrollOutputToBottom();
  }

  private handleToolUse(event: ToolUseEvent): void {
    // Reset text block so next text starts fresh after this tool card
    this.currentTextBlock = null;

    const cardEl = this.outputEl.createDiv("claudian-tool-card");

    const headerEl = cardEl.createDiv("claudian-tool-card__header");
    const toggleEl = headerEl.createSpan({
      text: "\u25B6",
      cls: "claudian-tool-card__toggle",
    });
    headerEl.createSpan({
      text: event.name,
      cls: "claudian-tool-card__name",
    });

    const inputSummary = this.summarizeToolInput(event.name, event.input);
    headerEl.createSpan({
      text: inputSummary,
      cls: "claudian-tool-card__summary",
    });

    const bodyEl = cardEl.createDiv("claudian-tool-card__body");
    bodyEl.style.display = "none";

    const inputEl = bodyEl.createEl("pre", { cls: "claudian-tool-card__input" });
    inputEl.textContent = JSON.stringify(event.input, null, 2);

    const resultEl = bodyEl.createDiv("claudian-tool-card__result");
    resultEl.textContent = "Waiting for result...";

    const card: ToolCard = {
      toolUse: event,
      headerEl,
      bodyEl,
      resultEl,
      isExpanded: false,
    };

    this.toolCards.set(event.id, card);

    headerEl.addEventListener("click", () => {
      card.isExpanded = !card.isExpanded;
      bodyEl.style.display = card.isExpanded ? "block" : "none";
      toggleEl.textContent = card.isExpanded ? "\u25BC" : "\u25B6";
    });

    this.scrollOutputToBottom();
  }

  private handleToolResult(event: ToolResultEvent): void {
    const card = this.toolCards.get(event.tool_use_id);
    if (!card) return;

    card.toolResult = event;

    const maxLen = 500;
    const display =
      event.content.length > maxLen
        ? event.content.slice(0, maxLen) + "\n… (truncated)"
        : event.content;

    card.resultEl.textContent = display;
    card.resultEl.addClass("claudian-tool-card__result--done");

    this.scrollOutputToBottom();
  }

  private appendError(message: string): void {
    this.currentTextBlock = null;
    const errorEl = this.outputEl.createDiv("claudian-error-block");
    errorEl.textContent = message;
    this.scrollOutputToBottom();
  }

  private setStatus(status: ModalStatus): void {
    this.status = status;
    this.statusEl.style.display = "block";
    this.statusEl.className = "claudian-status";

    switch (status) {
      case "running":
        this.statusEl.addClass("claudian-status--running");
        this.statusEl.textContent = "Running...";
        this.runBtn.disabled = true;
        this.cancelBtn.textContent = "Stop";
        break;

      case "done":
        this.statusEl.addClass("claudian-status--done");
        this.statusEl.textContent = `Done (${this.turns} turn${
          this.turns !== 1 ? "s" : ""
        } \u00B7 $${this.costUsd.toFixed(4)})`;
        this.runBtn.disabled = false;
        this.cancelBtn.textContent = "Close";
        break;

      case "error":
        this.statusEl.addClass("claudian-status--error");
        this.statusEl.textContent = "Error occurred. See output above.";
        this.runBtn.disabled = false;
        this.cancelBtn.textContent = "Close";
        break;

      case "cancelled":
        this.statusEl.addClass("claudian-status--cancelled");
        this.statusEl.textContent = "Cancelled.";
        this.runBtn.disabled = false;
        this.cancelBtn.textContent = "Close";
        break;

      case "idle":
        this.statusEl.style.display = "none";
        this.runBtn.disabled = false;
        this.cancelBtn.textContent = "Cancel";
        break;
    }
  }

  private summarizeToolInput(
    toolName: string,
    input: Record<string, unknown>
  ): string {
    switch (toolName) {
      case "Read":
        return String(input.file_path ?? "");
      case "Edit":
        return String(input.file_path ?? "");
      case "Write":
        return String(input.file_path ?? "");
      case "Glob":
        return String(input.pattern ?? "");
      case "Grep":
        return String(input.pattern ?? "");
      case "LS":
        return String(input.path ?? ".");
      default:
        return Object.keys(input).slice(0, 2).join(", ");
    }
  }

  private scrollOutputToBottom(): void {
    this.outputEl.scrollTop = this.outputEl.scrollHeight;
  }
}
