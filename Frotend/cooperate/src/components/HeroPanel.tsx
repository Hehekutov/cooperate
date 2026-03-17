import type { FC } from 'react'
import './HeroPanel.css'

type HeroStat = {
  label: string
  value: number | string
}

type HeroPanelProps = {
  companyName: string
  descriptor: string
  stats: HeroStat[]
  roles?: string[]
  ctaLabel?: string
  onCTAClick?: () => void
  ctaHelper?: string
}

export const HeroPanel: FC<HeroPanelProps> = ({
  companyName,
  descriptor,
  stats,
  roles,
  ctaLabel,
  onCTAClick,
  ctaHelper,
}) => {
  return (
    <section className="hero-panel">
      <div>
        <h1 className="hero-title">{companyName}</h1>
        <p className="hero-tagline">{descriptor}</p>
      </div>
      <div className="hero-stats">
        {stats.map((stat) => (
          <div className="hero-stat" key={stat.label}>
            <strong>{stat.value}</strong>
            <span>{stat.label}</span>
          </div>
        ))}
      </div>
      {(roles?.length || ctaLabel) && (
        <div className="hero-cta">
          {ctaHelper && <p>{ctaHelper}</p>}
          <div className="hero-roles">
            {roles?.map((role) => (
              <span className="hero-role" key={role}>
                {role}
              </span>
            ))}
          </div>
          {ctaLabel && (
            <button type="button" onClick={onCTAClick}>
              {ctaLabel}
            </button>
          )}
        </div>
      )}
    </section>
  )
}
