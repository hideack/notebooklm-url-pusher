const SELECTORS = {
  addSourceButton: 'button.add-source-button[aria-label="ソースを追加"]',
  dialog: 'mat-dialog-container[role="dialog"]',
  urlInput: 'textarea[formcontrolname="urls"][aria-label="URL を入力"]'
};

const waitFor = (fn, { timeoutMs = 15000, intervalMs = 100 } = {}) =>
  new Promise((resolve, reject) => {
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
  waitFor(() => !document.querySelector(SELECTORS.dialog), { timeoutMs });

const findButtonByLabel = (root, labelText) => {
  const buttons = root.querySelectorAll("button");
  for (const button of buttons) {
    const label = button.querySelector(".mdc-button__label");
    if (!label) {
      continue;
    }
    if (label.textContent && label.textContent.trim() === labelText) {
      return button;
    }
  }
  return null;
};

const waitForInsertEnabled = (root, timeoutMs = 15000) =>
  waitFor(() => {
    const button = findButtonByLabel(root, "挿入");
    if (!button) {
      return null;
    }
    const disabled =
      button.hasAttribute("disabled") ||
      button.classList.contains("mat-mdc-button-disabled");
    return disabled ? null : button;
  }, { timeoutMs });

const setTextareaValue = (textarea, value) => {
  textarea.value = value;
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
  textarea.dispatchEvent(new Event("change", { bubbles: true }));
};

const addUrlToNotebook = async (url) => {
  const addSourceButton = await waitFor(() => document.querySelector(SELECTORS.addSourceButton), { timeoutMs: 15000 });
  addSourceButton.click();

  const dialog = await waitFor(() => document.querySelector(SELECTORS.dialog), { timeoutMs: 15000 });

  let urlInput = dialog.querySelector(SELECTORS.urlInput);
  if (!urlInput) {
    const websiteButton = await waitFor(() => findButtonByLabel(dialog, "ウェブサイト"), { timeoutMs: 15000 });
    websiteButton.click();
    urlInput = await waitFor(() => dialog.querySelector(SELECTORS.urlInput), { timeoutMs: 15000 });
  }

  setTextareaValue(urlInput, url);

  const insertButton = await waitForInsertEnabled(dialog, 15000);
  insertButton.click();

  await waitForDialogClose(20000);

  return { ok: true };
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.type !== "ADD_URL") {
    return false;
  }

  (async () => {
    try {
      console.log("NotebookLM URL Pusher: start", message.url);
      const result = await addUrlToNotebook(message.url);
      console.log("NotebookLM URL Pusher: done");
      sendResponse({ ok: true, detail: result });
    } catch (error) {
      console.log("NotebookLM URL Pusher: failed", error);
      sendResponse({ ok: false, error: error.message || "不明なエラー" });
    }
  })();

  return true;
});
