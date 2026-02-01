import "../../styles.css";
import { normalizeNotebookUrl } from "@/lib/notebook";
import type { Notebook } from "@/lib/types";

const addForm = document.getElementById("addForm") as HTMLFormElement | null;
const nameInput = document.getElementById("nameInput") as HTMLInputElement | null;
const urlInput = document.getElementById("urlInput") as HTMLInputElement | null;
const addStatus = document.getElementById("addStatus");
const notebookList = document.getElementById("notebookList");
const itemTemplate = document.getElementById("notebookItemTemplate") as HTMLTemplateElement | null;

if (!addForm || !nameInput || !urlInput || !addStatus || !notebookList || !itemTemplate) {
  throw new Error("Options elements not found.");
}

const setStatus = (el: HTMLElement, message: string, isError = false) => {
  el.textContent = message;
  el.style.color = isError ? "#dc2626" : "#6b7280";
};

const generateId = () => {
  if (crypto && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `notebook-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const loadNotebooks = async () => {
  const data = (await browser.storage.sync.get({ notebooks: [] })) as { notebooks: Notebook[] };
  return data.notebooks;
};

const saveNotebooks = async (notebooks: Notebook[]) => {
  await browser.storage.sync.set({ notebooks });
};

const renderList = (notebooks: Notebook[]) => {
  notebookList.innerHTML = "";
  if (notebooks.length === 0) {
    notebookList.textContent = "登録済みノートブックはありません。";
    return;
  }

  for (const notebook of notebooks) {
    const fragment = itemTemplate.content.cloneNode(true) as DocumentFragment;
    const item = fragment.querySelector(".list-item") as HTMLElement | null;
    const nameField = fragment.querySelector(".name-field") as HTMLInputElement | null;
    const urlField = fragment.querySelector(".url-field") as HTMLInputElement | null;
    const saveButton = fragment.querySelector(".save-button") as HTMLButtonElement | null;
    const deleteButton = fragment.querySelector(".delete-button") as HTMLButtonElement | null;
    const statusEl = fragment.querySelector(".item-status") as HTMLElement | null;

    if (!item || !nameField || !urlField || !saveButton || !deleteButton || !statusEl) {
      continue;
    }

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
            url: normalizedUrl,
          };
        });

        await saveNotebooks(updated);
        setStatus(statusEl, "保存しました。");
      } catch (error) {
        setStatus(statusEl, error instanceof Error ? error.message : "保存に失敗しました。", true);
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

      const newNotebook: Notebook = {
        id: generateId(),
        name,
        url: normalizedUrl,
        createdAt: Date.now(),
      };

      const updated = [...current, newNotebook];
      await saveNotebooks(updated);
      renderList(updated);

      nameInput.value = "";
      urlInput.value = "";
      setStatus(addStatus, "追加しました。");
    } catch (error) {
      setStatus(addStatus, error instanceof Error ? error.message : "追加に失敗しました。", true);
    }
  });
};

init();
