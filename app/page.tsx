'use client'

import { useState } from 'react'
import MarketDynamics from './components/MarketDynamics'
import RotationIndicatorsLab from './components/RotationIndicatorsLab'
import ThemeToggle from './components/ThemeToggle'

type HomeTab = 'market' | 'rotation-lab'

export default function Home() {
  const [tab, setTab] = useState<HomeTab>('market')

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '8px',
          paddingTop: '16px',
          flexWrap: 'wrap',
          paddingInline: '12px',
        }}
      >
        <button
          onClick={() => setTab('market')}
          style={{
            padding: '8px 14px',
            borderRadius: '16px',
            border: '1px solid var(--md-tab-border)',
            backgroundColor: tab === 'market' ? 'var(--md-primary)' : 'var(--md-surface)',
            color: tab === 'market' ? 'var(--md-on-primary)' : 'var(--md-text)',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Market Dynamics
        </button>
        <button
          onClick={() => setTab('rotation-lab')}
          style={{
            padding: '8px 14px',
            borderRadius: '16px',
            border: '1px solid var(--md-tab-border)',
            backgroundColor: tab === 'rotation-lab' ? 'var(--md-primary)' : 'var(--md-surface)',
            color: tab === 'rotation-lab' ? 'var(--md-on-primary)' : 'var(--md-text)',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Rotation Indicators Lab
        </button>
        <ThemeToggle />
      </div>
      {tab === 'market' ? <MarketDynamics /> : <RotationIndicatorsLab />}
    </div>
  )
}
