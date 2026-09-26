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

## v65 确认范围、开场与记忆诊断
最新明确月份确认优先，支持顿号月份列举；普通追问中明确分世界确认进入规范化；显式月份的超时长总结增加校验，开场无依据的既往对话归属使用安全替代。记忆增加批内纠正规则及脱敏计数/过滤原因，不改保存保护或自动付费重提。44项定向离线检查与构建通过，v65-local/Prompt v31/memory-v6，index-DI5iRPDs.js / index-CWJawJPa.css。实际模型语义、现场记忆0条原因仍待核验，不宣称全部验收通过。本轮未提交推送部署；四次总调用及M3配置保持不变。发布代码与合成normal65测试即可，私密报告和台账不提交。

## v66 记忆主体证据的有限容错
仅主体证据异常、而本批用户来源及事实原句仍可验证时进入待确认，不自动写入；来源/事实不符仍拒绝。新增src/MemoryFailureDetails.jsx显示已保存的安全错误说明与请求编号，需随src/server代码发布。memory-v7强化混合句处理，模型零项用准确提示；不保证真实提取质量已改善。32项离线检查与构建通过，v66-local，index-Ci4pyhXE.js / index-CWJawJPa.css。没有真实模型调用、提交、推送或部署；模型配置和四次故事预算不变。附带合成tests/memory66.test.js，不提交本地日志/报告/台账。

## v68 全量发言总结与兜底
结束聊天先持久化用户发言摘录；同一次记忆调用增加逐消息总结，覆盖状态、心情和问题等。资料面板显示总结及待归纳摘录，事实卡继续独立核对来源。模型漏项/失败不删除摘录；空事实返回保留处理位置，不自动增加调用。新增src/conversation-summary.js、src/ConversationSummary.jsx及合成tests/summary68.test.js，连同本轮src/server和memory66/67测试发布。36项定向离线测试、隔离页面模拟及构建通过；真实模型覆盖质量未验证，摘录不等于完成语义归纳。v68-local/memory-v8，index-qpbx61Le.js / index-CWJawJPa.css。现有M3配置、记忆2000输出及四次故事总预算不变。尚未提交推送部署；沿现有Render绑定分支/Build/Start发布前后端，核对资源和状态版本。私密台账、日志与.local不提交。

## v69 导航同排与整理入口收敛
“我的那些如果”移入标题行，资料面板统一“整理聊天”。invalid_response/task_expired自动使用现有一次恢复机会，预算与任务版本先持久化；没有无限重试，未知网络/配置/余额故障不自动新增付费调用。60项定向离线检查和三组隔离页面模拟通过，桌面/320px响应式检查通过；不代表真实模型或线上已验收。v69-local/memory-v8，index-Bq3mlHf_.js / index-CthaD0dQ.css。与v68改动一起按原Render方式发布前后端，模型和Build/Start不变。本地未提交推送部署，私密夹具和台账不提交。

## v70 文风参考接入
新增server/writing-style.js，故事和聊天使用统一表达边界及分开的少量认可示例；server/prompts.js接入普通/流式请求，src/chat-style.js清理重复长度规则及类型顺序。完整参考档案不删减，不运行时读取整篇文档。模型、token、重试、记忆及界面不变，无额外润色调用。两个故事输入与六个聊天情境的请求组装检查及身份回归共8项通过；构建通过，真实模型表达质量未测。v70-local/Prompt 2026-09-26.v32/style-reference-v1，前端仍index-Bq3mlHf_.js。未提交推送部署。发布必须包含新增server/writing-style.js及本轮代码，可包括合成tests/style70.test.js；本地日志台账不提交。沿用现有Render Build/Start，核对/api/status后端版本，前端哈希不作为本轮文风是否发布的唯一依据。

## v71 用户表达适配
在参考文风边界内，当前用户有依据的表达习惯优先于范例口吻与MBTI；沿用已传递初始与近期用户原文，不额外调用模型。两个故事输入、六种聊天情境的请求测试通过，真实模型适配质量未验证。v71-local/Prompt v33/style-reference-v2，前端资源不变；发布含server/writing-style.js及prompts/diagnostics，现有配置不变。本地未提交推送部署。

## v72 动态补充题
新增 src/question-bank.js、src/supplementary.js、src/SupplementaryQuestions.jsx、server/supplementary-planner.js，连同API、模型调用、生成上下文、表单/草稿和样式接入一起发布。31题按语义选0—3题，总展示不超过8；每组提交调用questions任务，不按输入字数触发。匿名用户/输入快照缓存、限流及并发保护沿用；选题使用当前模型、thinking disabled、3500输出额度，是独立于故事4次预算的新增模型调用。失败不无限自动重试，可保留答案直接生成；核心冲突须确认或修改。
23项定向离线检查与隔离生产页面模拟通过，真实模型理解和情节落实质量尚未验证；0付费测试，未提交推送部署。v72-local / Prompt 2026-09-26.v34 / questions-v1，index-BGUSkg-V.js / index-PN3jeIkM.css。沿现有Render绑定分支、原Build/Start部署整个前后端，无新密钥或环境变量；核对/api/status的version/questionPlannerVersion及前端资源。保留旧存档，勿上传.local、私密台账、原始日志和用户附件。

## v73 补充题等待及内容约束
新增src/services/question-admission.js与匿名保护的GET /api/availability，前后端必须一起发布。补充题占用时只读等待最多45秒，显示当前用户等待任务；明确进槽前busy不再缓存为永久失败，网络不明/模型失败不自动重付。保留原限流与并发。CORE/STORY加强选择一致性与无依据贴身习惯留白；可选审查增加前后连续性约束，未改变启用配置或增加模型调用。
30项离线测试、隔离生产HTTP demo及构建通过，未做本轮浏览器/真实模型/线上验收；语义一致性仍未证明。v73-local/Prompt 2026-09-26.v35，index-B-qaOwql.js/index-PN3jeIkM.css。现有Render Build/Start不变，无新环境变量；未提交、推送、部署。私密记录和.local不提交。

## v74 手机补充页简化
直接生成变为底部主按钮，继续选题可选；未知短答标跳过并保留原文，首组额外要求默认折叠，不再反复要求补写。移除常驻时间说明，停用G12选题但兼容旧答案；手机返回按钮不折行。发布包含src/SupplementaryQuestions.jsx、supplementary.js、style.css、server/supplementary-planner.js/diagnostics及合成测试变化。
21项定向测试、320px隔离生产页面模拟、构建通过；零真实模型调用，手机Safari真机待验收，初次选题仍有模型耗时。v74-local/questions-v2，index-C8OivjeC.js/index-BGBeyu69.css。无新环境变量，沿现有Render前后端发布流程；未提交推送部署，不清旧数据。

## v75 开场收信人与过去经历记忆
故事请求补回CORE，开场明确现实自己为收信人，有限误称检查沿用已有重写预算。记忆接受来源明确的用户过去经历，保留时态/确认/归属保护；资料面板先展示已保存记忆，聊天回顾改为折叠紧凑列表。新数据走原保存流程，不迁移或删除旧数据，不自动付费回溯处理旧摘要。
34项定向离线、隔离生产页面模拟保存刷新及390px布局检查通过，未验证真实模型/手机Safari/线上效果。v75-local/Prompt 2026-09-26.v36/memory-v9，index-D7jDFCH_.js/index-BkyzXg7d.css。发布需包含前后端全部相关修改及既有v74修改，沿原Render Build/Start，无新环境变量；核对/api/status及前端资源。未提交推送部署，私密台账、原始记录、.local不得上传。

## 补充题交互动效（前端更新）
本轮仅SupplementaryQuestions.jsx/style.css：轻按压与选中勾号、整组过渡、等待墨点、重复点击保护、固定头尾的单内容滚动弹层及安全区。无新依赖/环境变量，不改选题规则与模型提示，后端版本仍v75-local。
21项回归、隔离生产页面选择/导航/手写/失败恢复/请求中直接生成和构建通过；390px及压缩可视高度模拟通过。真实Safari键盘及操作系统减少动态效果仍待验收。前端index-CvcHetcf.js/index-AVcMViue.css；未推送部署。沿原Render流程构建发布，保留此前未提交更改，私密记录/夹具不上传。

## 选项墨色晕染（前端更新）
仅补充组件与CSS：点击原点柔边径向墨层220ms铺开、勾号延后浮现，取消淡退，键盘中心起始，减少动态效果静态回退。隔离页面选择切换/取消/键盘及等宽检查、构建通过；手机真机和逐帧视觉待验收。index-BvA2xjdZ.js/index-C_fqEgof.css；后端不变，未推送部署，无新配置。

## 横向淡水墨选中（前端更新）
仅补充题组件/CSS：低透明度内联SVG笔痕，220ms横向揭示，深绿文字及小勾；减少动态效果静态显示。无新资源请求或依赖。构建与390px隔离页面选中/取消/键盘检查通过，未真机验证。index-CVEkO3_Q.js/index-Ct6sMT2l.css；未部署，后端不变，沿用现有发布流程。

## 同页补充与无边框墨迹（前端更新）
补充组件合并已有题到同一页，移除题数和继续选题/翻页入口；首次选题及核心冲突规则不变，答案按全部显示题保存，旧数据兼容。正常等待文案更换，笔痕加宽加深、去常驻边框。21项回归、构建、390px隔离填写到生成通过；零付费测试，手机Safari及旧多组浏览器未复测。index-CxAaYDBv.js/index-C9q6ejAT.css；本地5210已提供资源，未推送部署，后端版本不变。

## v80 现实北京时间
新增server/realtime-context.js，prompts接入开场和全部聊天路径。现实问候/作息使用每请求Asia/Shanghai日期与时分，故事日期/角色经历仍独立，不因故事夜晚催睡。不新增模型调用，不改变文风采样或跨故事共享。10项定向和构建通过，真实模型表现待验收。v80-local/Prompt v37，前端资源不变；本地5210已重启，线上未部署。发布须包含新增服务端模块及prompts/diagnostics，无新配置。

## v81 情景题与语义补充
新增src/scenario-bank.js（40道原编号题）、src/scenario-context.js及server/scenario-review.js，连同question-bank、supplementary、SupplementaryQuestions、supplementary-planner、experience、prompts、diagnostics一起发布。分组动态选题、语义来源去重；每次最多一道情景题，近期轮换且同草稿稳定。情景原文独立存储，只把有证据的抽象条件/考虑方式传给生成；失败可跳过可选分析，不能退回发送原文。旧数据不清空，不自动回溯旧故事。
有效情景参考会触发独立事件结构检查，不受普通可选setting review开关控制；新增的review调用共享既有故事操作总4次模型调用预算，因此实际故事重写机会可能减少。补充questions仍按原独立预算、按组提交，不逐字调用。无新依赖/密钥/环境变量；可能增加生成耗时，未测真实模型延迟。
36项定向测试、构建、隔离生产页两次模拟故事通过（含分析失败后跳过）。预设返回不能证明真实语义去重、不同回答的人物效果或搬用检测准确率；手机尺寸模拟不等于Safari真机。v81-local/Prompt v38/questions-v3，index-DNsiLHya.js/index-C9q6ejAT.css；沿现有Render前后端流程，核对/api/status与前端资源。未提交推送部署；私密台账、附件、.local及原始测试记录不得上传。

## v82 按阶段限制调用
替代v81共享四次规则：story最多4（含原模型追问/续答），scenario review最多4，setting review最多4（仍受原启用开关控制），总兜底12。检查不占正文机会；每个候选正文至多各检查一次，并非每次都用完额度。questions仍独立。新增server/story-stage-budget.js，连同minimax、story-timing、index、story-tasks、experience、core、diagnostics以及前端story-budget、story-retry、story-task-client一起发布。
任务响应新增storyCallCount/stageCallCounts；总数cumulativeCallCount语义保持，前端用正文数恢复和决定重写。20项定向回归、构建通过，含第四份正文在累计调用超过4后仍完成检查；零付费测试，真实模型成功率未验证。v82-local/Prompt v38/questions-v3，index-R1GMcpmn.js/index-C9q6ejAT.css。原Render配置不变，必须前后端一起发布；未提交推送部署。

## v83 叙述输出校验
新增server/story-output-checks.js，连同experience/prompts/story-rewrite/story-tools/diagnostics发布。保存和返回前拒绝内部规则说明泄漏及未知性别下的部分无依据主角设定，带字段与原因进入既有重写预算；不以删句代替正确生成。正常第三方描述、有原文依据的声部不全局拦截。有限句式检测仍可能漏检，不能宣称完整语义保证。
28项定向测试、真实失败输出离线重放、模拟重写流程和构建通过；无新增付费调用/真机验收，未部署。v83-local/Prompt v39/questions-v3，index-R1GMcpmn.js/index-C9q6ejAT.css；按原Render流程发布，无新配置。旧故事和文风批注材料不自动改写，私密材料不提交。

## v84 修订文风与补充复核
writing-style更新自然停句与表达参考，prompts v40；开场增加部分无依据共同互动校验，特定病句/完全重复长段拒绝后沿已有预算重写。不是全局词语屏蔽或全语义保证。前端章节按原换行分段，旧正文不修改。
questions-v4首次零题可在同一任务内额外复核一次相关行为信息缺口，最多2道普通题，允许仍为0；已展示/跳过状态不进入首次复核。不强制凑数，但可能增加一次questions调用与等待，故事/检查额度不变。发布须包含补充规划器、experience、writing-style、prompts、story-output-checks、participant-identity、main及diagnostics等前后端变更。
38项定向与构建通过，隔离页面模拟0题复核、填写、生成及分段通过；无真实模型/真机验收。v84-local/Prompt v40/questions-v4/style-reference-v3，index-DHfW1V84.js/index-C9q6ejAT.css；未推送部署，无新配置，不上传私密修订材料/台账/夹具。

## v85 补充题逻辑审查与时间边界
补充题统一过去/未来时间锚，新增独立主体和题义审查，替换旧零题复核；普通选题最多初选+审查两次，缓存与直接生成保护保留。生成明确未知家庭构成不补造，有限主角兄弟姐妹句式在返回前拒绝并使用原有重写上限。单独现实报时问题由服务器Asia/Shanghai即时回答，沿用流式确认和历史，不调用模型；复杂混合问句仍可能走模型。
44项定向、构建、隔离页面返回刷新及本地HTTP报时通过。真实合成独立题义审查有小样本结果，未做最终真实生成全链或手机验收，不保证所有语义均正确。v85-local/Prompt v41/questions-v5，前后端一起发布；本轮未推送部署，保留数据，模型配置和生成额度不变。

## v86 补充题排序与提示字段一致性
故事字段对齐effectiveSetting、聊天字段提供时才用；同日完成允许今天/刚刚。补充候选按模型提供的信息增量和具体用途排序，过滤低值/同维度后最多展示3题，有用缺口足够时优先3。两阶段共用剩余额度、跳过、情景、作答背景和确认；不会为凑数推翻硬停止。未新增调用阶段，严格评估字段校验失败沿用保留答案和直接生成。
49项定向与构建通过，未新增真实模型或手机验收。v86-local/Prompt v42/questions-v6；前后端需一起发布，本轮未推送部署，不清数据。

## v87 可选补充失败自动恢复
同次补充最多额外一次结构修正（共最多3次模型调用），保留成功阶段与归属缓存；仍不可用自动用已答普通信息进入现有故事生成，未验证情景分析不传入。修正soft stop继承并细化脱敏审查错误。生活状态继续选填，无依据不补职业、学籍或性别；有限句式检查不代表完整语义保证。
55项定向、构建、两次隔离页面故障自动生成且无重复故事通过。未新增真实模型或手机验收。v87-local/2026-09-27.v43/questions-v7，前后端一起更新；本轮未推送部署。自动进入生成属于明确授权的行为改变，不改故事额度，不能承诺断网/余额不足时成功。

## v88 正文换行兼容
正文显示层识别有限br换行标签，旧故事无需重生成或迁移；新输出统一换行，继续纯文本渲染，不执行HTML。定向断言、构建、隔离旧存档页面通过。前后端一起更新，本轮未推送部署，模型与提示词不变。

## v89 常见格式兼容
有限兼容实体、段落和强调标记，旧模型文本展示统一，流式换行保留；用户输入和原存档不改、不执行HTML。离线与隔离页面通过，真实模型/真机未验证。index-CB6pdDj5.js，前后端一起发布；本轮未推送或部署，提示词与模型配置不变。

## v90 对话比较边界
共用表达规则约束开场及普通/流式聊天：不拿平行人生评价现实选择，不以劝止情绪代替陪伴。2项接入回归与构建通过，真实输出待验证。后端v90/Prompt v44/style-reference-v4，前端hash不变；本轮未部署。
