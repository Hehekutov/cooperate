import type { FC, FormEventHandler, ReactNode } from 'react'
import './FormPanel.css'

type FormPanelProps = {
  title: string
  description?: string
  children: ReactNode
  primaryCta: string
  onSubmit?: FormEventHandler<HTMLFormElement>
  secondaryCta?: string
  onSecondary?: () => void
  fullWidth?: boolean
  submitDisabled?: boolean
  secondaryDisabled?: boolean
}

export const FormPanel: FC<FormPanelProps> = ({
  title,
  description,
  children,
  primaryCta,
  onSubmit,
  secondaryCta,
  onSecondary,
  fullWidth,
  submitDisabled,
  secondaryDisabled,
}) => {
  const handleSubmit: FormEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault()
    onSubmit?.(event)
  }

  return (
    <section className="form-panel" style={fullWidth ? { maxWidth: '100%' } : undefined}>
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      <form noValidate onSubmit={handleSubmit}>
        {children}
        <div className="form-actions">
          <button className="cta-btn" type="submit" disabled={submitDisabled}>
            {primaryCta}
          </button>
          {secondaryCta && onSecondary && (
            <button
              className="cta-btn"
              type="button"
              onClick={onSecondary}
              disabled={secondaryDisabled}
            >
              {secondaryCta}
            </button>
          )}
        </div>
      </form>
    </section>
  )
}
