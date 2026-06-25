export type DemoRole = 'manager' | 'director'

export const demoRoleConfig: Record<
  DemoRole,
  { label: string; userId: string; scopeLabel: string; description: string }
> = {
  manager: {
    label: 'Менеджер',
    userId: 'user-manager-1',
    scopeLabel: 'Проекты',
    description: 'Общий список проектов, КП, оплат, документов и напоминаний по клиентам.',
  },
  director: {
    label: 'Руководитель',
    userId: 'user-director',
    scopeLabel: 'Все проекты',
    description: 'Общий список проектов компании с задолженностями, КП и ответственными.',
  },
}
