import { useEffect, useRef, useState } from 'react'

interface MenuProps {
  onOpenDashboard: () => void
  onShare: () => void
  isOwner: boolean
}

export const Menu = ({ onOpenDashboard, onShare, isOwner }: MenuProps) => {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (!menuRef.current) return
      if (!menuRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div className="menu-shell" ref={menuRef}>
      <button className="menu-trigger" onClick={() => setOpen((v) => !v)}>
        Menu
      </button>
      {open && (
        <div className="menu-panel">
          <button className="menu-item" onClick={() => { setOpen(false); onOpenDashboard() }}>
            File manager
          </button>
          <button
            className="menu-item"
            onClick={() => { setOpen(false); onShare() }}
            disabled={!isOwner}
            title={!isOwner ? 'Only owners can share' : 'Share'}
          >
            Share
          </button>
        </div>
      )}
    </div>
  )
}
