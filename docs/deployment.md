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
