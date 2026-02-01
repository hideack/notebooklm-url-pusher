const NOTEBOOK_ORIGIN = "https://notebooklm.google.com";

const normalizeNotebookUrl = (rawUrl) => {
  const parsed = new URL(rawUrl);
  if (parsed.origin !== NOTEBOOK_ORIGIN) {
    throw new Error("NotebookLMのURLではありません。");
  }
  if (!parsed.pathname.startsWith("/notebook/") || parsed.pathname.length <= "/notebook/".length) {
    throw new Error("ノートブックURLの形式が正しくありません。");
  }
  let pathname = parsed.pathname;
  if (pathname.endsWith("/")) {
    pathname = pathname.slice(0, -1);
  }
  return `${parsed.origin}${pathname}`;
};

const waitForTabComplete = (tabId, timeoutMs = 30000) =>
  new Promise((resolve, reject) => {
    let timeoutId;
    const listener = (updatedTabId, info) => {
      if (updatedTabId === tabId && info.status === "complete") {
        cleanup();
        resolve();
      }
    };

    const cleanup = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      chrome.tabs.onUpdated.removeListener(listener);
    };

    timeoutId = setTimeout(() => {
      cleanup();
      reject(new Error("NotebookLMの読み込みがタイムアウトしました。"));
    }, timeoutMs);

    chrome.tabs.onUpdated.addListener(listener);

    chrome.tabs.get(tabId, (tab) => {
      if (chrome.runtime.lastError) {
        return;
      }
      if (tab && tab.status === "complete") {
        cleanup();
        resolve();
      }
    });
  });

const findNotebookTab = async (normalizedUrl) => {
  const tabs = await chrome.tabs.query({ url: `${NOTEBOOK_ORIGIN}/*` });
  for (const tab of tabs) {
    if (!tab.url) {
      continue;
    }
    try {
      const normalizedTabUrl = normalizeNotebookUrl(tab.url);
      if (normalizedTabUrl === normalizedUrl) {
        return tab;
      }
    } catch (error) {
      continue;
    }
  }
  return null;
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.type !== "PUSH_URL") {
    return false;
  }

  (async () => {
    try {
      const normalizedNotebookUrl = normalizeNotebookUrl(message.notebookUrl);
      const existingTab = await findNotebookTab(normalizedNotebookUrl);
      let tab = existingTab;
      let shouldClose = false;

      if (!tab) {
        tab = await chrome.tabs.create({ url: normalizedNotebookUrl, active: false });
        shouldClose = true;
      }

      try {
        await waitForTabComplete(tab.id);

        const response = await chrome.tabs.sendMessage(tab.id, {
          type: "ADD_URL",
          url: message.pageUrl
        });

        if (!response || !response.ok) {
          throw new Error(response && response.error ? response.error : "NotebookLM操作に失敗しました。");
        }

        sendResponse({ ok: true, detail: response });
      } finally {
        if (shouldClose) {
          await chrome.tabs.remove(tab.id);
        }
      }
    } catch (error) {
      console.log("PUSH_URL failed", error);
      sendResponse({ ok: false, error: error.message || "不明なエラー" });
    }
  })();

  return true;
});
