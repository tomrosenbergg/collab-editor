interface MenuProps {
  onOpenDashboard: () => void
  onShare: () => void
  isOwner: boolean
}

export const Menu = ({ onOpenDashboard, onShare, isOwner }: MenuProps) => {
  return (
    <div style={{ 
      position: 'fixed', top: 20, left: 20, zIndex: 50,
      display: 'flex', gap: '10px'
    }}>
      <button 
        onClick={onOpenDashboard}
        style={{ 
          background: '#333', color: 'white', border: 'none', 
          padding: '8px 12px', borderRadius: '4px', cursor: 'pointer', opacity: 0.7 
        }}
      >
        ≡ Files
      </button>
      
      {isOwner && (
        <button 
          onClick={onShare}
          style={{ 
            background: '#333', color: '#30bced', border: 'none', 
            padding: '8px 12px', borderRadius: '4px', cursor: 'pointer', opacity: 0.7 
          }}
        >
          Share
        </button>
      )}
    </div>
  )
}