import type { FC } from 'react'
import './EmployeeGrid.css'
import { EmployeeCard } from './EmployeeCard'

type EmployeeGridProps = {
  employees: Array<{
    id: string
    name: string
    position: string
    role: 'director' | 'admin' | 'employee'
    avatarUrl?: string
  }>
}

export const EmployeeGrid: FC<EmployeeGridProps> = ({ employees }) => {
  return (
    <section className="employee-grid">
      {employees.map((employee) => (
        <EmployeeCard
          key={employee.id}
          name={employee.name}
          position={employee.position}
          role={employee.role}
          avatarUrl={employee.avatarUrl}
        />
      ))}
    </section>
  )
}
