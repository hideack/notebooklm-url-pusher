const NOTEBOOK_ORIGIN = "https://notebooklm.google.com";

const addForm = document.getElementById("addForm");
const nameInput = document.getElementById("nameInput");
const urlInput = document.getElementById("urlInput");
const addStatus = document.getElementById("addStatus");
const notebookList = document.getElementById("notebookList");
const itemTemplate = document.getElementById("notebookItemTemplate");

const setStatus = (el, message, isError = false) => {
  el.textContent = message;
  el.style.color = isError ? "#dc2626" : "#6b7280";
};

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

const generateId = () => {
  if (crypto && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `notebook-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const loadNotebooks = async () => {
  const data = await chrome.storage.sync.get({ notebooks: [] });
  return data.notebooks;
};

const saveNotebooks = async (notebooks) => {
  await chrome.storage.sync.set({ notebooks });
};

const renderList = (notebooks) => {
  notebookList.innerHTML = "";
  if (notebooks.length === 0) {
    notebookList.textContent = "登録済みノートブックはありません。";
    return;
  }

  for (const notebook of notebooks) {
    const fragment = itemTemplate.content.cloneNode(true);
    const item = fragment.querySelector(".list-item");
    const nameField = fragment.querySelector(".name-field");
    const urlField = fragment.querySelector(".url-field");
    const saveButton = fragment.querySelector(".save-button");
    const deleteButton = fragment.querySelector(".delete-button");
    const statusEl = fragment.querySelector(".item-status");

    nameField.value = notebook.name || "";
    urlField.value = notebook.url;

    saveButton.addEventListener("click", async () => {
      try {
        const normalizedUrl = normalizeNotebookUrl(urlField.value.trim());
        const updatedName = nameField.value.trim();

        const latest = await loadNotebooks();
        const duplicate = latest.find((n) => n.url === normalizedUrl && n.id !== notebook.id);
        if (duplicate) {
          throw new Error("同じURLのノートブックが既に登録されています。");
        }

        const updated = latest.map((n) => {
          if (n.id !== notebook.id) {
            return n;
          }
          return {
            ...n,
            name: updatedName,
            url: normalizedUrl
          };
        });

        await saveNotebooks(updated);
        setStatus(statusEl, "保存しました。");
      } catch (error) {
        setStatus(statusEl, error.message || "保存に失敗しました。", true);
      }
    });

    deleteButton.addEventListener("click", async () => {
      const latest = await loadNotebooks();
      const updated = latest.filter((n) => n.id !== notebook.id);
      await saveNotebooks(updated);
      renderList(updated);
    });

    notebookList.appendChild(item);
  }
};

const init = async () => {
  const notebooks = await loadNotebooks();
  renderList(notebooks);

  addForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    setStatus(addStatus, "");

    try {
      const normalizedUrl = normalizeNotebookUrl(urlInput.value.trim());
      const name = nameInput.value.trim();

      const current = await loadNotebooks();
      if (current.some((n) => n.url === normalizedUrl)) {
        throw new Error("同じURLのノートブックが既に登録されています。");
      }

      const newNotebook = {
        id: generateId(),
        name,
        url: normalizedUrl,
        createdAt: Date.now()
      };

      const updated = [...current, newNotebook];
      await saveNotebooks(updated);
      renderList(updated);

      nameInput.value = "";
      urlInput.value = "";
      setStatus(addStatus, "追加しました。");
    } catch (error) {
      setStatus(addStatus, error.message || "追加に失敗しました。", true);
    }
  });
};

init();
