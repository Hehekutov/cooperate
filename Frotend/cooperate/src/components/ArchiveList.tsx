import type { FC } from 'react'
import './ArchiveList.css'
import { Badge } from './Badge'

type ArchiveItem = {
  id: string
  title: string
  description?: string
  status: 'done' | 'rejected'
}

type ArchiveListProps = {
  items: ArchiveItem[]
}

export const ArchiveList: FC<ArchiveListProps> = ({ items }) => {
  return (
    <section className="archive-list">
      {items.map((item) => (
        <article key={item.id} className="archive-item">
          <h4>{item.title}</h4>
          {item.description && <p>{item.description}</p>}
          <Badge label={item.status === 'done' ? 'Выполнено' : 'Не выполнено'} variant={item.status === 'done' ? 'positive' : 'negative'} />
        </article>
      ))}
    </section>
  )
}
