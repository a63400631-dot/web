# 轻秤

家庭共享的体重记录网站。线上版通过 Sites 托管，资料保存在 D1。

构建使用 npm ci 和 node build.mjs。Sites 部署时在 .openai/hosting.json 设置站点 project_id 和 D1 绑定 DB，并通过托管后台设置 FAMILY_PASSWORD 和 SESSION_SECRET。部署会应用 drizzle 中的建表迁移。
