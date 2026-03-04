'use client'

import { useState } from 'react'
import MarketDynamics from './components/MarketDynamics'
import RotationIndicatorsLab from './components/RotationIndicatorsLab'

type HomeTab = 'market' | 'rotation-lab'

export default function Home() {
  const [tab, setTab] = useState<HomeTab>('market')

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', paddingTop: '16px' }}>
        <button
          onClick={() => setTab('market')}
          style={{
            padding: '8px 14px',
            borderRadius: '16px',
            border: '1px solid #D1D5DB',
            backgroundColor: tab === 'market' ? '#1E3A8A' : '#FFFFFF',
            color: tab === 'market' ? '#FFFFFF' : '#111827',
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
            border: '1px solid #D1D5DB',
            backgroundColor: tab === 'rotation-lab' ? '#1E3A8A' : '#FFFFFF',
            color: tab === 'rotation-lab' ? '#FFFFFF' : '#111827',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Rotation Indicators Lab
        </button>
      </div>
      {tab === 'market' ? <MarketDynamics /> : <RotationIndicatorsLab />}
    </div>
  )
}
