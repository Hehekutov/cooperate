import type { FC } from 'react'
import './EmployeeCard.css'
import { RoleBadge } from './RoleBadge'

type EmployeeCardProps = {
  name: string
  position: string
  role: 'director' | 'admin' | 'employee'
  avatarUrl?: string
}

export const EmployeeCard: FC<EmployeeCardProps> = ({ name, position, role, avatarUrl }) => {
  const initials = name
    .split(' ')
    .map((segment) => segment.charAt(0))
    .join('')
    .slice(0, 2)

  return (
    <article className="employee-card">
      <div className="employee-avatar">{avatarUrl ? <img src={avatarUrl} alt={name} /> : initials}</div>
      <div className="employee-info">
        <h4>{name}</h4>
        <p>{position}</p>
        <RoleBadge role={role === 'director' ? 'manager' : role} />
      </div>
    </article>
  )
}
