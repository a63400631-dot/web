# 轻秤

家庭共享的体重记录网站。线上版使用 Sites 和 D1。

构建命令为 npm ci 和 node build.mjs。通过 .openai/hosting.json 设置 Sites 项目 ID 和 D1 绑定 DB。通过托管后台配置 SESSION_SECRET、INVITE_DIGESTS、INVITE_EXPIRES_AT 和 OWNER_CODE_DIGEST。邀请码的 SHA-256 摘要用逗号隔开，过期时间为 Unix 秒。第一个表结构保持原样，drizzle 中的后续迁移追加邀请码兑换表。访客只在首次访问时兑换，主人入口是 /?owner=1。
