import { NOTEBOOK_ORIGIN, normalizeNotebookUrl } from "@/lib/notebook";

type PushUrlMessage = {
  type: "PUSH_URL";
  pageUrl: string;
  notebookUrl: string;
};

type PushUrlResponse = {
  ok: boolean;
  detail?: unknown;
  error?: string;
};

export default defineBackground(() => {
  browser.runtime.onMessage.addListener((message) => {
    if (!message || message.type !== "PUSH_URL") {
      return undefined;
    }
    return handlePushUrl(message as PushUrlMessage);
  });
});

const waitForTabComplete = (tabId: number, timeoutMs = 30000) =>
  new Promise<void>((resolve, reject) => {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const cleanup = () => {
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
      browser.tabs.onUpdated.removeListener(listener);
    };

    const listener = (updatedTabId: number, info: { status?: string }) => {
      if (updatedTabId === tabId && info.status === "complete") {
        cleanup();
        resolve();
      }
    };

    timeoutId = setTimeout(() => {
      cleanup();
      reject(new Error("NotebookLMの読み込みがタイムアウトしました。"));
    }, timeoutMs);

    browser.tabs.onUpdated.addListener(listener);

    browser.tabs
      .get(tabId)
      .then((tab) => {
        if (tab?.status === "complete") {
          cleanup();
          resolve();
        }
      })
      .catch(() => undefined);
  });

const waitForContentScript = async (tabId: number, timeoutMs = 20000) => {
  const start = Date.now();
  let lastError: unknown = null;
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await browser.tabs.sendMessage(tabId, { type: "PING" });
      if (response && response.ok) {
        console.log("PUSH_URL: ping ok", tabId);
        return;
      }
    } catch (error) {
      lastError = error;
      // Ignore until content script is ready.
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(
    `NotebookLMの初期化が完了しませんでした。${lastError instanceof Error ? ` (${lastError.message})` : ""}`,
  );
};

const ensureContentScript = async (tabId: number) => {
  try {
    await waitForContentScript(tabId, 5000);
    return;
  } catch {
    // Fall through to manual injection.
  }

  console.log("PUSH_URL: inject content script", tabId);
  await browser.scripting.executeScript({
    target: { tabId },
    files: ["content-scripts/notebooklm.js"],
  });

  await waitForContentScript(tabId, 20000);
};

const findNotebookTab = async (normalizedUrl: string) => {
  const tabs = await browser.tabs.query({ url: `${NOTEBOOK_ORIGIN}/*` });
  for (const tab of tabs) {
    if (!tab.url) {
      continue;
    }
    try {
      const normalizedTabUrl = normalizeNotebookUrl(tab.url);
      if (normalizedTabUrl === normalizedUrl) {
        return tab;
      }
    } catch {
      continue;
    }
  }
  return null;
};

const handlePushUrl = async (message: PushUrlMessage): Promise<PushUrlResponse> => {
  try {
    const normalizedNotebookUrl = normalizeNotebookUrl(message.notebookUrl);
    const [activeTab] = await browser.tabs.query({ active: true, currentWindow: true });
    const existingTab = await findNotebookTab(normalizedNotebookUrl);
    let tab = existingTab;
    let shouldClose = false;
    let shouldRestoreActive = false;

    if (!tab) {
      tab = await browser.tabs.create({ url: normalizedNotebookUrl, active: true });
      shouldClose = true;
      shouldRestoreActive = true;
    } else if (!tab.active) {
      await browser.tabs.update(tab.id, { active: true });
      shouldRestoreActive = true;
    }

    if (!tab?.id) {
      throw new Error("NotebookLMタブを取得できませんでした。");
    }

    let succeeded = false;
    try {
      const tabInfo = await browser.tabs.get(tab.id);
      console.log("PUSH_URL: target tab", tab.id, tabInfo.url);
      console.log("PUSH_URL: wait for tab complete", tab.id);
      await waitForTabComplete(tab.id, 60000);
      console.log("PUSH_URL: ensure content script", tab.id);
      await ensureContentScript(tab.id);
      console.log("PUSH_URL: sending ADD_URL", tab.id);

      const response = await browser.tabs.sendMessage(tab.id, {
        type: "ADD_URL",
        url: message.pageUrl,
      });

      if (!response || !response.ok) {
        throw new Error(response && response.error ? response.error : "NotebookLM操作に失敗しました。");
      }

      succeeded = true;
      return { ok: true, detail: response };
    } finally {
      if (shouldRestoreActive && activeTab?.id && activeTab.id !== tab.id) {
        await browser.tabs.update(activeTab.id, { active: true });
      }
      if (shouldClose && succeeded) {
        await browser.tabs.remove(tab.id);
      }
    }
  } catch (error) {
    console.log("PUSH_URL failed", error);
    return { ok: false, error: error instanceof Error ? error.message : "不明なエラー" };
  }
};
