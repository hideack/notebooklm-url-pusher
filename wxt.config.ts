import { defineConfig } from "wxt";

export default defineConfig({
  srcDir: "src",
  manifest: {
    name: "NotebookLM URL Pusher",
    description: "Send the current page URL to a registered NotebookLM notebook.",
    version: "0.1.0",
    permissions: ["storage", "tabs", "scripting"],
    host_permissions: ["https://notebooklm.google.com/*"],
    action: {
      default_title: "NotebookLM URL Pusher",
      default_popup: "popup.html",
    },
    options_page: "options.html",
    icons: {
      "16": "icons/icon16.png",
      "32": "icons/icon32.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png",
    },
  },
});
