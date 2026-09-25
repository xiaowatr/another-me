# Render Web Service 部署准备

状态：生产适配和本地验证完成，不代表已经上线。

## 控制台填写
- Repository: https://github.com/xiaowatr/another-me
- Branch: main
- Runtime: Node
- Root Directory: 留空（仓库根目录）
- Build Command: npm ci --include=dev && npm run build
- Start Command: npm start
- Health Check Path: /healthz

在 Render 服务的 Environment 中新增环境变量，保存后部署。不要把密钥粘贴到聊天或仓库。

|名称|值／用途|
|---|---|
|NODE_ENV|production|
|NODE_VERSION|24.21.0，固定 Node 24 运行环境|
|MINIMAX_API_KEY|自行填写国内站平台生成的密钥；仅服务端使用|
|MINIMAX_SITE|cn|
|MINIMAX_BASE_URL|https://api.minimax.cn/v1|
|MINIMAX_MODEL|MiniMax-M2.5|

PORT 由 Render 自动提供，无需手填；服务监听 0.0.0.0。Render 默认域名的同源校验自动读取 RENDER_EXTERNAL_URL；若绑定自定义域名，另设 APP_ORIGIN=https://你的域名（不带结尾斜杠和路径）。浏览器始终使用相对 /api 路径。

## 生产验证及边界
本地执行生产入口（不加载Vite和.env），测试健康检查、页面刷新、静态资源、拒绝私密路径、跨域拒绝、超长请求、演示生成和流式聊天通过。记忆整理在客户端；原本地记忆回归仍通过。真实MiniMax链路代码保留，本轮没有付费调用。健康检查只返回ok，不调用模型，不暴露配置。

请求体最大200000字节，既有背景／消息／历史字段限制保留；聊天正文2000字。生产单进程每分钟最多20次模型请求（重试也计数）、300次API请求；连接来源180次。忽略不可信X-Forwarded-For，因此反向代理下用户可能共享来源额度。全局模型并发1（原有机制）。超限可稍后继续，没有累计聊天上限，也没有自动无限重试。多实例之间不共享这些限制；第一版部署单实例。基础限流不能阻止分时滥用，也不等于账户预算上限。

/api/usage及本机停止接口生产关闭。NDJSON立即刷新头和正文、禁用代理缓冲提示，未启用压缩。Render代理实际行为待公网验证。

.local只存匿名请求编号、用量和耗时等诊断，不记完整背景、聊天或密钥；不提交。Render默认文件系统非持久，重启／重新部署可丢失诊断；没有据此推算余额。浏览器故事存储不受服务端磁盘影响。未来需要长久统计再配置持久存储，本轮未购买。

## 发布范围和检查记录
仅发布应用、配置模板、通用部署测试及本说明。历史个人案例、完整本地台账、浏览器测试脚本及日志留本机；原README留存于.local备份。未改写Git历史。

本轮本地108项回归及构建通过。生产模拟调用不收费；Render服务、HTTPS域名、手机公网访问及平台休眠唤醒后的表现尚未验证。部署后打开/healthz，再少量检查生成、流式聊天、收尾与刷新；不要用健康检查触发模型。

官方参考：[Web Service](https://render.com/docs/web-services)、[健康检查](https://render.com/docs/health-checks)。

## 当前 Git 发布阻碍与手动完成步骤
当前分支main，origin配置正确；本地历史仅初始提交。尚未提交、尚未推送。沙箱账户对.git有显式写入拒绝，即使已授予目录权限仍不能写FETCH_HEAD；现有精简Git缺少git-remote-https。没有改写权限或Git历史。

1. 安装官方完整 [Git for Windows](https://git-scm.com/downloads/win)，保留Git Credential Manager组件。若已装完整版本，使用该版本的Git Bash或PowerShell。
2. 打开普通PowerShell（无需管理员），进入项目目录。确认git --version可用；不要在Codex受限终端里重复尝试。
3. 运行项目提供的本地发布脚本：& .\.local\publish-render.ps1 。若电脑策略不允许运行脚本，可打开脚本，在普通终端逐条执行其中的Git命令，无需修改系统策略。它检查身份，fetch，拒绝远端分叉，按明确文件清单提交，然后普通push（不强推）。
4. 若提示缺少Git身份，按提示执行git config user.name和git config user.email，再运行。身份用于提交署名，不是GitHub密码。
5. GitHub认证弹窗选浏览器登录，授权Git Credential Manager；不要把密码或Token发进聊天。若网页显示无仓库权限，确认登录的是有xiaowatr/another-me写权限的账户。
6. push成功后在Render选择该仓库main创建Web Service，按上表填写；密钥只填Environment。Render在线结果仍需验证。

安全核查：待发布48个文件、1个本地历史提交及构建产物未检出当前密钥或常见长sk密钥形态；忽略规则排除.env（仅模板例外）、.local、日志和历史个人案例。此检查不是未知格式凭据的绝对保证。远端fetch因上述本地阻碍未完成，不声称检查了未知远端历史。

## Git for Windows 安装后复查
完整Git已安装于 C:/Program Files/Git/cmd/git.exe，git version 2.55.0.windows.5。Windows机器PATH已更新，当前工具进程仍持旧PATH，使用绝对路径可运行。HTTPS组件已具备，上轮缺组件问题解决。

但本轮目录授权后，.git/FETCH_HEAD仍被显式写Deny拒绝，尚未创建提交或推送。只读远端尝试分别遇到Windows TLS凭据错误及连接重置，未完成GitHub账号授权，不将它认定为密码错误。待发布48文件、当前1个本地提交及前端产物重新扫描，未检出当前密钥或常见长sk密钥。未改ACL、未强推、未修改Git历史。

请在开始菜单打开普通Windows PowerShell，执行：
```powershell
cd "C:\Users\小水\Desktop\职场小水\another me"
& .\.local\publish-render.ps1
```
脚本使用已安装的完整Git；若没有提交署名，会询问姓名和邮箱（可用GitHub隐私邮箱），无需管理员权限。如果执行策略阻止脚本，打开.local/publish-render.ps1，在普通终端逐行执行即可，不修改执行策略。Git Credential Manager出现时选浏览器登录，使用具有本仓库写权限的GitHub账户。不要在聊天中提供密码或Token。脚本只提交明确允许的发布路径，并检查没有额外暂存文件，普通push，不强推。

## v14 更新发布
用户已确认现有Render服务可生成故事和聊天。本轮新增选择原因、修复自动记忆复句提取／开场显示／输入布局及结束导航，未改变存储键，不清空数据。新通用回归tests/iteration14.test.js不含私人资料。构建和本地回归后，将本轮修改文件（server、src、.gitignore、此说明、tests/iteration14.test.js）提交推送到现有服务绑定分支。不要使用git add .，保留其他未跟踪目录。Render若启用自动部署会部署新提交；否则Manual Deploy → Deploy latest commit。仍用原Build/Start及环境变量，无需重填密钥；保持原域名才能读取同一浏览器存档。
故事、聊天、草稿、记忆及候选按人生ID存在当前域名localStorage（another-me.lives.v1；填写草稿another-me.background-draft.v1）。本地备份同样在浏览器；服务端只有临时会话缓存及无聊天正文的用量诊断，不是云存档，不跨浏览器同步。

本轮最终111项本地回归及生产构建通过。0真实模型调用；新开场和性格规则仅完成链路/单测，模型质量及真机键盘仍待实测。

## v15 发布说明
本轮为生成边界、上下文与状态修复；保留当前存储键，不清空数据。发布需包括src/consistency.js及修改的src、server、此说明；原tests/iteration14.test.js更新了合并记忆预期。本机案例、原响应及历史台账留本机，不git add .。119项本地测试、构建通过；10次真实请求，部分质量问题仍未解决，不能视为全部报告通过。
在现有main提交这些代码并普通push；Render自动部署或Manual Deploy → Deploy latest commit。Build/Start/密钥无需改变。保持原域名，浏览器旧数据继续使用。本轮未自动推送部署。

## 本地待验收改动（2026-09-24）
统一有效设定与章节数组、记忆来源检查已完成离线回归。真实内容验收尚未通过；新增存储前语义核验只完成模拟验证，发布前需复测。启用后每次故事除生成外最多增加一次模型核验，失败不自动重试；聊天调用方式不变。不要把构建通过视为发布批准。

## v37：故事预算与匿名任务恢复（待部署）
- 故事仍使用MiniMax-M3、max_completion_tokens=6000，新增MINIMAX_STORY_THINKING=disabled；设adaptive并重启可回退为开启思考。只影响故事，聊天参数、Prompt、工具结构和内容校验不变。
- MODEL_MAX_CONCURRENT=3：单个Node实例故事和聊天合计最多3个活跃任务，每个匿名浏览器同时1个，可配置1至5。无串行队列；超限明确拒绝且不调用模型，稍后手动提交。生产模型路径仍最多20次请求/分钟（包含被拒绝/重复提交），常规API 600次/分钟、同代理来源480次/分钟。不是累计聊天条数限制。
- 匿名身份是浏览器生成的256位随机凭据，只在同源请求头传输，服务端存散列；不能仅凭公开任务或模型请求ID读取故事。聊天会话、确认已读和取消也校验归属。不新增登录，不等于对公开攻击者的实名认证或防刷保证。
- 故事POST立即登记任务并返回202，轮询读取状态。前端刷新/断线后可通过原任务恢复，重复同ID不会重复调用；主动取消才停止生成。故事结果成功写入浏览器存档后清除待恢复信息。
- 任务及结果仅存单实例内存，完成后保留约1小时，上限100条；不能跨服务重启、部署、休眠或多实例恢复。重启后保留本机草稿并明确告知任务不可恢复，不自动重新付费。多实例部署前需另行共享任务存储，本版不支持。
- 无新增必填服务端密钥。沿用MINIMAX_SITE、MINIMAX_BASE_URL、MINIMAX_MODEL、MINIMAX_API_KEY及APP_ORIGIN/RENDER_EXTERNAL_URL、PORT；新增两个变量可不填，默认disabled和3。匿名凭据自动本机生成，不应填写到Render。
- MiniMax账户实际RPM/TPM/并发额度未能从账户控制台核实。应用并发3不是供应商承诺；故事和聊天使用同一服务端Key、M3模型及账户余额，也共用本应用并发和速率限制。不可据此承诺5个并发模型请求都被供应商接受。
- 本地定向模拟覆盖3任务同时启动（非排队）、第4个超限后恢复、同用户重复、越权查询/取消、单方失败/取消、故事与聊天共用名额；生产HTTP身份校验与演示流式聊天通过。18相关测试及构建通过，未做全面回归。真实故事单次测试3次，无重试，无真实并发测试；不能据小样本宣称稳定性提升。
- 必须同时发布前后端。仍开着旧网页的浏览器需先确认草稿已保存，再刷新加载新协议；旧接口请求不能直接恢复为新任务。
- 收尾补测：最终19项相关测试通过，包含澄清结束后的再次提交；生产构建及本地status已核对。部署仍需用户发起，未推送。

### 2026-09-25 v39 待发布收尾
追问改独立弹框；恢复当前故事页面、保留独立草稿；修复部分本地记忆语序/去重；手机可视区域偏移修正；计时上报补身份头，API失败提供请求ID。精确日观察范围增加边界回归。Prompt及M3参数不变，无新增环境变量。REQUEST_DIAGNOSTICS默认启用（设为0关闭）；日志仅含诊断字段，不输出完整对话或密钥。48项定向测试及构建通过；手机真机与原线上失败输出未验证。此记录是本地准备，不表示已部署。

### 2026-09-25 v40 聊天表达配置（待发布）
聊天请求新增由现有MBTI、已确认交流偏好和已建立角色经历提供的五维表达参考；日常默认1—3短句，复杂问题可展开。Prompt v24，事实与记忆校验不变，无新增调用/环境变量。29项定向离线测试与构建通过，实际模型风格尚待体验验证，旧聊天不重写。

### v41 待发布补充
聊天改为约10—180字、1—4自然段的弹性参考，不设最低字数；假设中的半年驻留等时长接入统一观察范围。25项离线回归及构建通过；原失败正文缺失，真实生成结果未复测，无新环境变量。

### v45 本地待发布：操作级重写关联
- 前后端一起发布；未来设想统一标签及工具结构诊断、父任务重写计数已实现。模型和Prompt未改，并发设置不变。31项离线回归/构建通过，不代表真实生成已验证。
- 无新增必填环境变量。保留 MINIMAX_MODEL=MiniMax-M3、既有服务端密钥及 MODEL_MAX_CONCURRENT；REQUEST_DIAGNOSTICS 未设置或非0时输出脱敏诊断，排查时可明确设为1。
- 准备发布时先审核git diff/status，仅提交可发布代码，排除.env/.local/私人记录；提交并推送现有Render关联分支，使用现有自动部署或Deploy latest commit。Build仍npm ci && npm run build，Start仍npm start，Root Directory沿用当前值。不需要升级套餐。
- 部署后检查/api/status版本2026-09-25.v45-local、Commit、maxConcurrent与模型；客户端刷新加载新资源。重启会丢失内存中未完成任务，选择无活跃任务时部署。退回本轮前的已部署Commit可恢复旧行为，但也恢复旧重写关联限制。此轮未执行发布。

### v48 本地待发布
学习记忆省略更新、明确替换事件编译、聊天故事末章时钟。34项离线定向回归和构建通过；真实效果未付费复测。无新环境变量，不改并发上限或模型。发布前审核src、server及本部署说明，只提交公开代码，排除.env/.local/私密台账与无关目录。推送Render关联main后部署最新Commit；Build npm ci && npm run build，Start npm start。上线核对/api/status version=2026-09-25.v48-local、promptVersion=2026-09-25.v27、model=MiniMax-M3，并刷新网页。内存任务不能跨重启恢复，空闲时发布。存档仍在原浏览器，升级不要求清空。

### v49 本地待发布：整数年龄与记忆更新
- 基线c882bce，本轮未commit/push；代码版本2026-09-25.v49-local，Prompt仍2026-09-25.v27，模型仍MiniMax-M3。
- 新生成必须填写出生年份与事件年龄；旧故事/聊天读取不受新必填阻断。记忆先完成持久化再发布处理进度；规则覆盖有限，不承诺任意表达都能提取。46项定向离线回归及2项生产HTTP/限流检查、构建通过；全量历史用例仍有旧契约等失败，未宣称全绿。无付费验证或手机真机验收。
- 审核改动后：git add .gitignore src server tests/iteration49.test.js tests/tasks37.test.js tests/production.test.js docs/deployment.md；git diff --cached；git commit -m "fix required event ages and transactional memory updates"；git push origin main。不要加入未关联目录、.local、.env或私密台账。Render选择Deploy latest commit（已开自动部署则等其完成），无需新环境变量。Build npm ci && npm run build；Start npm start。核对/api/status版本和实际Commit，刷新前端资源。空闲时部署；回退本轮前c882bce也会恢复旧行为。

### v50 记忆链路（未发布）
- 页面确认与自动结束共用显式操作执行和持久化；不明确的纠正可确认替换；新旧数据兼容。36项离线回归与构建通过，未真实手机验收，无新增模型调用或环境变量。版本v50-local，Prompt/模型不变。提交时包含src/memory-operations.js、src/MemoryPanel.jsx、src/memory-review.js、src/life-store.js、src/main.jsx及版本文件；同一部署包含此前未发布改动。仅提交公开代码/合成测试，勿提交.local和私人台账。发布沿用main与Render现有命令，非自动发布。

### v51 发布前浏览器验收
独立演示origin实际点击三轮记忆结束保存、刷新和手动确认替换通过；修正已有学习表达的省略形式，不增加主题词表。版本2026-09-25.v51-local，Prompt v27/M3不变。历史测试分类见本机台账，未宣称全套通过。提交当前已审核src/server、公开合成测试与部署说明，推送main后Render Deploy latest commit；环境变量无需新增。更新不会清空浏览器存档，线上尚未发布。

### v52 独立模型记忆提取（本地已启用，未发布）
结束聊天实际使用 POST /api/memory/extract，一批新用户消息至多一次模型调用；已有保存、来源与版本保护不变。前后端必须一起发布。独立环境变量（不填写时也有相同默认值）：MINIMAX_MEMORY_MODEL=MiniMax-M3、MINIMAX_MEMORY_THINKING=disabled、MINIMAX_MEMORY_MAX_TOKENS=2000；沿用服务端已有MINIMAX_API_KEY和站点地址，不增加前端密钥。故事/聊天参数和并发上限不变。
12项定向离线检查和构建通过；有限真实提取6次中5次通过、1次结构/来源校验失败，不能宣称通用提取稳定。失败不更新旧记忆/处理位置，提示聊天已保存、记忆整理未完成；同进程可恢复缓存结果，不自动重试已失败模型请求。任务不能跨服务重启恢复，空闲时部署。版本2026-09-25.v52-local，故事Prompt v27不变，独立记忆Prompt memory-v1。
审核 .env.example/.gitignore/src/server/tests/model-memory52.test.js/本说明后提交现有关联分支；勿提交.env、.local、私密台账、测试输出或无关目录。沿用Build npm ci && npm run build，Start npm start；推送后Render部署最新Commit，核对/api/status版本并刷新前端。未自动推送或部署，浏览器历史无需清空。

### v53 定向修复（未发布）
基线94a49cd，代码版本2026-09-25.v53-local；记忆提取Prompt memory-v2新增主体字段，仍M3/disabled/2000。前后端同批部署，旧存档无须清空。故事Prompt/模型/并发配置不变；聊天只补身份映射与纠正后的上下文选择，不增加审核调用。32项定向回归、生产构建和隔离浏览器模拟入口通过，未做真实调用。指定线上失败缺原始日志，未声明修复其模型输出。
发布前审核git diff/status；只提交本轮src/server、.gitignore、tests/targeted53.test.js、tests/model-memory52.test.js与本部署说明；不加.local、.env、私密台账、无关目录。提交到原关联分支并git push origin main，Render Deploy latest commit（或等待已开启自动部署）。Build npm ci && npm run build；Start npm start；无需新增变量。核对/api/status v53-local及部署Commit，刷新前端。模型记忆任务仍仅同进程可恢复，空闲时部署；回退可选基线94a49cd，但会恢复旧主体/重复/追问缺口。

### v54 日期作用域与记忆主体（未发布）
前后端需同批发布；基线94a49cd，代码版本2026-09-25.v54-local，故事Prompt仍v27，记忆Prompt为memory-v3。M3/disabled/2000记忆配置、故事参数和并发上限不变，无新增必填环境变量。37项定向回归及构建通过，不代表真实生成或手机验收通过。
审核git diff/status后只提交公开代码、合成测试和部署说明，排除.env、.local、私人台账及无关目录；推送原main后在Render部署最新Commit。沿用Build `npm ci && npm run build`、Start `npm start`。核对/api/status版本和Commit，刷新前端即可，不清空浏览器数据。任务仍不能跨服务重启恢复，空闲时部署。回退可选基线94a49cd，但会恢复此前缺陷。本轮未执行提交/推送/部署。

### v55 完整四章兼容（未发布）
允许3—4章，默认生成三章，错误分类区分数量和正文缺失；存储恢复与聊天事实保留第四章。18项定向模拟/生产回归及构建通过，无真实模型调用，无并发调整或新增环境变量。代码版本2026-09-25.v55-local，原基线94a49cd。前后端同批提交部署，沿用npm ci && npm run build、npm start；部署后核对/api/status版本。旧存档无需清空。本轮未推送发布。

### v56 手机输入风险修复（未发布）
代码版本2026-09-25.v56-local；输入测量不再压缩聚焦中的输入框，补外层滚动锁恢复。模拟手机尺寸通过，不等于真机键盘已验证。记忆模型与并发参数不变；琵琶事实模拟保存通过，线上实际漏记原因尚不明。构建通过，无新增环境变量。沿用现有发布步骤，不清空浏览器存档。

### v57 记忆诊断和三次尝试（未发布）
前后端一起部署，版本2026-09-25.v57-local；新增src/story-budget.js、server/memory-diagnostic.js和定向测试随已审核代码发布。无需新增密钥/模型/并发配置。REQUEST_DIAGNOSTICS=1可明确开启脱敏日志（默认非0也输出），检查memory_client_diagnostic及memory_request_diagnostic、model_diagnostic task=memory；只看故事请求ID不能证明记忆未调用。最多两次自动重写、同操作总模型调用最多三次，最坏等待及费用相应增加；断线恢复原任务、output_limit等不自动重试。
40项定向回归、构建和隔离浏览器模拟保存刷新通过，未进行付费或手机真机验证。沿用Build npm ci && npm run build、Start npm start，审核后推送原main，再Render部署最新Commit，核对/api/status；本轮未提交推送部署，存档不清空。

### v58 Safari 聊天定位（未发布）
src/chat-viewport.js以真实容器位置做增量校正，补文档滚动和输入框尺寸观察。9项定向回归、手机尺寸模拟与构建通过，未做Safari真机验收。代码版本v58-local，无新环境变量、无模型调用，原部署命令不变。需部署并核对版本后才能验收手机效果，不清空浏览器存档。

### v59 任务失效恢复（未发布）
前端记录服务实例，明确提交拒绝后解除无效任务关联；模糊查询失败不自动创建新付费任务。19项模拟与构建通过，无新变量，保留数据。代码版本2026-09-25.v59-local；原Build/Start与发布方式不变，本轮未推送。现实记忆跨故事共享未实施。


### v60 记忆确认与有限恢复、聊天坐标（本地未发布）
前后端一起发布，版本2026-09-25.v60-local，独立记忆Prompt memory-v4。异常确认字段进入待确认，不能自动保存；新增/更新/撤销保留各自含义。明确失败后允许用户点击一次重新整理，普通结束不触发额外重试。重启旧任务允许用户明确重建一次，跨重启保护使用当前浏览器的持久化次数；服务端任务仍非持久化。不确定断线只恢复原任务。
手机聊天改绝对文档坐标，移除双重fixed与矩形反馈。54项定向模拟检查及隔离实际页面确认保存/刷新通过；Safari真机、真实模型和线上效果未验证。无需新变量，MiniMax-M3、故事disabled/6000、记忆disabled/2000保持。
审核git diff/status，只提交本轮公开src/server、合成测试、.gitignore和本说明，不含私密台账/.local/.env/无关目录；原有未跟踪文件单独审核。用户决定发布后再提交、推送现有Render关联main，在现有服务Deploy latest commit（或等待已配置的自动部署）；Build/Start沿用现有配置。空闲时发布，核对/api/status版本及Commit，并核对浏览器加载的新构建资源；后端版本不能单独证明前端已更新。不清空浏览器数据，本轮没有执行发布。
本轮最终构建资源：index-DqiLMM1z.js、index-BbjoQ1pJ.css；部署后可用作前端资源核对，后续重新构建可能改变哈希。


### v61 人物归属统一（本地未发布）
新增src/participant-identity.js，故事开场、聊天及记忆共用三方身份定义；身份纠正持续保留，有界开场称呼保护，错误记忆归属支持沿原来源/目标/版本校验撤销。前后端一起发布，版本2026-09-25.v61-local，Prompt v28，memory-v5；MiniMax-M3及故事disabled/6000、记忆disabled/2000不变，无新环境变量。未改变页面、生成重试或保存流程。
11项针对性离线检查通过，构建index-CmBHwzHZ.js / index-BbjoQ1pJ.css；真实模型与线上实测未验证。本轮未提交/推送/部署。发布仍由用户决定，审核公开代码及合成tests/identity61.test.js后沿用现有Render关联分支与Build/Start，核对后端版本和前端资源；排除私密台账/.local/.env/无关目录，不清空旧存档。


### v62 Safari 输入位置（本地未发布）
有效visualViewport.height直接决定聊天高度；软键盘展开时取消额外安全区，其他状态保留原安全区，无固定百分比或浏览器UA偏移。版本2026-09-25.v62-local，保留v61人物归属及Prompt v28/memory-v5，模型预算不变。
7项定向检查、生产构建和隔离真实CSS模拟通过，未Safari/微信真机复测。最终资源index-Dd1a-54E.js / index-CWJawJPa.css。未提交/推送/部署；用户发起发布后审核v61/v62公开代码、合成测试及本说明，沿原关联分支和现有Render Build/Start部署，核对后端版本和前端资源，原Safari与微信对照验收。不清空数据，不提交私密台账或临时夹具。

## v63 定向修复发布说明
本轮本地代码修复相对观察期限锚点、显式排除关系解析、聊天时点纠正传递、未提供性别时针对主角的直接引语称呼，以及前端累计调用预算/明确拒绝后的任务状态。26项定向离线检查与生产构建通过；真实模型语义、线上和手机效果尚未复测，不能视为全部验收通过。构建index-CGn666Av.js / index-CWJawJPa.css，后端2026-09-25.v63-local，Prompt 2026-09-25.v29。
当前实际模型保持MiniMax国内站MiniMax-M3（上文早期M2.5表为历史记录），故事thinking disabled/6000，记忆thinking disabled/2000，memory-v5；不需要更换密钥或服务。只提交本轮src、server、.gitignore、tests/targeted63.test.js及此说明，私密台账、附件、日志、.local和其他未跟踪目录不提交。普通推送到现有Render绑定main后自动部署或手动Deploy latest commit；保持既有Build/Start命令及域名。部署后同时核对状态接口版本与页面资源哈希。本轮未自动提交、推送或部署。

## v64 四次预算与重写反馈
总模型调用上限按授权调整为4次（含模型追问），自动重写最多3次。重写接收服务端上次校验原因和字段，保持原有效设定及时间校验，不靠放宽校验获取成功。需发布新增server/story-rewrite.js及本轮src/server修改、相关合成测试。23项定向离线检查与构建通过，v64-local/Prompt v30，index-kwPjDavy.js / index-CWJawJPa.css；未真实模型复测，不保证所有生成成功。本地尚未提交推送部署；模型/密钥/Build/Start保持既有配置。输入框用户现场反馈位置已正常，本轮未修改布局。
