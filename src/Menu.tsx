import React from 'react'

interface MenuProps {
  onOpenDashboard: () => void
}

export const Menu = ({ onOpenDashboard }: MenuProps) => {
  return (
    <div style={{ 
      position: 'fixed', top: 20, left: 20, zIndex: 50,
      display: 'flex', gap: '10px'
    }}>
      <button 
        onClick={onOpenDashboard}
        style={{ 
          background: '#333', color: 'white', border: 'none', padding: '8px 12px', 
          borderRadius: '4px', cursor: 'pointer', opacity: 0.7 
        }}
      >
        ≡ Files
      </button>
      {/* You can add Rename/Export buttons here later */}
    </div>
  )
}