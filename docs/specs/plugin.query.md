# 插件查询协议（可选）

除非既有客户端数据层已经是 TanStack Query + GenAPI 这一形态，或用户明确要求，否则不读本协议。默认按 [客户端协议](<plugin.client.md>) 工作；现有查询写法不构成必须沿用的架构。

## 客户端与缓存

- QueryClient 单例定义在 `src/client/client.ts`，由客户端入口以 `QueryClientProvider` 提供；面板外渲染的插槽组件各自补 Provider。
- 默认策略在单例里统一设置（当前 `staleTime` 30 秒、关闭重试与窗口聚焦重取），不在调用点重复覆盖同一策略。
- 全局刷新由布局刷新按钮调用 `client.invalidateQueries()` 完成，不额外维护刷新状态机。

## 查询

- 查询 key 按请求资源命名，不为同一资源另写字符串。
- 0 中间层：查询与变更直接写在消费组件里，不为单次调用建 hook 包装。
- 同一查询被多个组件复用时才抽 hook，放 `src/client/hooks/`，一个文件一个 hook。
- 读取一律用 `useQuery`，服务响应只经它持有，不复制进 Store；派生展示按需计算。
- 列表行等重复渲染的组件由容器统一取数，经 props 下发，禁止每行各自发请求。
- 实时数据按需设 `refetchInterval`；详情类查询用 `enabled` 控制，切换对象时以 `key` 重建。
- 详情页需要每次进入取最新时显式设 `staleTime: 0` 与 `refetchOnMount: 'always'`，不依赖全局策略。
- 查询失败由消费组件用 `error` 表达，不吞错、不返回默认成功值。

## 变更

- 改变服务数据的写操作一律用 `useMutation`；同样按失败可见处理。
- 需要刷新时在 `onSettled` 调 `invalidateQueries`，不在 `onSuccess` 手改缓存或回填 Store。
- 刷新用 `queryKey` 收窄到受影响的资源；只有影响面跨资源时才刷新全部。
- 变更失败由发起组件提示，不重复 Toast，不把失败显示为成功。
- 需要取消或超时时把 `AbortSignal` 经 `RequestInit` 传给 GenAPI 函数，销毁后不得让旧响应更新当前内容。
