# 插件数据库协议（可选）

除非既有数据层已经是 Prisma schema + Kysely 模型这一形态，或用户明确要求，否则不读本协议。默认按 [通用开发协议](<devlopment.md>) 与 [宿主架构协议](<plugin.host.md>) 工作；`src/database/` 的现状不构成必须沿用的架构。

## 权威来源与生成物

- `prisma/schema/*.prisma` 是表结构、枚举与注释的唯一权威；`src/database/types.ts` 与 `src/database/migrations.ts` 都是生成物，不手改。
- 改 schema 后先运行 `pnpm run prisma:generate`，再运行 `pnpm run prisma:migrate -- <名称>`，检查生成物与迁移 SQL 的实际内容。
- 一个迁移目录一篇 `migration.sql`，由 `MigrationProvider` 手动 `BEGIN`/`COMMIT`：整篇生效或整篇回滚，不留半截 DDL。
- schema、DDL、迁移与真实用户数据修改须明确授权，不夹带无关表结构调整，不重建真实数据库。

## 模型与访问

- SQL 只存在于 `src/database/models/<领域>.ts`；服务、工具与路由调用模型方法，不为搬移一次查询额外建立薄服务层。
- 模型继承 `Model<DB, 'table'>`，构造时传入表名与主键；一个模型对应一个领域，方法名表达真实的读写语义。
- `src/database/index.ts` 在运行时创建唯一的 `DatabaseSync` + Kysely 实例，并把模型实例挂在 `db` 上；不建第二个实例，不做全局依赖透传容器。
- 写队列、锁与在途 Promise 留在模型模块私有作用域，不导出可变状态。
- 模型只读方法只返回数据，不创建、认领或恢复资源，也不推进任务状态。

## 写入与一致性

- 跨表写入使用 `db.transaction()`，状态与关联变更在同一次事务内完成。
- 需要串行化的写入用模块私有 Promise 链排队，避免并发写入绕过唯一性检查。
- 凭据、文件配置与数据库存在跨存储边界时明确提交顺序、失败回滚与一致性快照，不能读到交叉版本。
- 数据库初始化失败必须显式抛出，不能以空数据覆盖持久化内容。

## 文件与测试

- 生产库固定在 `DSH_PLUGIN_HOME`（见 `src/config/paths.ts`）下，不写进宿主工作目录；测试按 worker 使用独立库文件。
- 测试库使用独立内存库或临时库并执行真实迁移；约束、事务失败与回滚按实际行为验证，不用替身模拟数据库。
