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
  browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || message.type !== "PUSH_URL") {
      return false;
    }

    (async () => {
      const response = await handlePushUrl(message as PushUrlMessage);
      sendResponse(response);
    })();

    return true;
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

const sendAddUrlMessage = async (tabId: number, pageUrl: string, retries = 3) => {
  let lastError: unknown = null;
  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      return await browser.tabs.sendMessage(tabId, {
        type: "ADD_URL",
        url: pageUrl,
      });
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("NotebookLMのコンテンツスクリプトに接続できませんでした。");
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
    const existingTab = await findNotebookTab(normalizedNotebookUrl);
    let tab = existingTab;
    let shouldClose = false;

    if (!tab) {
      tab = await browser.tabs.create({ url: normalizedNotebookUrl, active: false });
      shouldClose = true;
    }

    if (!tab?.id) {
      throw new Error("NotebookLMタブを取得できませんでした。");
    }

    try {
      await waitForTabComplete(tab.id, 30000);
      const response = await sendAddUrlMessage(tab.id, message.pageUrl);

      if (!response || !response.ok) {
        throw new Error(response && response.error ? response.error : "NotebookLM操作に失敗しました。");
      }

      return { ok: true, detail: response };
    } finally {
      if (shouldClose) {
        await browser.tabs.remove(tab.id);
      }
    }
  } catch (error) {
    console.log("PUSH_URL failed", error);
    return { ok: false, error: error instanceof Error ? error.message : "不明なエラー" };
  }
};
