const INVALID_PREFIXES = ["chrome://", "chrome-extension://", "about:", "edge://"];
const NOTEBOOK_ORIGIN = "https://notebooklm.google.com";

const notebookSelect = document.getElementById("notebookSelect");
const notebookHint = document.getElementById("notebookHint");
const currentUrlEl = document.getElementById("currentUrl");
const sendButton = document.getElementById("sendButton");
const statusEl = document.getElementById("status");

const setStatus = (message, isError = false) => {
  statusEl.textContent = message;
  statusEl.style.color = isError ? "#dc2626" : "#6b7280";
};

const isInvalidUrl = (url) => {
  if (!url) {
    return true;
  }
  for (const prefix of INVALID_PREFIXES) {
    if (url.startsWith(prefix)) {
      return true;
    }
  }
  try {
    const parsed = new URL(url);
    if (parsed.origin === NOTEBOOK_ORIGIN) {
      return true;
    }
  } catch (error) {
    return true;
  }
  return false;
};

const getActiveTab = async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
};

const loadState = async () => {
  const data = await chrome.storage.sync.get({ notebooks: [], lastSelectedByOrigin: {} });
  return data;
};

const saveLastSelected = async (origin, notebookId) => {
  const data = await chrome.storage.sync.get({ lastSelectedByOrigin: {} });
  const updated = { ...data.lastSelectedByOrigin, [origin]: notebookId };
  await chrome.storage.sync.set({ lastSelectedByOrigin: updated });
};

const populateNotebooks = (notebooks, lastSelectedId) => {
  notebookSelect.innerHTML = "";
  for (const notebook of notebooks) {
    const option = document.createElement("option");
    option.value = notebook.id;
    option.textContent = notebook.name || notebook.url;
    notebookSelect.appendChild(option);
  }

  if (notebooks.length === 0) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "ノートブックが未登録です";
    notebookSelect.appendChild(option);
    notebookSelect.disabled = true;
    return;
  }

  notebookSelect.disabled = false;
  if (lastSelectedId && notebooks.some((n) => n.id === lastSelectedId)) {
    notebookSelect.value = lastSelectedId;
  }
};

const init = async () => {
  const tab = await getActiveTab();
  const pageUrl = tab && tab.url ? tab.url : "";

  currentUrlEl.textContent = pageUrl || "取得できません";

  const invalid = isInvalidUrl(pageUrl);
  if (invalid) {
    sendButton.disabled = true;
    setStatus("このページは送信できません。", true);
  }

  const { notebooks, lastSelectedByOrigin } = await loadState();

  let origin = "";
  try {
    origin = new URL(pageUrl).origin;
  } catch (error) {
    origin = "";
  }

  const lastSelectedId = origin ? lastSelectedByOrigin[origin] : null;
  populateNotebooks(notebooks, lastSelectedId);

  if (notebooks.length === 0) {
    notebookHint.textContent = "設定からNotebookLMノートブックを登録してください。";
    sendButton.disabled = true;
  } else if (!invalid) {
    sendButton.disabled = false;
  }

  notebookSelect.addEventListener("change", async () => {
    if (!origin || !notebookSelect.value) {
      return;
    }
    await saveLastSelected(origin, notebookSelect.value);
  });

  sendButton.addEventListener("click", async () => {
    if (!pageUrl || !notebookSelect.value) {
      return;
    }
    sendButton.disabled = true;
    setStatus("NotebookLMへ送信中...");

    const notebook = notebooks.find((n) => n.id === notebookSelect.value);
    if (!notebook) {
      setStatus("ノートブックが見つかりません。", true);
      sendButton.disabled = false;
      return;
    }

    try {
      const response = await chrome.runtime.sendMessage({
        type: "PUSH_URL",
        pageUrl,
        notebookUrl: notebook.url
      });

      if (!response || !response.ok) {
        throw new Error(response && response.error ? response.error : "送信に失敗しました。");
      }

      await saveLastSelected(origin, notebook.id);
      setStatus("送信が完了しました。");
    } catch (error) {
      setStatus(error.message || "送信に失敗しました。", true);
    } finally {
      sendButton.disabled = false;
    }
  });
};

init();
