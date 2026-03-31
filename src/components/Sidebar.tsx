import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "../lib/utils"
import { Users, Copy, Check } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog"

interface Participant {
  peerId: string
  name: string
  isHost?: boolean
  isMuted?: boolean
  isVideoOff?: boolean
}

interface SidebarProps {
  isOpen: boolean
  participants?: Participant[]
  currentPeerId?: string
  roomCode?: string
}

// Ease-out transition matching Layout
const transitionConfig = {
  duration: 0.2,
  ease: [0.25, 0.1, 0.25, 1] as const
}

// Settings/slider icon provided by user
const SettingsIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 20 20">
    <line x1="3" y1="6" x2="10" y2="6" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    <circle cx="12.5" cy="6" r="2.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    <line x1="15" y1="6" x2="17" y2="6" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    <line x1="17" y1="14" x2="10" y2="14" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    <circle cx="7.5" cy="14" r="2.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    <line x1="5" y1="14" x2="3" y2="14" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
  </svg>
)

// Get initials from name
const getInitials = (name: string) => {
  const parts = name.trim().split(' ')
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }
  return name.slice(0, 2).toUpperCase()
}

// Generate consistent color from name
const getAvatarColor = (name: string) => {
  const colors = [
    'bg-blue-500',
    'bg-green-500',
    'bg-purple-500',
    'bg-orange-500',
    'bg-pink-500',
    'bg-teal-500',
    'bg-indigo-500',
    'bg-rose-500',
  ]
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return colors[Math.abs(hash) % colors.length]
}

export function Sidebar({ isOpen, participants = [], currentPeerId, roomCode }: SidebarProps) {
  const [showMembersModal, setShowMembersModal] = useState(false)

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.aside
            initial={{ x: -72 }}
            animate={{ x: 0 }}
            exit={{ x: -72 }}
            transition={transitionConfig}
            className={cn(
              "fixed left-0 top-0 h-full w-[72px] z-40",
              "flex flex-col items-center"
            )}
            aria-label="Sidebar navigation"
          >
            <div
              className="flex-1 flex flex-col items-center gap-1"
              style={{ paddingTop: 72, paddingLeft: 8, paddingRight: 8 }}
            >
              {/* Members Button - only icon is clickable */}
              <div className="flex flex-col items-center gap-1 p-2 w-full">
                <button
                  onClick={() => setShowMembersModal(true)}
                  className={cn(
                    "p-2.5 rounded-xl bg-secondary hover:bg-accent transition-colors"
                  )}
                >
                  <Users size={18} />
                </button>
                <span className="text-[10px] text-muted-foreground">
                  Members
                </span>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Members Modal using shadcn Dialog */}
      <Dialog open={showMembersModal} onOpenChange={setShowMembersModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-secondary">
                <Users size={20} />
              </div>
              <div>
                <DialogTitle>Room Members</DialogTitle>
                <DialogDescription>
                  {participants.length} {participants.length === 1 ? 'person' : 'people'} in this call
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* Share Section */}
          {roomCode && (
            <ShareSection roomCode={roomCode} />
          )}

          {/* Members List */}
          <div>
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-3">
              Members
            </div>
            <div className="space-y-1 max-h-[300px] overflow-y-auto scrollbar-hide">
              {participants.map((p) => (
                <MemberItem
                  key={p.peerId}
                  participant={p}
                  isCurrentUser={p.peerId === currentPeerId}
                />
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

function ShareSection({ roomCode }: { roomCode: string }) {
  const [copied, setCopied] = useState(false)

  const copyCode = () => {
    navigator.clipboard.writeText(roomCode.toUpperCase())
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const copyLink = () => {
    const link = `${window.location.origin}/room/${roomCode.toUpperCase()}`
    navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="border-y border-border py-4 -mx-6 px-6">
      <div className="text-xs text-muted-foreground uppercase tracking-wider mb-3">
        Share Room
      </div>
      <div className="flex gap-2">
        <button
          onClick={copyCode}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl",
            "bg-secondary hover:bg-accent transition-colors",
            "text-sm font-medium"
          )}
        >
          {copied ? <Check size={16} /> : <Copy size={16} />}
          #{roomCode.toUpperCase()}
        </button>
        <button
          onClick={copyLink}
          className={cn(
            "px-4 py-2.5 rounded-xl",
            "bg-foreground text-background hover:opacity-90 transition-opacity",
            "text-sm font-medium"
          )}
        >
          Copy Link
        </button>
      </div>
    </div>
  )
}

interface MemberItemProps {
  participant: Participant
  isCurrentUser: boolean
}

function MemberItem({ participant, isCurrentUser }: MemberItemProps) {
  const [isHovered, setIsHovered] = useState(false)

  return (
    <div
      className="relative flex items-center gap-3 p-2 rounded-xl hover:bg-accent/50 transition-colors"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Avatar */}
      <div
        className={cn(
          "w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-medium flex-shrink-0",
          getAvatarColor(participant.name)
        )}
      >
        {getInitials(participant.name)}
      </div>

      {/* Name and status */}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">
          {participant.name}
          {isCurrentUser && <span className="text-muted-foreground"> (You)</span>}
        </div>
        <div className="text-xs text-muted-foreground">
          {participant.isHost ? 'Host' : 'Participant'}
        </div>
      </div>

      {/* Settings button on hover */}
      <AnimatePresence>
        {isHovered && !isCurrentUser && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.15 }}
            className="p-2 rounded-lg bg-secondary hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            onClick={(e) => {
              e.stopPropagation()
              // Handle settings click - can add functionality later
            }}
            title="Member options"
          >
            <SettingsIcon />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  )
}
