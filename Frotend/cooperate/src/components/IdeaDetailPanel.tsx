import type { FC } from 'react'
import './IdeaDetailPanel.css'

type IdeaDetailPanelProps = {
  title: string
  description: string
  supportPercent: number
  statusLabel: string
  onVote?: () => void
  onDetails?: () => void
  onModerateApprove?: () => void
  onModerateReject?: () => void
  viewerRole?: 'director' | 'admin' | 'employee'
  moderationHint?: string
  primaryActionLabel?: string
  secondaryActionLabel?: string
}

export const IdeaDetailPanel: FC<IdeaDetailPanelProps> = ({
  title,
  description,
  supportPercent,
  statusLabel,
  onVote,
  onDetails,
  onModerateApprove,
  onModerateReject,
  viewerRole,
  moderationHint,
  primaryActionLabel,
  secondaryActionLabel,
}) => {
  return (
    <section className="idea-detail-panel">
      <div className="idea-detail-header">
        <div>
          <h2 className="idea-detail-title">{title}</h2>
          <span className="idea-detail-status">{statusLabel}</span>
        </div>
        <p className="idea-detail-progress">{supportPercent}%</p>
      </div>
      <div className="idea-detail-body">{description}</div>
      {moderationHint && <small>{moderationHint}</small>}
      {(onVote || onDetails) && (
        <div className="idea-detail-actions">
          {onVote && (
            <button className="idea-detail-btn primary" type="button" onClick={onVote}>
              {primaryActionLabel ?? 'Голосовать'}
            </button>
          )}
          {onDetails && (
            <button className="idea-detail-btn secondary" type="button" onClick={onDetails}>
              {secondaryActionLabel ?? 'Читать обзор'}
            </button>
          )}
        </div>
      )}
      {viewerRole !== 'employee' && (onModerateApprove || onModerateReject) && (
        <div className="idea-detail-actions">
          {onModerateApprove && (
            <button className="idea-detail-btn primary" type="button" onClick={onModerateApprove}>
              Опубликовать
            </button>
          )}
          {onModerateReject && (
            <button className="idea-detail-btn secondary" type="button" onClick={onModerateReject}>
              Отклонить
            </button>
          )}
        </div>
      )}
    </section>
  )
}
