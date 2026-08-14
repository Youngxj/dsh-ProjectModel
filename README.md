# dsh-ProjectModel · DeepSeek Harness 项目组插件

在**同一个会话**里跨多个项目文件夹工作：把一组项目文件夹组织成一个「项目组」，agent 可以直接读写组内**任意**文件夹的文件、列出目录、运行命令（git / npm / 构建等）——无需手动切换、无需为每个项目另开会话，像 Codex 的多文件夹工作区一样自然。

## 为什么用「项目组」模式？

| 场景 | 原生 DSH（单工作区） | 项目组模式 |
| --- | --- | --- |
| 跨项目工作 | 一个会话绑定一个工作区目录，跨项目要另开会话 | **一个会话内直接操作组内任意文件夹** |
| 上下文连续性 | 每个会话独立记忆，A 项目的结论带不到 B 项目 | 对话历史与理解全程保留，跨项目无缝衔接 |
| 文件夹切换 | 需要手动切换工作区/目录 | **无需切换**——`folderId` 直接指定目标文件夹 |
| 项目范围控制 | 工作区外不可操作（沙箱限制） | 只对已注册文件夹开放，越界拒绝，安全可控 |
| 配置持久化 | — | settings 持久化，重启/换机迁移不丢 |

核心优势：

1. **一个会话，多个项目** — 把相关项目放进一个组，在同一段对话里连续处理（改 A 的代码 → 跑 B 的测试 → 对比两者），上下文不中断、不用重复交代背景。
2. **像 Codex 一样自然的多文件夹工作区** — 组即工作集合，agent 在对话中直接对任意文件夹读写文件、运行命令，无需"先选中"、无需手动切换。
3. **安全地访问工作区之外的项目** — 会话沙箱只放行工作区目录；项目组提供受控通道：所有文件操作被限制在已注册文件夹内（`fs.contains` 越界拒绝），写入以目标文件夹为沙箱根，无需放开全局权限。
4. **开箱即用的命令执行** — 在任意项目文件夹运行 git / npm / 构建等命令（自动探测 pwsh 与 Windows PowerShell 5.1，跨版本可用）。
5. **上下文自动感知** — agent 的提示词自动带上项目组与全部文件夹列表，模型无需先探索就知道有哪些项目、该怎么选。
6. **持久化、可迁移** — 配置存于 dsh settings（`settings.yaml`），重启不丢；复制 profile 即可换机迁移。
7. **对界面零侵入** — 纯追加插槽（设置页 + 输入框状态条），不改动原始侧栏与对话框；一键安装、干净卸载。
8. **MIT 开源、一条命令安装** — `node install.mjs` 装到任意机器，安装器幂等且自动修复损坏的配置。

## 功能

- **项目组**：一个组 = 多个项目文件夹，可任意增删、重命名、设为默认（默认只是省略 folderId 时的回退，不是必需）
- **跨文件夹工作**：宿主端注册 `project` 模型工具，可对**组内任意文件夹**直接操作（通过 `folderId` 指定目标，无需切换）
  - `list` — 查看项目组与全部文件夹及其 `folderId`
  - `readFile` / `writeFile` / `listDir` — 对指定文件夹读写文件、列目录（路径限制在注册的文件夹内，越界拒绝）
  - `run` — 在指定文件夹运行命令（经 PowerShell，自动探测 pwsh / Windows PowerShell 5.1）
- **UI**：
  - 设置 → 「项目组」管理页（创建组、添加/移除文件夹、设为默认）
  - 输入框上方的状态条（信息展示：项目组名 + 文件夹标签，无切换控件）
- **持久化**：配置存于 dsh settings（`settings.yaml`），重启不丢
- **上下文感知**：agent 的提示词自动带上项目组与全部文件夹列表
- 动作名兼容别名：`read`/`write`/`list_dir`/`set_active` 等

> 为什么不在左侧栏？侧栏的「工作区区域上方」没有可追加的插槽——只有替换整个侧栏外壳才能放内容，会破坏原始侧栏样式（设置入口等）。因此本项目采用**纯追加式插槽**（设置页 + 输入框状态条），完全不改动原始界面。

## 架构

| 部分 | 机制 |
| --- | --- |
| 宿主插件 `lib/index.js` | 状态注册表 + `/api/project-groups` HTTP API（webServer 路由）+ `project` 模型工具（tools）+ 提示词上下文（systemPrompt）+ settings 持久化 |
| 浏览器插件 `lib/client.js` | `__ModuleLoader__` bundle，注册 `settings.section` 与 `conversation.input.dock` 两个追加插槽，通过 fetch 调用宿主 API |
| 通信 | 浏览器 → `/api/project-groups`（GET 查询 / POST 变更，JSON） |
| 依赖 | `@deepseek-ai/dsh-tools`、`@deepseek-ai/schemastery`、`@deepseek-ai/dsh-settings`（均随 dsh 安装提供） |

宿主插件通过 `inject: ['settings','webServer','tools','systemPrompt']` 等待核心服务挂载后再激活。

## 安装

### 前置条件

- 已安装 DeepSeek Harness（`dsh` CLI，本插件按 web profile 编写）
- 已初始化过目标 profile（存在 `$DSH_HOME/profiles/web/`，默认 `C:\Users\<你>\.dsh\profiles\web\`）
- Node.js（安装器是 `install.mjs`，直接 `node` 运行，无任何依赖）

### 方式一：Node 一键安装（推荐）

把本仓库克隆/下载到本地后，在 PowerShell、cmd 或任意终端里：

```bash
node install.mjs
# 可选参数：
#   --home <目录>   指定 DSH_HOME（默认 ~/.dsh）
#   --profile <名>  指定 profile（默认 web）
#   --auto          装完自动重启 dsh web（内部调用 restart.mjs）
#   --force         已有目录链接指向别处时强制改指
```

脚本会：
1. 把插件文件复制到 `$DSH_HOME/profiles/<profile>/plugins/dsh-ProjectModel/`
2. 创建两个目录链接（Windows 用 junction，其他平台用 symlink）：
   - `$DSH_HOME/profiles/node_modules/dsh-ProjectModel`（客户端模块表解析）
   - dsh 安装目录的 `node_modules/dsh-ProjectModel`（宿主 loader 解析裸包名）
   - 已存在且指向正确时自动跳过（幂等）；指向别处时警告保留，`--force` 才改指
3. 幂等地在 `cordis.patch.yml` 追加插件行
4. 打印重启与验证步骤（或 `--auto` 直接重启）

重启后刷新浏览器即可。重启也可以用仓库里的 `node restart.mjs`（自动找端口进程 → 停止 → 重启 → 验证 `/api/project-groups`）。

### 方式二：手动安装（不依赖本仓库脚本）

以默认 profile `web` 为例（`$DSH_HOME = C:\Users\<你>\.dsh`）：

1. **放置插件**：把本仓库复制为
   `C:\Users\<你>\.dsh\profiles\web\plugins\dsh-ProjectModel\`

2. **创建目录链接**（两条都要，Windows 用 junction）：

   ```powershell
   $target = 'C:\Users\<你>\.dsh\profiles\web\plugins\dsh-ProjectModel'
   # ① profile 侧（客户端模块表）
   New-Item -ItemType Junction -Path 'C:\Users\<你>\.dsh\profiles\node_modules\dsh-ProjectModel' -Target $target
   # ② 安装侧（宿主 loader）。把 <dsh-install> 换成 dsh 安装位置，例如：
   #    D:\Program Files\nodejs\node_cache\_npx\xxxxxxxx\node_modules
   New-Item -ItemType Junction -Path '<dsh-install>\node_modules\dsh-ProjectModel' -Target $target
   ```

   > ② 是必须的：宿主 loader 对裸包名的解析以 dsh 安装目录为基准；只做 ① 时客户端能加载但宿主端（API/工具）不生效。
   > 不确定安装目录？执行：
   > `node -e "const {createRequire}=require('module');console.log(createRequire(process.cwd()+'/cordis.yml').resolve('@deepseek-ai/dsh-base/package.json'))"`
   > 取结果中 `node_modules` 之前的路径。

3. **注册插件行**：编辑 `C:\Users\<你>\.dsh\profiles\web\cordis.patch.yml`，追加：

   ```yaml
   - insert:
       - id: project-groups
         name: dsh-ProjectModel
   ```

4. **重启 dsh**：在启动 dsh 的终端 Ctrl+C，然后重新运行 `dsh web`（或 `dsh --profile web`）。

5. **刷新浏览器**（Ctrl+F5），打开 **设置 → 项目组** 即可使用。

> 仓库里还保留了一份 `install.ps1`（PowerShell 版安装器）。早期版本以 PowerShell 提供，是因为安装动作（junction 链接、与 dsh 的 PowerShell 生态交互）在 PowerShell 里最直接；后来改成了更合理的 Node 版：dsh 本身是 Node 应用、无 PowerShell 编码坑、跨平台、零依赖。两个版本行为一致，二选一即可。

### 验证安装

- 浏览器打开 `http://127.0.0.1:3080/api/project-groups`，应返回 `{"groups":[...],...}`（未配置时为空列表）
- 设置页出现「项目组」；输入框上方出现项目组状态条
- 对话中 agent 的上下文出现「项目组：…」行

## 使用示例

在对话里直接说：

- “把 `E:\proj-a` 和 `E:\proj-b` 加进项目组「后端」”
- “在 QzoneDown-Go 里看下 go.mod”
- “对 SSL-Assistant 跑一下 `git status`”
- “同时对比一下 QzoneDown-Go 和 SSL-Assistant 的 go.mod”

agent 会直接用 `project` 工具对相应文件夹操作（`folderId` 指定目标），全部在同一个会话内、无需手动切换。

## 卸载

1. 从 `cordis.patch.yml` 删除新增的 `insert` 块
2. 删除两个 `dsh-ProjectModel` junction 目录链接
3. （可选）删除 `plugins\dsh-ProjectModel` 目录
4. 重启 dsh 并刷新页面

配置（settings.yaml 里的 `project-groups:` 段）可手动删除。

## 常见问题

**Q: 重启后 agent 的普通文件工具（read/write/pwsh）还是不能访问项目文件夹？**
这是 dsh 的会话沙箱设计：普通工具被限制在会话工作区内。`project` 工具是插件自带的通道，不受该限制（写入以目标文件夹为沙箱根）。

**Q: 为什么不在左侧栏显示？**
见上方「为什么不在左侧栏」：没有可追加的插槽，替换侧栏会破坏原始样式。

**Q: 改代码后如何生效？**
lib/ 改完 → 重启 dsh（宿主）→ 刷新浏览器（客户端 bundle 会以新 rev 下发）。

## License

MIT
