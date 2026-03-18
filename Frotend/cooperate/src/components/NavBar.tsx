import type { FC } from 'react'
import '../ui/theme.css'
import './NavBar.css'

export type NavItem = {
  label: string
  href?: string
  active?: boolean
  onClick?: () => void
}

type NavBarProps = {
  tabs: NavItem[]
  onLogin?: () => void
  onRegister?: () => void
  loginLabel?: string
  registerLabel?: string
  guestMode?: boolean
  ctaLabel?: string
  onCTAClick?: () => void
  ctaDescription?: string
  currentUserLabel?: string
}

export const NavBar: FC<NavBarProps> = ({
  tabs,
  onLogin,
  onRegister,
  loginLabel,
  registerLabel,
  guestMode,
  ctaLabel,
  onCTAClick,
  ctaDescription,
  currentUserLabel,
}) => {
  return (
    <header className="nav-bar">
      <nav className="nav-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.label}
            className={`nav-tab ${tab.active ? 'active' : ''}`}
            onClick={tab.onClick}
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </nav>
      {guestMode && ctaLabel && (
        <div className="nav-cta">
          <span>{ctaDescription ?? 'Расскажите о своих идеях'}</span>
          <button type="button" onClick={onCTAClick}>
            {ctaLabel}
          </button>
        </div>
      )}
      {(currentUserLabel || onLogin || onRegister) && (
        <div className="nav-actions">
          {currentUserLabel && <span className="nav-user-pill">{currentUserLabel}</span>}
          {onLogin && (
            <button className="ghost-btn" type="button" onClick={onLogin}>
              {loginLabel ?? 'Войти'}
            </button>
          )}
          {onRegister && (
            <button className="primary-btn" type="button" onClick={onRegister}>
              {registerLabel ?? 'Регистрация'}
            </button>
          )}
        </div>
      )}
    </header>
  )
}
