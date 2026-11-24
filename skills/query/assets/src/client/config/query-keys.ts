export const keys = {
  domain: ['domain'] as const,
  domainPage: (page: number, pageSize: number) => ['domain', 'page', page, pageSize] as const,
  domainDetail: (id: string) => ['domain', id] as const,
}
