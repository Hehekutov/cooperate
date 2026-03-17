import type { FC } from 'react'
import './Badge.css'

type BadgeProps = {
  label: string
  variant?: 'ghost' | 'positive' | 'negative'
}

export const Badge: FC<BadgeProps> = ({ label, variant = 'ghost' }) => {
  return <span className={`badge badge-${variant}`}>{label}</span>
}
