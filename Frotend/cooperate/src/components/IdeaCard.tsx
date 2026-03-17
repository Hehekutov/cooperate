import type { FC } from 'react'
import './IdeaCard.css'

export type IdeaStatus = 'active' | 'pending' | 'archived' | 'waiting'

type IdeaCardProps = {
  title: string
  description?: string
  supportPercent: number
  status: IdeaStatus
  statusLabel?: string
  onVote?: () => void
  ctaLabel?: string
  loading?: boolean
}

const statusClassMap: Record<IdeaStatus, string> = {
  active: 'active',
  pending: 'pending',
  archived: 'rejected',
  waiting: 'pending',
}

export const IdeaCard: FC<IdeaCardProps> = ({
  title,
  description,
  supportPercent,
  status,
  statusLabel,
  onVote,
  ctaLabel,
  loading,
}) => {
  return (
    <article className="idea-card" aria-busy={loading}>
      <h3 className="idea-card-title">{title}</h3>
      {description && <p className="idea-card-description">{description}</p>}
      <div className="idea-card-footer">
        <span className={`idea-status ${statusClassMap[status]}`}>{statusLabel ?? status}</span>
        <div>
          <div className="idea-card-progress">{supportPercent}%</div>
          {onVote && (
            <button className="idea-card-button" type="button" onClick={onVote} disabled={loading}>
              {ctaLabel ?? 'Открыть'}
            </button>
          )}
        </div>
      </div>
    </article>
  )
}
