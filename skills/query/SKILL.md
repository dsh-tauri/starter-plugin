---
name: query
description: Wire TanStack Query into a DSH plugin client — QueryClient singleton, query keys, and direct useQuery/useMutation calls inside components with no intermediate hook layer. Use when the user asks to add data fetching, caching, polling, or request state to plugin pages or slot components.
license: Apache-2.0
metadata:
  author: dsh-nexus-or
  version: "1.0.0"
---

# 查询样板

接入 TanStack Query 的客户端数据层。`assets/` 按 `src/` 路径镜像，只提供单例、key 与 Provider；查询与变更直接写在消费组件里。

实现规则见 [查询协议](<../../docs/specs/plugin.query.md>)，本文件只描述结构与样板。

## 何时使用

- 用户要求接入 react-query / TanStack Query，或给页面加请求、缓存、轮询、刷新。
- 已有查询层，需要新增资源查询或变更。

宿主侧的请求与持久化走服务与模型，不用本样板。

## 产出与样板

| 文件（镜像到同名 `src/` 路径） | 方式 |
| --- | --- |
| `src/client/client.ts` | 新建 |
| `src/client/index.tsx` | 合并 |

## 用法

组件里直接调用，不包一层 hook：

```tsx
const query = useQuery({
  queryKey: [getApiDomain.name, page, pageSize],
  queryFn: () => getApiDomain({ page, pageSize }),
  refetchInterval: 30_000,
})
```

```tsx
const client = useQueryClient()
const update = useMutation({
  mutationFn: (patch: { status: string }) => patchApiDomainId({ id }, patch),
  onSettled: () => client.invalidateQueries({ queryKey: [getApiDomain.name] }),
})
```

## 步骤

1. 建单例：`staleTime` 30 秒、`retry: false`、`refetchOnWindowFocus: false`。
2. 建 key：按请求资源命名。
3. 入口包 `QueryClientProvider`；面板外渲染的插槽组件各自补 Provider。
4. 在消费组件里直接写 `useQuery` / `useMutation`，`queryFn` 直接调 GenAPI 生成的函数。
5. 写操作在 `onSettled` 调 `invalidateQueries`。
6. 实时数据加 `refetchInterval`；详情查询加 `enabled`。

## 验证

```bash
pnpm run typecheck
pnpm run lint --fix
```
