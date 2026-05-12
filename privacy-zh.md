# 隐私政策 — X Article Markdown Paste

**最后更新：2026 年 5 月**

## 数据收集

X Article Markdown Paste **不会** 收集、存储或传输任何个人数据、浏览数据或文章内容到外部服务器。

## 扩展会访问的数据

- **`x.com/compose/articles/edit/*` 页面的剪贴板数据**：当你在 X 文章编辑器内按 Ctrl+V 时，扩展读取剪贴板里的 Markdown 文本，所有解析和渲染都在你的浏览器内完成。
- **你 Markdown 中引用的图片 URL**：如果 Markdown 含 http(s) 图片链接，扩展的后台脚本会下载这些图片，然后通过 X 自身的媒体上传通道写入文章。仅下载你 Markdown 里写明的 URL，不会请求其他地址。
- **`chrome.storage.local`**：仅用于存储购买 Pro 后输入的 license key 和激活时间戳。仅存在你的本地设备。

## 扩展不会做的

- 不收集任何个人信息
- 不读取你的 X 账号信息或 cookies
- 不跟踪浏览历史
- 不访问 `x.com/compose/articles/*` 与 `twitter.com/compose/articles/*` 之外的任何页面
- 不注入广告或分析代码
- 不把你的文章内容传给任何第三方
- 不在用户之间共享数据

## 第三方服务

- **X (Twitter)**：文章写入完全由 X 自家编辑器在你已登录的 X 会话内完成。扩展不冒充也不绕过 X。
- **图片源服务器**：你 Markdown 引用了外部图片（如 imgur、cloudinary）时，对应服务器会收到一次图片下载请求——与你直接访问该 URL 等同。
- **License 验证（v1.x）**：完全在本地完成，无网络请求。

## 开源

完整源代码公开在：
<https://github.com/Icy-Cat/x-article-md-paste>

## 联系方式

如对本隐私政策有疑问，请在 GitHub 仓库提交 issue。
