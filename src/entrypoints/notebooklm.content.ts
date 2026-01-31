const SELECTORS = {
  addSourceButton: 'button.add-source-button[aria-label="ソースを追加"]',
  dialog: 'mat-dialog-container[role="dialog"]',
  urlInput: 'textarea[formcontrolname="urls"][aria-label="URL を入力"]',
};

type AddUrlMessage = {
  type: "ADD_URL";
  url: string;
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
    browser.runtime.onMessage.addListener((message) => {
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

const waitForDialogClose = (timeoutMs = 15000) =>
  waitFor(() => (!document.querySelector(SELECTORS.dialog) ? true : null), { timeoutMs });

const findButtonByLabel = (root: Element, labelText: string) => {
  const buttons = root.querySelectorAll("button");
  for (const button of buttons) {
    const label = button.querySelector(".mdc-button__label");
    if (!label) {
      continue;
    }
    if (label.textContent && label.textContent.trim() === labelText) {
      return button as HTMLButtonElement;
    }
  }
  return null;
};

const waitForInsertEnabled = (root: Element, timeoutMs = 15000) =>
  waitFor(() => {
    const button = findButtonByLabel(root, "挿入");
    if (!button) {
      return null;
    }
    const disabled =
      button.hasAttribute("disabled") || button.classList.contains("mat-mdc-button-disabled");
    return disabled ? null : button;
  }, { timeoutMs });

const setTextareaValue = (textarea: HTMLTextAreaElement, value: string) => {
  textarea.value = value;
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
  textarea.dispatchEvent(new Event("change", { bubbles: true }));
};

const addUrlToNotebook = async (url: string) => {
  const addSourceButton = await waitFor(
    () => document.querySelector<HTMLButtonElement>(SELECTORS.addSourceButton),
    { timeoutMs: 15000 },
  );
  addSourceButton.click();

  const dialog = await waitFor(
    () => document.querySelector<HTMLElement>(SELECTORS.dialog),
    { timeoutMs: 15000 },
  );

  let urlInput = dialog.querySelector<HTMLTextAreaElement>(SELECTORS.urlInput);
  if (!urlInput) {
    const websiteButton = await waitFor(() => findButtonByLabel(dialog, "ウェブサイト"), {
      timeoutMs: 15000,
    });
    websiteButton.click();
    urlInput = await waitFor(() => dialog.querySelector<HTMLTextAreaElement>(SELECTORS.urlInput), {
      timeoutMs: 15000,
    });
  }

  setTextareaValue(urlInput, url);

  const insertButton = await waitForInsertEnabled(dialog, 15000);
  insertButton.click();

  await waitForDialogClose(20000);

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
