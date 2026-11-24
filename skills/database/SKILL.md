---
name: database
description: Scaffold a Prisma + Kysely data layer for a DSH plugin — schema, generated types, migrations, singleton connection, and query models. Use when the user asks to add a database, tables, migrations, persistence, or SQL models to a plugin.
license: Apache-2.0
metadata:
  author: dsh-nexus-or
  version: "1.0.0"
---

# 数据库层样板

按本流程生成 Prisma schema + Kysely 模型的数据层。`assets/` 按目标目录镜像，复制后替换 `<Domain>`、`<domain>`、`<table>`、`<plugin>` 占位符。

实现规则见 [数据库协议](<../../docs/specs/plugin.database.md>)，本文件只描述结构与样板。

## 何时使用

- 用户要求给插件加数据库、加表、加迁移或加持久化。
- 已有 Prisma + Kysely 数据层，需要新增领域表与模型。

仅读写配置文件或只需内存状态时不用本样板。

## 产出与样板

| 目标文件 | 样板 |
| --- | --- |
| `prisma/schema/.conf.prisma` | `assets/prisma/schema/conf.prisma` |
| `prisma/schema/<domain>.prisma` | `assets/prisma/schema/domain.prisma` |
| `prisma.config.ts` | `assets/prisma.config.ts` |
| `scripts/migrate.ts` | `assets/scripts/migrate.ts` |
| `src/config/paths.ts` | `assets/src/config/paths.ts` |
| `src/database/index.ts` | `assets/src/database/index.ts` |
| `src/database/models/<domain>.ts` | `assets/src/database/models/domain.ts` |
| `src/database/utils/migration.ts` | `assets/src/database/utils/migration.ts` |
| `test/<domain>-model.test.ts` | `assets/test/domain-model.test.ts` |

## 步骤

1. 写 schema：一个领域一个文件，字段用 `///` 注释写清业务含义，枚举 PascalCase，表 `@@map("snake_case")`。
2. 运行 `pnpm run prisma:generate`，检查 `src/database/types.ts` 的枚举与列类型。
3. 运行 `pnpm run prisma:migrate -- <name>`，检查生成的 SQL 只含预期变更。
4. 写模型：继承 `Model<DB, '<table>'>`，只放 SQL，方法名用领域动词。
5. 把模型挂到 `db` 单例，服务与路由只调模型方法。
6. 写测试：临时库执行真实迁移，覆盖约束与事务回滚。

## 验证

```bash
pnpm run prisma:generate
pnpm run prisma:migrate -- <name>
pnpm run typecheck
pnpm run test
```
