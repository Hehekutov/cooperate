import type { FC } from 'react'
import './FeedbackStates.css'

type FeedbackStateProps = {
  message: string
  detail?: string
}

export const LoadingState: FC<FeedbackStateProps> = ({ message, detail }) => (
  <div className="feedback-state">
    <strong>{message}</strong>
    <span>{detail ?? 'Загружаем данные…'}</span>
  </div>
)

export const ErrorState: FC<FeedbackStateProps> = ({ message, detail }) => (
  <div className="feedback-state">
    <strong>{message}</strong>
    <span>{detail ?? 'Попробуйте обновить страницу или написать в поддержку.'}</span>
  </div>
)

export const EmptyState: FC<FeedbackStateProps> = ({ message, detail }) => (
  <div className="feedback-state">
    <strong>{message}</strong>
    <span>{detail ?? 'Пока ещё ничего не создано.'}</span>
  </div>
)
