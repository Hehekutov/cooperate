import type { FC, ReactNode } from 'react'
import './IdeaListSection.css'

type IdeaListSectionProps = {
  title: string
  children?: ReactNode
  emptyMessage?: string
}

export const IdeaListSection: FC<IdeaListSectionProps> = ({ title, children, emptyMessage }) => {
  return (
    <section className="idea-list-section">
      <h3>{title}</h3>
      {children ? (
        <div className="idea-list-grid">{children}</div>
      ) : (
        <div className="idea-empty">{emptyMessage ?? 'Ничего не найдено'}</div>
      )}
    </section>
  )
}
