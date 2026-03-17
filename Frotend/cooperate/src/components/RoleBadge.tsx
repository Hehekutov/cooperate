import type { FC } from 'react'
import { Badge } from './Badge'

type RoleBadgeProps = {
  role: 'director' | 'manager' | 'admin' | 'employee'
}

const roleLabel: Record<RoleBadgeProps['role'], { label: string; variant: 'ghost' | 'positive' | 'negative' }> = {
  director: { label: 'Руководитель', variant: 'positive' },
  manager: { label: 'Менеджер', variant: 'positive' },
  admin: { label: 'Администратор', variant: 'ghost' },
  employee: { label: 'Сотрудник', variant: 'ghost' },
}

export const RoleBadge: FC<RoleBadgeProps> = ({ role }) => {
  const descriptor = roleLabel[role]
  return <Badge label={descriptor.label} variant={descriptor.variant} />
}
