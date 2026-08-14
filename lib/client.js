window.__ModuleLoader__.load({
	id: "dsh-ProjectModel",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let React = require("react");

		const API = "/api/project-groups";

		async function apiGet() {
			const res = await fetch(API);
			const data = await res.json().catch(() => null);
			if (!data || data.ok === false) throw new Error((data && data.error) || "project-groups API 失败");
			return data;
		}
		async function apiPost(args) {
			const res = await fetch(API, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(args || {})
			});
			const data = await res.json().catch(() => null);
			if (!data || data.ok === false) throw new Error((data && data.error) || "project-groups API 失败");
			return data;
		}

		const inject = ["slots"];

		const CSS = `
.pg-page{display:flex;flex-direction:column;gap:16px;max-width:720px;padding:4px 2px 24px;}
.pg-head{display:flex;align-items:center;gap:10px;}
.pg-title{font-size:17px;font-weight:700;color:var(--dsw-alias-label-primary);margin:0;}
.pg-headline{font-size:12px;color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l1);border-radius:999px;padding:1px 9px;}
.pg-hint{font-size:13px;line-height:1.6;color:var(--dsw-alias-label-secondary);margin:0;}
.pg-create{display:flex;gap:8px;}
.pg-input{flex:1;min-width:0;background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-primary);border-radius:9px;padding:8px 12px;font-size:13px;outline:none;transition:border-color .15s ease,box-shadow .15s ease;}
.pg-input::placeholder{color:var(--dsw-alias-label-secondary);opacity:.7;}
.pg-input:focus{border-color:var(--dsw-alias-brand-primary);box-shadow:0 0 0 3px color-mix(in srgb,var(--dsw-alias-brand-primary) 18%,transparent);}
.pg-btn{border:1px solid var(--dsw-alias-border-l2);background:transparent;color:var(--dsw-alias-label-primary);border-radius:9px;padding:7px 13px;font-size:13px;cursor:pointer;white-space:nowrap;transition:background .15s ease,border-color .15s ease,color .15s ease,opacity .15s ease;}
.pg-btn:hover:not(:disabled){background:var(--dsw-alias-bg-layer-2);}
.pg-btn:disabled{opacity:.45;cursor:default;}
.pg-btn-primary{border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-brand-primary);}
.pg-btn-primary:hover:not(:disabled){background:var(--dsw-alias-brand-primary);color:var(--dsw-alias-bg-base);}
.pg-btn-sm{padding:3px 9px;font-size:12px;border-radius:7px;}
.pg-group{background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);border-radius:12px;padding:4px 14px 10px;box-shadow:0 1px 2px rgba(0,0,0,.04);}
.pg-group-head{display:flex;align-items:center;gap:8px;padding:10px 0 8px;border-bottom:1px solid var(--dsw-alias-border-l1);}
.pg-group-name{font-size:14px;font-weight:600;color:var(--dsw-alias-label-primary);}
.pg-group-active{color:var(--dsw-alias-brand-primary);}
.pg-count{font-size:11px;color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l1);border-radius:999px;padding:0 8px;line-height:18px;}
.pg-group-actions{margin-left:auto;display:flex;gap:6px;}
.pg-add-row{display:flex;gap:8px;padding:10px 0 6px;}
.pg-folder{display:flex;align-items:center;gap:9px;padding:8px 2px;border-bottom:1px solid var(--dsw-alias-border-l1);}
.pg-folder:last-child{border-bottom:none;}
.pg-dot{width:8px;height:8px;border-radius:50%;background:var(--dsw-alias-border-l2);flex-shrink:0;}
.pg-dot-active{background:var(--dsw-alias-brand-primary);box-shadow:0 0 0 3px color-mix(in srgb,var(--dsw-alias-brand-primary) 20%,transparent);}
.pg-folder-main{display:flex;flex-direction:column;min-width:0;flex:1;}
.pg-folder-title{font-size:13px;font-weight:500;color:var(--dsw-alias-label-primary);}
.pg-folder-path{font-size:11px;color:var(--dsw-alias-label-secondary);font-family:ui-monospace,Consolas,monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.pg-folder-actions{display:flex;gap:6px;opacity:.55;transition:opacity .15s ease;}
.pg-folder:hover .pg-folder-actions,.pg-folder:focus-within .pg-folder-actions{opacity:1;}
.pg-default-tag{font-size:10px;color:var(--dsw-alias-brand-primary);border:1px solid var(--dsw-alias-brand-primary);border-radius:999px;padding:0 6px;line-height:16px;flex-shrink:0;}
.pg-empty{font-size:12px;color:var(--dsw-alias-label-secondary);margin:0;}
.pg-msg{font-size:12px;color:var(--dsw-alias-state-error-primary);margin:0;}
.pg-dock{box-sizing:border-box;width:calc(100% - var(--dsh-composer-side-clearance) - var(--dsh-composer-side-clearance) - var(--dsh-composer-dock-inset) - var(--dsh-composer-dock-inset));max-width:calc(var(--dsh-composer-card-max-width) - var(--dsh-composer-dock-inset) - var(--dsh-composer-dock-inset));margin:0 auto;padding:4px var(--dsh-composer-dock-inset) 0;display:flex;align-items:center;font-size:12px;}
.pg-dock-chip{display:inline-flex;align-items:center;gap:8px;background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);border-radius:999px;padding:3px 12px;max-width:100%;}
.pg-dock-label{color:var(--dsw-alias-label-secondary);}
.pg-dock-name{font-weight:600;color:var(--dsw-alias-label-primary);}
.pg-dock-sep{color:var(--dsw-alias-label-secondary);opacity:.6;}
.pg-dock-count{color:var(--dsw-alias-label-secondary);}
.pg-dock-tags{display:inline-flex;align-items:center;gap:4px;flex-wrap:nowrap;overflow:hidden;}
.pg-dock-tag{font-size:11px;color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l1);border-radius:999px;padding:0 7px;line-height:17px;max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.pg-dock-empty{color:var(--dsw-alias-label-secondary);font-size:12px;font-style:italic;}
`;

		function apply(ctx) {
			const slots = ctx.get("slots");
			if (!slots) return;
			const timer = ctx.get("timer");

			// inject the stylesheet, removed with the plugin fiber
			ctx.effect(() => {
				const style = document.createElement("style");
				style.textContent = CSS;
				document.head.appendChild(style);
				return () => style.remove();
			}, "dsh-ProjectModel: styles");

			let state = { groups: [], activeGroupId: null, activeFolderId: null };
			const listeners = new Set();
			const notify = () => { listeners.forEach((fn) => fn()); };
			async function refresh() {
				try {
					state = await apiGet();
					notify();
				} catch (error) {
					console.error("project-groups: list failed", error);
				}
			}
			async function call(action, args) {
				const res = await apiPost(Object.assign({ action: action }, args || {}));
				state = res;
				notify();
				return res;
			}
			function useStore() {
				const [, force] = React.useState(0);
				React.useEffect(() => {
					refresh();
					const fn = () => force((x) => x + 1);
					listeners.add(fn);
					const disposer = timer ? timer.interval(() => refresh(), 3000) : undefined;
					return () => {
						listeners.delete(fn);
						if (disposer) disposer();
					};
				}, []);
				return state;
			}

			// ── settings page ────────────────────────────────────────────────
			function ProjectGroupsPage() {
				const store = useStore();
				const [newGroupName, setNewGroupName] = React.useState("");
				const [pathInputs, setPathInputs] = React.useState({});
				const [msg, setMsg] = React.useState("");
				const [busy, setBusy] = React.useState(false);
				const run = async (fn) => {
					setBusy(true);
					try { await fn(); setMsg(""); } catch (error) { setMsg(error && error.message ? error.message : String(error)); } finally { setBusy(false); }
				};
				const groups = store.groups || [];
				return React.createElement("div", { className: "pg-page" },
					React.createElement("div", { className: "pg-head" },
						React.createElement("h3", { className: "pg-title" }, "项目组"),
						React.createElement("span", { className: "pg-headline" }, "Project Groups"),
					),
					React.createElement("p", { className: "pg-hint" }, "一个项目组包含多个项目文件夹。在同一个会话中，agent 可以直接读写组内任意文件夹的文件并运行命令，无需手动切换。"),
					React.createElement("div", { className: "pg-create" },
						React.createElement("input", { className: "pg-input", placeholder: "新项目组名称", value: newGroupName, onChange: (e) => setNewGroupName(e.target.value), onKeyDown: (e) => { if (e.key === "Enter") run(async () => { await call("createGroup", { name: newGroupName }); setNewGroupName(""); }); } }),
						React.createElement("button", { className: "pg-btn pg-btn-primary", disabled: busy || !newGroupName.trim(), onClick: () => run(async () => { await call("createGroup", { name: newGroupName }); setNewGroupName(""); }) }, "创建项目组"),
					),
					groups.length === 0
						? React.createElement("p", { className: "pg-empty" }, "还没有项目组。先创建一个，再添加项目文件夹。")
						: groups.map((g) => {
								const isActiveGroup = g.id === store.activeGroupId;
								return React.createElement("div", { key: g.id, className: "pg-group" },
									React.createElement("div", { className: "pg-group-head" },
										React.createElement("span", { className: "pg-group-name" + (isActiveGroup ? " pg-group-active" : "") }, g.name),
										React.createElement("span", { className: "pg-count" }, g.folders.length + " 个文件夹"),
										React.createElement("div", { className: "pg-group-actions" },
											React.createElement("button", { className: "pg-btn pg-btn-sm" + (isActiveGroup ? " pg-btn-primary" : ""), disabled: busy || isActiveGroup, onClick: () => run(() => call("setActive", { groupId: g.id })) }, isActiveGroup ? "当前" : "设为当前"),
											React.createElement("button", { className: "pg-btn pg-btn-sm", disabled: busy, onClick: () => run(() => call("deleteGroup", { id: g.id })) }, "删除"),
										),
									),
									React.createElement("div", { className: "pg-add-row" },
										React.createElement("input", { className: "pg-input", placeholder: "项目文件夹绝对路径，如 E:\\my-project", value: pathInputs[g.id] || "", onChange: (e) => setPathInputs(Object.assign({}, pathInputs, { [g.id]: e.target.value })), onKeyDown: (e) => { if (e.key === "Enter") run(async () => { await call("addFolder", { groupId: g.id, path: pathInputs[g.id] }); setPathInputs(Object.assign({}, pathInputs, { [g.id]: "" })); }); } }),
										React.createElement("button", { className: "pg-btn pg-btn-sm", disabled: busy || !((pathInputs[g.id] || "").trim()), onClick: () => run(async () => { await call("addFolder", { groupId: g.id, path: pathInputs[g.id] }); setPathInputs(Object.assign({}, pathInputs, { [g.id]: "" })); }) }, "添加文件夹"),
									),
									g.folders.length === 0
										? React.createElement("p", { className: "pg-empty" }, "（暂无文件夹）")
										: g.folders.map((f) => {
												const isDefault = f.id === store.activeFolderId;
												return React.createElement("div", { key: f.id, className: "pg-folder" },
													React.createElement("span", { className: "pg-dot" + (isDefault ? " pg-dot-active" : "") }),
													React.createElement("div", { className: "pg-folder-main" },
														React.createElement("span", { className: "pg-folder-title" }, f.title),
														React.createElement("span", { className: "pg-folder-path" }, f.path),
													),
													isDefault ? React.createElement("span", { className: "pg-default-tag" }, "默认") : null,
													React.createElement("div", { className: "pg-folder-actions" },
														React.createElement("button", { className: "pg-btn pg-btn-sm" + (isDefault ? " pg-btn-primary" : ""), disabled: busy || isDefault, onClick: () => run(() => call("setActive", { folderId: f.id })) }, isDefault ? "默认" : "设为默认"),
														React.createElement("button", { className: "pg-btn pg-btn-sm", disabled: busy, onClick: () => run(() => call("removeFolder", { groupId: g.id, folderId: f.id })) }, "移除"),
													),
												);
											}),
								);
							}),
					msg ? React.createElement("p", { className: "pg-msg" }, msg) : null,
				);
			}

			// ── input dock: informational chip (no switching) ─────────────────
			function ProjectDock() {
				const store = useStore();
				const groups = store.groups || [];
				const activeGroup = groups.find((g) => g.id === store.activeGroupId) || null;
				if (!activeGroup) return null;
				return React.createElement("div", { className: "pg-dock" },
					React.createElement("div", { className: "pg-dock-chip" },
						React.createElement("span", { className: "pg-dock-label" }, "项目组"),
						React.createElement("span", { className: "pg-dock-name" }, activeGroup.name),
						React.createElement("span", { className: "pg-dock-sep" }, "·"),
						activeGroup.folders.length === 0
							? React.createElement("span", { className: "pg-dock-empty" }, "请到 设置 → 项目组 添加文件夹")
							: React.createElement("span", { className: "pg-dock-tags" },
									activeGroup.folders.map((f) =>
										React.createElement("span", { key: f.id, className: "pg-dock-tag" }, f.title),
									),
								),
					),
				);
			}

			// ── registrations (additive seats only — the sidebar stays stock) ─
			slots.inject("settings.section", () => slots.register(
				{ name: "settings.section", id: "project-groups", order: 30, label: "项目组" },
				() => React.createElement(ProjectGroupsPage, null),
			));

			slots.inject("conversation.input.dock", () => slots.register(
				{ name: "conversation.input.dock", id: "project-groups", order: 25, label: "项目组" },
				() => React.createElement(ProjectDock, null),
			));
		}

		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
