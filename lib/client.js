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

		function apply(ctx) {
			const slots = ctx.get("slots");
			if (!slots) return;
			const timer = ctx.get("timer");

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

			// ── styles ──────────────────────────────────────────────────────
			const s = {
				page: { display: "flex", flexDirection: "column", gap: 10, maxWidth: 680, padding: "4px 2px" },
				hint: { opacity: 0.65, fontSize: 12, margin: 0 },
				row: { display: "flex", gap: 6, alignItems: "center" },
				input: { flex: 1, minWidth: 0, padding: "6px 8px", border: "1px solid rgba(128,128,128,.35)", borderRadius: 6, background: "transparent", color: "inherit" },
				btn: { padding: "6px 10px", border: "1px solid rgba(128,128,128,.4)", borderRadius: 6, background: "transparent", color: "inherit", cursor: "pointer", whiteSpace: "nowrap" },
				btnSmall: { padding: "2px 8px", fontSize: 12 },
				group: { border: "1px solid rgba(128,128,128,.25)", borderRadius: 8, padding: 10, display: "flex", flexDirection: "column", gap: 8 },
				groupHead: { display: "flex", gap: 8, alignItems: "center" },
				groupName: { fontWeight: 600, marginRight: "auto" },
				folder: { display: "flex", gap: 8, alignItems: "center" },
				folderTitle: { fontWeight: 500, minWidth: 130 },
				folderPath: { opacity: 0.6, fontSize: 12, marginRight: "auto" },
				empty: { opacity: 0.5, fontSize: 12, margin: 0 },
				msg: { color: "#e06060", fontSize: 12, margin: 0 },
				dock: { display: "flex", alignItems: "center", gap: 8, padding: "4px 2px", fontSize: 12 },
				dockLabel: { opacity: 0.6 },
				dockName: { fontWeight: 600 },
				dockSep: { opacity: 0.4 },
				dockSelect: { background: "transparent", color: "inherit", border: "1px solid rgba(128,128,128,.35)", borderRadius: 6, padding: "2px 6px", maxWidth: 420 },
				dockEmpty: { opacity: 0.5 }
			};

			// ── settings page: full management ───────────────────────────────
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
				return React.createElement("div", { style: s.page },
					React.createElement("h3", null, "项目组"),
					React.createElement("p", { style: s.hint }, "一个项目组可包含多个项目文件夹。在同一个会话中，agent 可以直接读写组内任意文件夹的文件并运行命令，也可在组内快速切换当前文件夹。"),
					React.createElement("div", { style: s.row },
						React.createElement("input", { style: s.input, placeholder: "新项目组名称", value: newGroupName, onChange: (e) => setNewGroupName(e.target.value) }),
						React.createElement("button", { style: Object.assign({}, s.btn, busy ? { opacity: 0.5 } : {}), disabled: busy, onClick: () => run(async () => { await call("createGroup", { name: newGroupName }); setNewGroupName(""); }) }, "创建项目组"),
					),
					groups.length === 0
						? React.createElement("p", { style: s.empty }, "还没有项目组。先创建一个，再添加项目文件夹。")
						: groups.map((g) => React.createElement("div", { key: g.id, style: s.group },
								React.createElement("div", { style: s.groupHead },
									React.createElement("span", { style: s.groupName }, g.name + (g.id === store.activeGroupId ? "（当前）" : "")),
									React.createElement("span", { style: s.empty }, g.folders.length + " 个文件夹"),
									React.createElement("button", { style: Object.assign({}, s.btn, s.btnSmall, busy || g.id === store.activeGroupId ? { opacity: 0.5 } : {}), disabled: busy || g.id === store.activeGroupId, onClick: () => run(() => call("setActive", { groupId: g.id })) }, "设为当前"),
									React.createElement("button", { style: Object.assign({}, s.btn, s.btnSmall, busy ? { opacity: 0.5 } : {}), disabled: busy, onClick: () => run(() => call("deleteGroup", { id: g.id })) }, "删除"),
								),
								React.createElement("div", { style: s.row },
									React.createElement("input", { style: s.input, placeholder: "项目文件夹绝对路径，如 E:\\my-project", value: pathInputs[g.id] || "", onChange: (e) => setPathInputs(Object.assign({}, pathInputs, { [g.id]: e.target.value })) }),
									React.createElement("button", { style: Object.assign({}, s.btn, busy ? { opacity: 0.5 } : {}), disabled: busy, onClick: () => run(async () => { await call("addFolder", { groupId: g.id, path: pathInputs[g.id] }); setPathInputs(Object.assign({}, pathInputs, { [g.id]: "" })); }) }, "添加文件夹"),
								),
								g.folders.length === 0
									? React.createElement("p", { style: s.empty }, "（暂无文件夹）")
									: g.folders.map((f) => React.createElement("div", { key: f.id, style: s.folder },
											React.createElement("span", { style: s.folderTitle }, (f.id === store.activeFolderId ? "● " : "") + f.title),
											React.createElement("code", { style: s.folderPath }, f.path),
											React.createElement("button", { style: Object.assign({}, s.btn, s.btnSmall, busy || f.id === store.activeFolderId ? { opacity: 0.5 } : {}), disabled: busy || f.id === store.activeFolderId, onClick: () => run(() => call("setActive", { folderId: f.id })) }, "设为当前"),
											React.createElement("button", { style: Object.assign({}, s.btn, s.btnSmall, busy ? { opacity: 0.5 } : {}), disabled: busy, onClick: () => run(() => call("removeFolder", { groupId: g.id, folderId: f.id })) }, "移除"),
										)),
							)),
					msg ? React.createElement("p", { style: s.msg }, msg) : null,
				);
			}

			// ── input dock: current group strip ──────────────────────────────
			function ProjectDock() {
				const store = useStore();
				const groups = store.groups || [];
				const activeGroup = groups.find((g) => g.id === store.activeGroupId) || null;
				if (!activeGroup) return null;
				return React.createElement("div", { style: s.dock },
					React.createElement("span", { style: s.dockLabel }, "项目组"),
					React.createElement("span", { style: s.dockName }, activeGroup.name),
					React.createElement("span", { style: s.dockSep }, "›"),
					activeGroup.folders.length === 0
						? React.createElement("span", { style: s.dockEmpty }, "请到 设置 → 项目组 添加文件夹")
						: React.createElement("select", {
								style: s.dockSelect,
								value: store.activeFolderId || "",
								onChange: (e) => call("setActive", { folderId: e.target.value }),
							}, activeGroup.folders.map((f) =>
								React.createElement("option", { key: f.id, value: f.id }, f.title + " — " + f.path),
							)),
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
