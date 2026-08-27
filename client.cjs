var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name2 in all)
    __defProp(target, name2, { get: all[name2], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// client.js
var client_exports = {};
__export(client_exports, {
  apply: () => apply,
  inject: () => inject,
  name: () => name
});
module.exports = __toCommonJS(client_exports);
var import_react = require("react");
var name = "dsh-git-workspace-client";
var inject = ["slots", "workspaces"];
var api = "/plugins/dsh-git";
async function call(path, body = {}) {
  const response = await fetch(`${api}${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const result = await response.json();
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}
function Action({ children, onClick, disabled = false }) {
  return (0, import_react.createElement)("button", { type: "button", disabled, onClick, style: { border: "1px solid #475569", borderRadius: 6, padding: "6px 9px", color: "#f8fafc", background: "#1e293b", cursor: disabled ? "not-allowed" : "pointer" } }, children);
}
function GitPanel({ workspace, onClose }) {
  const [tab, setTab] = (0, import_react.useState)("status");
  const [state, setState] = (0, import_react.useState)(null);
  const [history, setHistory] = (0, import_react.useState)([]);
  const [branchList, setBranchList] = (0, import_react.useState)([]);
  const [diff, setDiff] = (0, import_react.useState)("");
  const [message, setMessage] = (0, import_react.useState)("");
  const [error, setError] = (0, import_react.useState)("");
  const refresh = async () => {
    try {
      setError("");
      const value = await call("/status", { workspace: workspace.path });
      setState(value);
      if (tab === "history") setHistory(await call("/history", { workspace: workspace.path }));
      if (tab === "branches") setBranchList(await call("/branches", { workspace: workspace.path }));
    } catch (reason) {
      setError(reason.message);
    }
  };
  (0, import_react.useEffect)(() => {
    void refresh();
  }, [workspace.path, tab]);
  const mutation = async (endpoint, body = {}) => {
    if (!window.confirm(`Confirm Git ${endpoint.slice(1)} for ${workspace.title}.`)) return;
    try {
      await call(endpoint, { workspace: workspace.path, ...body });
      await refresh();
    } catch (reason) {
      setError(reason.message);
    }
  };
  const style = { position: "fixed", top: 0, right: 0, width: "min(420px, 100vw)", height: "100vh", overflow: "auto", padding: 16, boxSizing: "border-box", color: "#e2e8f0", background: "#0f172a", borderLeft: "1px solid #334155", pointerEvents: "auto", zIndex: 30, fontFamily: "system-ui, sans-serif" };
  const tabs = ["status", "changes", "commit", "branches", "history", "sync"];
  return (0, import_react.createElement)(
    "aside",
    { style, "aria-label": "Git sidebar" },
    (0, import_react.createElement)("header", { style: { display: "flex", justifyContent: "space-between", gap: 8 } }, (0, import_react.createElement)("strong", null, `Git \xB7 ${workspace.title}`), (0, import_react.createElement)(Action, { onClick: onClose }, "Close")),
    (0, import_react.createElement)("nav", { style: { display: "flex", flexWrap: "wrap", gap: 4, margin: "12px 0" } }, ...tabs.map((item) => (0, import_react.createElement)(Action, { key: item, onClick: () => setTab(item), disabled: tab === item }, item[0].toUpperCase() + item.slice(1)))),
    error && (0, import_react.createElement)("p", { role: "alert", style: { color: "#fca5a5" } }, error),
    tab === "status" && (0, import_react.createElement)(
      "section",
      null,
      (0, import_react.createElement)("p", null, state ? `Branch: ${state.branch ?? "detached"} \xB7 ${state.clean ? "Clean" : `${state.files.length} changed files`}` : "Loading\u2026"),
      state && (0, import_react.createElement)("p", null, `Upstream: ${state.upstream ?? "none"} \xB7 \u2191${state.ahead} \u2193${state.behind}`),
      (0, import_react.createElement)(Action, { onClick: refresh }, "Refresh")
    ),
    tab === "changes" && (0, import_react.createElement)(
      "section",
      null,
      (0, import_react.createElement)("h3", null, "Changes"),
      ...(state?.files ?? []).map((file) => (0, import_react.createElement)(
        "div",
        { key: `${file.staged}:${file.unstaged}:${file.path}`, style: { padding: "8px 0", borderBottom: "1px solid #334155" } },
        (0, import_react.createElement)("div", null, `${file.staged ?? " "} ${file.unstaged ?? " "} ${file.path}`),
        (0, import_react.createElement)(
          "div",
          { style: { display: "flex", gap: 4, marginTop: 4 } },
          (0, import_react.createElement)(Action, { onClick: async () => {
            try {
              setDiff((await call("/diff", { workspace: workspace.path, file: file.path, staged: false })).diff);
            } catch (e) {
              setError(e.message);
            }
          } }, "View diff"),
          (0, import_react.createElement)(Action, { onClick: () => mutation("/stage", { files: [file.path], staged: true }) }, "Stage"),
          (0, import_react.createElement)(Action, { onClick: () => mutation("/stage", { files: [file.path], staged: false }) }, "Unstage")
        )
      )),
      diff && (0, import_react.createElement)("pre", { style: { whiteSpace: "pre-wrap", fontSize: 12, color: "#cbd5e1" } }, diff)
    ),
    tab === "commit" && (0, import_react.createElement)(
      "section",
      null,
      (0, import_react.createElement)("h3", null, "Commit staged changes"),
      (0, import_react.createElement)("textarea", { value: message, onChange: (e) => setMessage(e.target.value), placeholder: "Commit message", style: { width: "100%", minHeight: 90, boxSizing: "border-box" } }),
      (0, import_react.createElement)("p", null, (0, import_react.createElement)(Action, { disabled: !message.trim(), onClick: () => mutation("/commit", { message }) }, "Commit"))
    ),
    tab === "branches" && (0, import_react.createElement)("section", null, (0, import_react.createElement)("h3", null, "Branches"), ...branchList.map((branch) => (0, import_react.createElement)("p", { key: branch.name }, (0, import_react.createElement)(Action, { disabled: branch.current, onClick: () => mutation("/checkout", { branch: branch.name }) }, branch.current ? `\u25CF ${branch.name}` : branch.name)))),
    tab === "history" && (0, import_react.createElement)("section", null, (0, import_react.createElement)("h3", null, "History"), ...history.map((item) => (0, import_react.createElement)("p", { key: item.id }, (0, import_react.createElement)("code", null, item.shortId), ` ${item.subject}`))),
    tab === "sync" && (0, import_react.createElement)("section", null, (0, import_react.createElement)("h3", null, "Sync"), (0, import_react.createElement)("p", null, "Pull uses fast-forward only. Diverged branches require manual resolution."), (0, import_react.createElement)("div", { style: { display: "flex", gap: 6 } }, (0, import_react.createElement)(Action, { onClick: () => mutation("/fetch") }, "Fetch"), (0, import_react.createElement)(Action, { onClick: () => mutation("/pull") }, "Pull (FF only)"), (0, import_react.createElement)(Action, { onClick: () => mutation("/push") }, "Push")))
  );
}
function CloneDialog({ onClose, onCloned }) {
  const [url, setUrl] = (0, import_react.useState)("");
  const [name2, setName] = (0, import_react.useState)("");
  const [branch, setBranch] = (0, import_react.useState)("");
  const [error, setError] = (0, import_react.useState)("");
  const submit = async () => {
    if (!window.confirm(`Clone ${url} into new workspace ${name2}?`)) return;
    try {
      const value = await call("/clone", { url, name: name2, branch: branch || void 0 });
      onCloned(value);
      onClose();
    } catch (reason) {
      setError(reason.message);
    }
  };
  return (0, import_react.createElement)(
    "div",
    { style: { position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", zIndex: 31, pointerEvents: "auto", display: "grid", placeItems: "center" } },
    (0, import_react.createElement)(
      "div",
      { role: "dialog", "aria-label": "Clone Git repository", style: { width: "min(460px, 90vw)", background: "#0f172a", color: "#e2e8f0", padding: 20, borderRadius: 8 } },
      (0, import_react.createElement)("h2", null, "Clone Git repository"),
      error && (0, import_react.createElement)("p", { role: "alert", style: { color: "#fca5a5" } }, error),
      (0, import_react.createElement)("label", null, "SSH repository URL", (0, import_react.createElement)("input", { value: url, onChange: (e) => setUrl(e.target.value), placeholder: "git@github.com:owner/repository.git", style: { display: "block", width: "100%" } })),
      (0, import_react.createElement)("label", null, "Workspace name", (0, import_react.createElement)("input", { value: name2, onChange: (e) => setName(e.target.value), style: { display: "block", width: "100%" } })),
      (0, import_react.createElement)("label", null, "Branch (optional)", (0, import_react.createElement)("input", { value: branch, onChange: (e) => setBranch(e.target.value), style: { display: "block", width: "100%" } })),
      (0, import_react.createElement)("p", { style: { display: "flex", gap: 6 } }, (0, import_react.createElement)(Action, { onClick: onClose }, "Cancel"), (0, import_react.createElement)(Action, { disabled: !url || !name2, onClick: submit }, "Clone"))
    )
  );
}
function GitSettings() {
  const [settings, setSettings] = (0, import_react.useState)({ userName: "", userEmail: "", sshMode: "managed", sshPath: "" });
  const [publicKey, setPublicKey] = (0, import_react.useState)("");
  const [error, setError] = (0, import_react.useState)("");
  (0, import_react.useEffect)(() => {
    fetch(`${api}/settings`).then((r) => r.json()).then((r) => r.ok && setSettings(r.value)).catch(() => {
    });
  }, []);
  const save = async () => {
    try {
      await call("/settings", settings);
    } catch (e) {
      setError(e.message);
    }
  };
  const generate = async () => {
    try {
      const value = await call("/ssh/generate");
      setPublicKey(value.publicKey);
    } catch (e) {
      setError(e.message);
    }
  };
  const importKey = async () => {
    try {
      await call("/ssh/import", { path: settings.sshPath });
      setSettings({ ...settings, sshMode: "managed" });
    } catch (e) {
      setError(e.message);
    }
  };
  return (0, import_react.createElement)(
    "section",
    null,
    (0, import_react.createElement)("h2", null, "Git settings"),
    error && (0, import_react.createElement)("p", { role: "alert" }, error),
    (0, import_react.createElement)("label", null, "Git user.name", (0, import_react.createElement)("input", { value: settings.userName, onChange: (e) => setSettings({ ...settings, userName: e.target.value }) })),
    (0, import_react.createElement)("label", null, "Git user.email", (0, import_react.createElement)("input", { value: settings.userEmail, onChange: (e) => setSettings({ ...settings, userEmail: e.target.value }) })),
    (0, import_react.createElement)("h3", null, "SSH key"),
    (0, import_react.createElement)("label", null, (0, import_react.createElement)("input", { type: "radio", checked: settings.sshMode === "managed", onChange: () => setSettings({ ...settings, sshMode: "managed" }) }), " Use DSH-managed key"),
    (0, import_react.createElement)("label", null, (0, import_react.createElement)("input", { type: "radio", checked: settings.sshMode === "reference", onChange: () => setSettings({ ...settings, sshMode: "reference" }) }), " Use existing ~/.ssh key"),
    (0, import_react.createElement)("input", { value: settings.sshPath ?? "", onChange: (e) => setSettings({ ...settings, sshPath: e.target.value }), placeholder: "/home/user/.ssh/id_ed25519" }),
    (0, import_react.createElement)("p", null, (0, import_react.createElement)(Action, { onClick: generate }, "Generate managed key"), " ", (0, import_react.createElement)(Action, { onClick: importKey }, "Import existing key"), " ", (0, import_react.createElement)(Action, { onClick: save }, "Save settings")),
    publicKey && (0, import_react.createElement)("pre", { style: { whiteSpace: "pre-wrap" } }, publicKey)
  );
}
function apply(ctx) {
  let openPanel = null;
  const currentWorkspace = () => {
    const snapshot = ctx.workspaces.list?.getSnapshot?.() ?? ctx.workspaces.getSnapshot?.();
    const items = snapshot?.items ?? [];
    const recent = snapshot?.recentWorkspaceId;
    return items.find((item) => item.workspaceId === recent) ?? items[0] ?? null;
  };
  ctx.slots.inject("shell.overlay", () => ctx.slots.register({ name: "shell.overlay", id: "dsh-git-panel", order: 100 }, () => {
    const [workspace, setWorkspace] = (0, import_react.useState)(openPanel);
    const [cloneOpen, setCloneOpen] = (0, import_react.useState)(false);
    (0, import_react.useEffect)(() => {
      const timer = window.setInterval(() => {
        if (workspace !== openPanel) setWorkspace(openPanel);
      }, 200);
      return () => window.clearInterval(timer);
    }, [workspace]);
    return (0, import_react.createElement)(
      "div",
      { style: { pointerEvents: "none" } },
      (0, import_react.createElement)(
        "div",
        { style: { position: "fixed", right: 20, bottom: 20, display: "flex", gap: 8, pointerEvents: "auto", zIndex: 29 } },
        (0, import_react.createElement)(Action, { onClick: () => setCloneOpen(true) }, "Clone repository"),
        (0, import_react.createElement)(Action, { onClick: () => {
          openPanel = currentWorkspace();
          setWorkspace(openPanel);
        }, disabled: currentWorkspace() === null }, "Git")
      ),
      workspace ? (0, import_react.createElement)(GitPanel, { workspace, onClose: () => {
        openPanel = null;
        setWorkspace(null);
      } }) : null,
      cloneOpen ? (0, import_react.createElement)(CloneDialog, { onClose: () => setCloneOpen(false), onCloned: () => {
      } }) : null
    );
  }));
  ctx.slots.inject("settings.section", () => ctx.slots.register({ name: "settings.section", id: "git", order: 70, label: "Git" }, GitSettings));
}
