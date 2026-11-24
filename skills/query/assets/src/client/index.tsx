// 合并进现有入口：给插槽注册补一层 QueryClientProvider。
import { QueryClientProvider } from '@tanstack/react-query'
import { client } from '@/client/client'
import { PluginContext } from '@/client/config/context'
import { Panel } from '@/client/panel'

ctx.slots.inject('main', () => ctx.slots.register(
  { name: 'main', key: PANEL_ID, locale: NS, store },
  props => (
    <QueryClientProvider client={client}>
      <PluginContext.Provider value={{ ctx, t: props.t, useStore: props.useStore, actions: props.actions }}>
        <Panel />
      </PluginContext.Provider>
    </QueryClientProvider>
  ),
))
