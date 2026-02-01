const SELECTORS = {
  addSourceButton: 'button.add-source-button[aria-label="ソースを追加"]',
  dialog: 'mat-dialog-container[role="dialog"]',
  urlInput: 'textarea[formcontrolname="urls"][aria-label="URL を入力"]',
};

type AddUrlMessage = {
  type: "ADD_URL";
  url: string;
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
      if (!message || message.type !== "ADD_URL") {
        return false;
      }

      (async () => {
        try {
          console.log("NotebookLM URL Pusher: start", (message as AddUrlMessage).url);
          const result = await addUrlToNotebook((message as AddUrlMessage).url);
          console.log("NotebookLM URL Pusher: done");
          sendResponse({ ok: true, detail: result });
        } catch (error) {
          console.log("NotebookLM URL Pusher: failed", error);
          sendResponse({
            ok: false,
            error: error instanceof Error ? error.message : "不明なエラー",
          });
        }
      })();

      return true;
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

const findButtonByLabel = (root: ParentNode, labelText: string) => {
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

const waitForInsertEnabled = (root: ParentNode, timeoutMs = 15000) =>
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
    const websiteButton = await waitFor(
      () => findButtonByLabel(dialog, "ウェブサイト"),
      { timeoutMs: 15000 },
    );
    websiteButton.click();
    urlInput = await waitFor(
      () => dialog.querySelector<HTMLTextAreaElement>(SELECTORS.urlInput),
      { timeoutMs: 15000 },
    );
  }

  setTextareaValue(urlInput, url);

  const insertButton = await waitForInsertEnabled(dialog, 15000);
  insertButton.click();

  await waitForDialogClose(20000);

  return { ok: true };
};
