import { useState, useEffect } from 'react'
import { SupabaseClient } from '@supabase/supabase-js'
import type { Permission } from './types'
import {
  fetchPermissions,
  inviteUser,
  removeUser as removePermissionUser,
  setPublicAccess,
  setPublicRole,
  updatePermission as updatePermissionLevel,
} from './data/documents'
import { useToast } from './ui/Toast'

interface Props {
  supabase: SupabaseClient
  documentId: string
  currentUserEmail: string | undefined
  onClose: () => void
}

export const ShareModal = ({ supabase, documentId, currentUserEmail, onClose }: Props) => {
  const [isPublic, setIsPublic] = useState(false)
  const [publicRole, setPublicRole] = useState<'viewer' | 'editor'>('viewer') // <--- NEW STATE
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [newEmail, setNewEmail] = useState('')
  const [newRole, setNewRole] = useState<'viewer' | 'editor'>('editor')
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState('')
  const [copyBtnText, setCopyBtnText] = useState('Copy link')
  const { addToast } = useToast()

  const shareUrl = `${window.location.origin}${window.location.pathname}?id=${documentId}`

  useEffect(() => {
    fetchSettings()
  }, [documentId])

  const fetchSettings = async () => {
    setLoading(true)
    const { data: doc } = await supabase
      .from('documents')
      .select('is_public, public_permission')
      .eq('id', documentId)
      .single()
    
    if (doc) {
      setIsPublic(doc.is_public)
      setPublicRole(doc.public_permission as 'viewer' | 'editor')
    }

    try {
      const perms = await fetchPermissions(supabase, documentId)
      setPermissions(perms)
    } catch {
      setPermissions([])
      addToast('Failed to load sharing settings.', 'error')
    }
    setLoading(false)
  }

  // Handle toggling Restricted vs Public
  const handleAccessChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newVal = e.target.value
    if (newVal === 'restricted') {
      setIsPublic(false)
      try {
        await setPublicAccess(supabase, documentId, false)
      } catch {
        addToast('Failed to update access.', 'error')
      }
    } else {
      setIsPublic(true)
      try {
        await setPublicAccess(supabase, documentId, true)
      } catch {
        addToast('Failed to update access.', 'error')
      }
    }
  }

  // Handle changing Public Role (Viewer vs Editor)
  const handlePublicRoleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newRole = e.target.value as 'viewer' | 'editor'
    setPublicRole(newRole)
    try {
      await setPublicRole(supabase, documentId, newRole)
    } catch {
      addToast('Failed to update public role.', 'error')
    }
  }

  const inviteUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newEmail.trim()) return

    if (newEmail === currentUserEmail) {
      setMsg("You are the owner.")
      setTimeout(() => setMsg(''), 2000)
      return
    }

    try {
      await inviteUser(supabase, documentId, newEmail.trim(), newRole)
      setMsg(`Added ${newEmail}`)
      setNewEmail('')
      fetchSettings()
    } catch (error: any) {
      setMsg(error.message.includes('unique') ? 'User already added.' : error.message)
    }
    setTimeout(() => setMsg(''), 3000)
  }

  const updatePermission = async (email: string, newLevel: 'viewer' | 'editor') => {
    try {
      await updatePermissionLevel(supabase, documentId, email, newLevel)
      fetchSettings()
    } catch {
      addToast('Failed to update permission.', 'error')
    }
  }

  const removeUser = async (email: string) => {
    try {
      await removePermissionUser(supabase, documentId, email)
      fetchSettings()
    } catch {
      addToast('Failed to remove user.', 'error')
    }
  }

  const copyLink = () => {
    navigator.clipboard.writeText(shareUrl)
    setCopyBtnText('Link copied')
    setTimeout(() => setCopyBtnText('Copy link'), 2000)
  }

  const getInitials = (email: string) => email.substring(0, 2).toUpperCase()

  return (
    <div className="dashboard-overlay">
      <div className="google-modal">
        <div className="google-modal-header">
          <h2>Share "Untitled Screenplay"</h2>
          <div className="header-actions">
            <button className="icon-btn" onClick={onClose}>✕</button>
          </div>
        </div>

        {loading ? <div style={{padding: 20}}>Loading...</div> : (
          <div className="google-modal-content">
            
            {/* 1. Add People */}
            <div className="add-people-section">
              <form onSubmit={inviteUser} className="add-people-form">
                <input 
                  type="email" 
                  placeholder="Add people and groups" 
                  value={newEmail}
                  onChange={e => setNewEmail(e.target.value)}
                  className="google-input"
                />
                <select 
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as any)}
                  className="role-select-simple"
                >
                  <option value="editor">Editor</option>
                  <option value="viewer">Viewer</option>
                </select>
                <button type="submit" className="google-primary-btn" disabled={!newEmail}>Send</button>
              </form>
              {msg && <div className="toast-msg">{msg}</div>}
            </div>

            {/* 2. List */}
            <div className="people-list-section">
              <div className="section-label">People with access</div>
              
              <div className="person-row">
                <div className="avatar-circle">{getInitials(currentUserEmail || 'Me')}</div>
                <div className="person-info">
                  <div className="person-name">{currentUserEmail} (you)</div>
                  <div className="person-email">Owner</div>
                </div>
                <div className="person-role owner-label">Owner</div>
              </div>

              {permissions.map(p => (
                <div key={p.id} className="person-row">
                  <div className="avatar-circle">{getInitials(p.user_email)}</div>
                  <div className="person-info">
                    <div className="person-name">{p.user_email}</div>
                  </div>
                  <div className="role-dropdown-container">
                    <select 
                      value={p.permission_level}
                      onChange={(e) => updatePermission(p.user_email, e.target.value as any)}
                      className="role-select-ghost"
                    >
                      <option value="viewer">Viewer</option>
                      <option value="editor">Editor</option>
                    </select>
                    <button className="remove-btn" onClick={() => removeUser(p.user_email)}>×</button>
                  </div>
                </div>
              ))}
            </div>

            {/* 3. General Access (UPDATED) */}
            <div className="general-access-section">
              <div className="section-label">General access</div>
              <div className="access-row">
                <div className="access-icon-circle">
                  {isPublic ? '🌐' : '🔒'}
                </div>
                <div className="access-info">
                  {/* Dropdown 1: Restricted vs Public */}
                  <select 
                    value={isPublic ? 'public' : 'restricted'}
                    onChange={handleAccessChange}
                    className="access-select"
                  >
                    <option value="restricted">Restricted</option>
                    <option value="public">Anyone with the link</option>
                  </select>
                  <div className="access-desc">
                    {isPublic 
                      ? "Anyone on the internet with the link can view" 
                      : "Only people with access can open with the link"}
                  </div>
                </div>
                
                {/* Dropdown 2: Public Role (Visible only if Public) */}
                {isPublic && (
                  <div className="role-dropdown-container">
                    <select 
                      value={publicRole}
                      onChange={handlePublicRoleChange}
                      className="role-select-ghost"
                      style={{ fontWeight: 500, color: '#e0e0e0' }}
                    >
                      <option value="viewer">Viewer</option>
                      <option value="editor">Editor</option>
                    </select>
                  </div>
                )}
              </div>
            </div>

            <div className="google-modal-footer">
              <button className="copy-link-btn" onClick={copyLink}>
                <span style={{marginRight: 8}}>🔗</span> 
                {copyBtnText}
              </button>
              <button className="google-done-btn" onClick={onClose}>Done</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
