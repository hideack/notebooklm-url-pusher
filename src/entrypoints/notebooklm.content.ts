const SELECTORS = {
  addSourceButton: [
    'button.add-source-button[aria-label="ソースを追加"]',
    'button.add-source-button[aria-label="Add source"]',
    'button[aria-label*="ソース"]',
    'button[aria-label*="Source"]',
    'button[title*="ソース"]',
    'button[title*="Source"]',
  ],
  dialog: [
    'mat-dialog-container[role="dialog"]',
    "mat-dialog-container",
    "mat-bottom-sheet-container",
    'div[role="dialog"]',
  ],
  dialogCloseButton: [
    'button[aria-label="閉じる"]',
    'button[aria-label="Close"]',
    "button.close-button",
  ],
  urlInput: [
    'textarea[formcontrolname="urls"]',
    'input[formcontrolname="urls"]',
    'textarea[formcontrolname="url"]',
    'input[formcontrolname="url"]',
    'textarea[formcontrolname="discoverSourcesQuery"]',
    'input[formcontrolname="discoverSourcesQuery"]',
    'textarea[aria-label*="URL"]',
    'input[aria-label*="URL"]',
    'textarea[aria-label*="クエリ"]',
    'input[aria-label*="クエリ"]',
    'textarea[placeholder*="リンクを貼り付ける"]',
    'input[placeholder*="リンクを貼り付ける"]',
    'textarea[placeholder*="URL"]',
    'input[placeholder*="URL"]',
    'textarea[placeholder*="検索"]',
    'input[placeholder*="検索"]',
    "textarea.mat-mdc-input-element",
    "input.mat-mdc-input-element",
  ],
};

type AddUrlMessage = {
  type: "ADD_URL";
  url: string;
};

type PingMessage = {
  type: "PING";
};

type AddUrlResponse = {
  ok: boolean;
  detail?: unknown;
  error?: string;
};

export default defineContentScript({
  matches: ["https://notebooklm.google.com/*"],
  runAt: "document_idle",
  main() {
    const globalFlag = window as { __NLM_PusherInitialized?: boolean };
    if (globalFlag.__NLM_PusherInitialized) {
      return;
    }
    globalFlag.__NLM_PusherInitialized = true;

    document.documentElement.dataset.nlmUrlPusher = "1";
    console.log("NotebookLM URL Pusher: content script loaded");
    browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message && message.type === "PING") {
        console.log("NotebookLM URL Pusher: ping received");
        sendResponse({ ok: true });
        return true;
      }
      if (!message || message.type !== "ADD_URL") {
        return undefined;
      }

      return handleAddUrl((message as AddUrlMessage).url);
    });
  },
});

const waitFor = <T>(fn: () => T | null, { timeoutMs = 15000, intervalMs = 100 } = {}) =>
  new Promise<T>((resolve, reject) => {
    const start = Date.now();

    const check = () => {
      try {
        const result = fn();
        if (result) {
          resolve(result);
          return;
        }
      } catch (error) {
        reject(error);
        return;
      }

      if (Date.now() - start > timeoutMs) {
        reject(new Error("待機がタイムアウトしました。"));
        return;
      }

      setTimeout(check, intervalMs);
    };

    check();
  });

const queryFirst = <T extends Element>(root: ParentNode, selectors: string[]) => {
  for (const selector of selectors) {
    const found = root.querySelector<T>(selector);
    if (found) {
      return found;
    }
  }
  return null;
};

const waitForDialogClose = (timeoutMs = 15000) =>
  waitFor(() => (!queryFirst(document, SELECTORS.dialog) ? true : null), { timeoutMs });

const normalizeLabel = (value: string) => value.trim().toLowerCase();

const getActiveDialogRoot = () =>
  (Array.from(document.querySelectorAll("mat-dialog-container.mdc-dialog--open")).pop() ??
    queryFirst<HTMLElement>(document, SELECTORS.dialog)) as HTMLElement | null;

const findAddSourceButton = (root: ParentNode) => {
  const bySelector = queryFirst<HTMLButtonElement>(root, SELECTORS.addSourceButton);
  if (bySelector) {
    return bySelector;
  }

  const buttons = root.querySelectorAll("button");
  for (const button of buttons) {
    const text = normalizeLabel(button.textContent ?? "");
    const aria = normalizeLabel(button.getAttribute("aria-label") ?? "");
    const title = normalizeLabel(button.getAttribute("title") ?? "");
    const combined = `${text} ${aria} ${title}`;

    const isJapanese =
      (combined.includes("ソース") && (combined.includes("追加") || combined.includes("新規")));
    const isEnglish =
      combined.includes("source") && (combined.includes("add") || combined.includes("new"));

    if (isJapanese || isEnglish) {
      return button as HTMLButtonElement;
    }
  }

  return null;
};

const findElementByLabel = (root: ParentNode, labelText: string | string[]) => {
  const labels = Array.isArray(labelText) ? labelText : [labelText];
  const normalizedLabels = labels.map(normalizeLabel);
  const elements = root.querySelectorAll("button, [role='button'], [role='tab']");
  for (const el of elements) {
    const label = el.querySelector?.(".mdc-button__label");
    const labelTextContent = (label?.textContent ?? el.textContent ?? "") as string;
    const ariaLabel = (el.getAttribute?.("aria-label") ?? "") as string;
    const title = (el.getAttribute?.("title") ?? "") as string;
    const candidates = [labelTextContent, ariaLabel, title].map(normalizeLabel).filter(Boolean);
    if (candidates.some((candidate) => normalizedLabels.includes(candidate))) {
      return el as HTMLElement;
    }
    if (candidates.some((candidate) => normalizedLabels.some((target) => candidate.includes(target)))) {
      return el as HTMLElement;
    }
  }
  return null;
};

const waitForInsertEnabled = (root: ParentNode, timeoutMs = 15000) =>
  waitFor(() => {
    const button = findElementByLabel(root, [
      "挿入",
      "追加",
      "追加する",
      "送信",
      "インポート",
      "Insert",
      "Add",
      "Send",
      "Import",
    ]);
    if (!button) {
      return null;
    }
    const disabled =
      button.hasAttribute("disabled") || button.classList.contains("mat-mdc-button-disabled");
    return disabled ? null : button;
  }, { timeoutMs });

const setInputValue = (input: HTMLTextAreaElement | HTMLInputElement, value: string) => {
  const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), "value")?.set;
  if (setter) {
    setter.call(input, value);
  } else {
    input.value = value;
  }
  input.focus();
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
  input.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true }));
  input.dispatchEvent(new Event("blur", { bubbles: true }));
};

const waitForInputValue = (input: HTMLTextAreaElement | HTMLInputElement, value: string) =>
  waitFor(() => (input.value === value ? input : null), { timeoutMs: 20000, intervalMs: 200 });

const findWebsiteButton = (root: ParentNode) => {
  const buttons = root.querySelectorAll("button, [role='button'], [role='tab']");
  for (const el of buttons) {
    const label = el.querySelector?.(".mdc-button__label");
    const labelTextContent = (label?.textContent ?? el.textContent ?? "").trim();
    if (!labelTextContent) {
      continue;
    }
    if (labelTextContent.includes("ウェブサイト") || labelTextContent.toLowerCase().includes("website")) {
      return el as HTMLElement;
    }
  }
  return null;
};

const getWebsiteUrlInput = async (root: ParentNode) => {
  const websiteButton = await waitFor(
    () => {
      const activeRoot = getActiveDialogRoot() ?? root;
      return findWebsiteButton(activeRoot) ?? findWebsiteButton(document);
    },
    { timeoutMs: 15000 },
  ).catch(() => null);
  if (!websiteButton) {
    throw new Error("ウェブサイトボタンが見つかりません。");
  }
  console.log("NotebookLM URL Pusher: website button text", websiteButton.textContent?.trim());
  websiteButton.click();
  console.log("NotebookLM URL Pusher: website tab clicked");
  return await waitFor(
    () =>
      queryFirst<HTMLTextAreaElement | HTMLInputElement>(getActiveDialogRoot() ?? document, [
        'textarea[formcontrolname="urls"]',
        'input[formcontrolname="urls"]',
        'textarea[aria-label*="URL"]',
        'input[aria-label*="URL"]',
        'textarea[placeholder*="リンクを貼り付ける"]',
        'input[placeholder*="リンクを貼り付ける"]',
        "textarea.mat-mdc-input-element",
        "input.mat-mdc-input-element",
      ]),
    { timeoutMs: 20000 },
  );
};

const closeAnyOpenDialog = async () => {
  const existingDialog = queryFirst<HTMLElement>(document, SELECTORS.dialog);
  if (!existingDialog) {
    return;
  }
  const closeButton = queryFirst<HTMLButtonElement>(existingDialog, SELECTORS.dialogCloseButton);
  if (!closeButton) {
    return;
  }
  console.log("NotebookLM URL Pusher: closing existing dialog");
  closeButton.click();
  await waitForDialogClose(8000).catch(() => null);
};

const addUrlToNotebook = async (url: string) => {
  await closeAnyOpenDialog();

  console.log("NotebookLM URL Pusher: locating add source button");
  const addSourceButton = await waitFor(
    () => findAddSourceButton(document),
    { timeoutMs: 15000 },
  );
  addSourceButton.click();
  console.log("NotebookLM URL Pusher: add source clicked");

  console.log("NotebookLM URL Pusher: waiting for dialog");
  const dialog = await waitFor(
    () => queryFirst<HTMLElement>(document, SELECTORS.dialog),
    { timeoutMs: 8000 },
  ).catch(() => null);

  const root: ParentNode = dialog ?? document;

  console.log("NotebookLM URL Pusher: switching to website input");
  const urlInput = await getWebsiteUrlInput(document);

  console.log("NotebookLM URL Pusher: setting url input");
  setInputValue(urlInput, url);
  await waitForInputValue(urlInput, url);

  console.log("NotebookLM URL Pusher: waiting for insert/add button");
  let insertButton: HTMLElement | null = null;
  try {
    insertButton = await waitForInsertEnabled(getActiveDialogRoot() ?? root, 30000);
  } catch {
    insertButton = null;
  }
  if (!insertButton) {
    console.log("NotebookLM URL Pusher: insert button not ready, retrying website flow");
    const retryInput = await getWebsiteUrlInput(document);
    console.log("NotebookLM URL Pusher: setting url input (retry)");
    setInputValue(retryInput, url);
    insertButton = await waitForInsertEnabled(getActiveDialogRoot() ?? root, 20000);
  }
  insertButton.click();

  console.log("NotebookLM URL Pusher: insert clicked, waiting for close");
  try {
    await waitForDialogClose(30000);
  } catch {
    console.log("NotebookLM URL Pusher: dialog close timeout, continuing");
  }

  return { ok: true };
};

const handleAddUrl = async (url: string): Promise<AddUrlResponse> => {
  try {
    console.log("NotebookLM URL Pusher: start", url);
    const result = await addUrlToNotebook(url);
    console.log("NotebookLM URL Pusher: done");
    return { ok: true, detail: result };
  } catch (error) {
    console.log("NotebookLM URL Pusher: failed", error);
    return { ok: false, error: error instanceof Error ? error.message : "不明なエラー" };
  }
};
