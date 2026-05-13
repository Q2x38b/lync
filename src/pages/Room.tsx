import { useState, useRef, useEffect, useCallback } from "react"
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useAction } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { useWebRTC } from '../hooks/useWebRTC'
import { useFavicon } from '../hooks/useFavicon'
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "../lib/utils"
import { Sidebar } from "../components/Sidebar"
import {
  Send,
  AlertTriangle,
  X,
} from 'lucide-react'

// Custom icons
const MicIcon = ({ size = 20 }: { size?: number }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 18 18">
    <rect x="5.75" y="1.75" width="6.5" height="9.5" rx="3.25" ry="3.25" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
    <path d="M15.25,8c0,3.452-2.798,6.25-6.25,6.25h0c-3.452,0-6.25-2.798-6.25-6.25" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
    <line x1="9" y1="14.25" x2="9" y2="16.25" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
  </svg>
)

const MicOffIcon = ({ size = 20 }: { size?: number }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 18 18">
    <path d="M12.25 5.75V5C12.25 3.2051 10.795 1.75 9 1.75C7.205 1.75 5.75 3.2051 5.75 5V8C5.75 9.1534 6.35079 10.1665 7.25659 10.7433" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    <path d="M5.10901 12.891C3.67201 11.746 2.75 9.98 2.75 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    <path d="M15.25 8C15.25 11.452 12.452 14.25 8.99997 14.25C8.68107 14.25 8.36806 14.2262 8.06226 14.1802" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    <path d="M9 14.25V16.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    <path d="M2 16L16 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </svg>
)

const LeaveIcon = ({ size = 20 }: { size?: number }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 20 20">
    <path d="m17,6c0-1.195-.703-2.217-1.714-2.7l-2.993,2.993c-.188.188-.293.442-.293.707v6c0,.265.105.52.293.707l2.993,2.993c1.011-.483,1.714-1.505,1.714-2.7V6Z" strokeWidth="0" fill="currentColor" />
    <line x1="3" y1="10" x2="9" y2="10" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    <path d="m7.44,15.544c.526.869,1.47,1.456,2.56,1.456h4c1.657,0,3-1.343,3-3V6c0-1.657-1.343-3-3-3h-4c-1.089,0-2.033.585-2.558,1.453" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    <polyline points="5.75 7.5 3 10 5.75 12.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
  </svg>
)

const GridIcon = ({ size = 20 }: { size?: number }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 20 20">
    <rect x="12" y="3" width="5" height="7" rx="1" ry="1" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    <rect x="3" y="10" width="5" height="7" rx="1" ry="1" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    <rect x="2" y="2" width="7" height="5" rx="2" ry="2" fill="currentColor" strokeWidth="0" />
    <rect x="11" y="13" width="7" height="5" rx="2" ry="2" fill="currentColor" strokeWidth="0" />
  </svg>
)

const VideoIcon = ({ size = 20 }: { size?: number }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 18 18">
    <path d="M17.386,5.019c-.385-.227-.848-.234-1.238-.019l-2.148,1.181v5.637l2.147,1.181c.19,.105,.397,.157,.604,.157,.219,0,.438-.059,.635-.175,.385-.228,.614-.63,.614-1.077V6.096c0-.447-.229-.849-.614-1.077Z" fill="currentColor" />
    <path d="M9.75,3H3.75c-1.517,0-2.75,1.233-2.75,2.75v6.5c0,1.517,1.233,2.75,2.75,2.75h6c1.517,0,2.75-1.233,2.75-2.75V5.75c0-1.517-1.233-2.75-2.75-2.75Zm-4.75,5c-.552,0-1-.448-1-1s.448-1,1-1,1,.448,1,1-.448,1-1,1Z" fill="currentColor" />
  </svg>
)

const VideoOffIcon = ({ size = 20 }: { size?: number }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 18 18">
    <path d="M17.386,5.019c-.385-.227-.848-.234-1.238-.019l-2.148,1.181v5.637l2.147,1.181c.19,.105,.397,.157,.604,.157,.219,0,.438-.059,.635-.175,.385-.228,.614-.63,.614-1.077V6.096c0-.447-.229-.849-.614-1.077Z" fill="currentColor" />
    <path d="M9.75,3H3.75c-1.517,0-2.75,1.233-2.75,2.75v6.5c0,1.517,1.233,2.75,2.75,2.75h6c1.517,0,2.75-1.233,2.75-2.75V5.75c0-1.517-1.233-2.75-2.75-2.75Zm-4.75,5c-.552,0-1-.448-1-1s.448-1,1-1,1,.448,1,1-.448,1-1,1Z" fill="currentColor" />
    <path d="M2 16L16 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </svg>
)

const ScreenShareIcon = ({ size = 20 }: { size?: number }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 20 20">
    <path d="m17,10v-3c0-1.657-1.343-3-3-3H6c-1.657,0-3,1.343-3,3v3c0,1.657,1.343,3,3,3" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    <path d="m9.721,10.112l6.338,3.375c.406.216.317.821-.133.912l-2.956.598-1.295,2.723c-.197.415-.806.354-.917-.091l-1.742-6.966c-.103-.412.331-.751.705-.551Z" fill="currentColor" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
  </svg>
)

const ScreenShareOffIcon = ({ size = 20 }: { size?: number }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 20 20">
    <path d="m17,10v-3c0-1.657-1.343-3-3-3H6c-1.657,0-3,1.343-3,3v3c0,1.657,1.343,3,3,3" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    <path d="m9.721,10.112l6.338,3.375c.406.216.317.821-.133.912l-2.956.598-1.295,2.723c-.197.415-.806.354-.917-.091l-1.742-6.966c-.103-.412.331-.751.705-.551Z" fill="currentColor" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    <line x1="2" y1="18" x2="18" y2="2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const ImageIcon = ({ size = 20 }: { size?: number }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="14" height="14" rx="2" ry="2" />
    <circle cx="7.5" cy="7.5" r="1.25" fill="currentColor" stroke="none" />
    <path d="M17 13l-3.5-3.5L7 16" />
  </svg>
)

type LayoutMode = 'grid' | 'spotlight' | 'sidebar'

export function Room() {
  const { code } = useParams<{ code: string }>()
  const navigate = useNavigate()

  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isDark, setIsDark] = useState(true)
  const [rightPanelWidth, setRightPanelWidth] = useState(320)
  const [isResizing, setIsResizing] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [bottomPanelHeight, setBottomPanelHeight] = useState(200)
  const [isResizingVertical, setIsResizingVertical] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const rightPanelRef = useRef<HTMLDivElement>(null)
  const startXRef = useRef(0)
  const startWidthRef = useRef(0)
  const startYRef = useRef(0)
  const startHeightRef = useRef(0)

  const [layoutMode, setLayoutMode] = useState<LayoutMode>('grid')
  const [chatMessage, setChatMessage] = useState('')
  const [spotlightId, setSpotlightId] = useState<string | null>(null)
  const [showLeaveModal, setShowLeaveModal] = useState(false)
  const [hasSeenRoom, setHasSeenRoom] = useState(false)

  // Background-picker state (powered by the scraper action)
  const [showBgPicker, setShowBgPicker] = useState(false)
  const [bgSearchTerm, setBgSearchTerm] = useState('nature')
  const [bgUrls, setBgUrls] = useState<string[]>([])
  const [bgLoading, setBgLoading] = useState(false)
  const [bgError, setBgError] = useState<string | null>(null)
  const [bgSearched, setBgSearched] = useState(false)
  const [backgroundUrl, setBackgroundUrl] = useState<string | null>(
    () => localStorage.getItem('callBackgroundUrl')
  )
  const fetchBackgrounds = useAction(api.scraper.fetchBackgrounds)

  const handleFetchBackgrounds = async () => {
    setBgLoading(true)
    setBgError(null)
    try {
      const result = await fetchBackgrounds({ term: bgSearchTerm })
      setBgUrls(result.urls)
      setBgSearched(true)
    } catch (err) {
      setBgError(err instanceof Error ? err.message : 'Failed to fetch')
      setBgSearched(true)
    } finally {
      setBgLoading(false)
    }
  }

  const handlePickBackground = (url: string | null) => {
    setBackgroundUrl(url)
    if (url) {
      localStorage.setItem('callBackgroundUrl', url)
    } else {
      localStorage.removeItem('callBackgroundUrl')
    }
    setShowBgPicker(false)
  }

  // Join prompt state for direct URL navigation
  const [showJoinPrompt, setShowJoinPrompt] = useState(false)
  const [joinName, setJoinName] = useState('')
  const [hasJoined, setHasJoined] = useState(false)

  // Check if user needs to enter their name
  const storedUserName = localStorage.getItem('userName')
  const [userName, setUserName] = useState(storedUserName || '')
  const chatEndRef = useRef<HTMLDivElement>(null)

  // Show join prompt if no username is stored
  useEffect(() => {
    if (!storedUserName && !hasJoined) {
      setShowJoinPrompt(true)
    } else if (storedUserName) {
      setUserName(storedUserName)
      setHasJoined(true)
    }
  }, [storedUserName, hasJoined])

  // Handle join submission
  const handleJoinSubmit = () => {
    if (joinName.trim()) {
      localStorage.setItem('userName', joinName.trim())
      setUserName(joinName.trim())
      setShowJoinPrompt(false)
      setHasJoined(true)
    }
  }

  // Save current room code to localStorage for reconnection
  useEffect(() => {
    if (code && hasJoined) {
      localStorage.setItem('lastRoomCode', code)
    }
  }, [code, hasJoined])

  const room = useQuery(
    api.rooms.getRoomByCode,
    code ? { code: code.toUpperCase() } : 'skip'
  )

  const messages = useQuery(
    api.messages.getMessages,
    room ? { roomId: room._id } : 'skip'
  )

  const sendMessage = useMutation(api.messages.sendMessage)
  const leaveRoom = useMutation(api.rooms.leaveRoom)
  const deleteRoom = useMutation(api.rooms.deleteRoom)

  const {
    localStream,
    peers,
    isMuted,
    isVideoOff,
    isScreenSharing,
    peerId,
    toggleMute,
    toggleVideo,
    toggleScreenShare,
    participants,
  } = useWebRTC(hasJoined && room?._id ? room._id : null, userName)

  // Show active favicon when in a call
  useFavicon(!!room && !!localStream)

  // Track when we've seen a valid room
  useEffect(() => {
    if (room && !hasSeenRoom) {
      setHasSeenRoom(true)
    }
  }, [room, hasSeenRoom])

  // Detect room not found or deletion - redirect to home
  // room === null means query completed but room doesn't exist
  // room === undefined means still loading
  useEffect(() => {
    if (room === null) {
      // Room doesn't exist - redirect immediately
      navigate('/')
    }
  }, [room, navigate])

  // Cleanup on unmount - leave room if navigating away
  useEffect(() => {
    return () => {
      // Only leave if we have a peerId (meaning we joined)
      if (peerId) {
        leaveRoom({ peerId }).catch(() => {})
      }
    }
  }, [peerId, leaveRoom])

  // Find if current user is host
  const isHost = participants?.find(p => p.peerId === peerId)?.isHost ?? false

  // Detect mobile viewport
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    checkMobile()
    window.addEventListener("resize", checkMobile)
    return () => window.removeEventListener("resize", checkMobile)
  }, [])

  // Theme toggle with transition disable
  const handleThemeToggle = useCallback(() => {
    document.documentElement.classList.add("disable-transitions")
    setIsDark(prev => {
      const newValue = !prev
      if (newValue) {
        document.documentElement.classList.add("dark")
      } else {
        document.documentElement.classList.remove("dark")
      }
      localStorage.setItem('theme', newValue ? 'dark' : 'light')
      return newValue
    })
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        document.documentElement.classList.remove("disable-transitions")
      })
    })
  }, [])

  // Initialize theme on mount
  useEffect(() => {
    const saved = localStorage.getItem('theme')
    const dark = saved ? saved === 'dark' : true
    setIsDark(dark)
    if (dark) {
      document.documentElement.classList.add("dark")
    } else {
      document.documentElement.classList.remove("dark")
    }
  }, [])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    startXRef.current = e.clientX
    startWidthRef.current = rightPanelWidth
    document.body.style.cursor = "col-resize"
    document.body.style.userSelect = "none"
    setIsResizing(true)

    const handleMouseMove = (e: MouseEvent) => {
      const delta = startXRef.current - e.clientX
      const newWidth = startWidthRef.current + delta
      setRightPanelWidth(Math.max(280, Math.min(500, newWidth)))
    }

    const handleMouseUp = () => {
      document.body.style.cursor = ""
      document.body.style.userSelect = ""
      setIsResizing(false)
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
    }

    document.addEventListener("mousemove", handleMouseMove)
    document.addEventListener("mouseup", handleMouseUp)
  }, [rightPanelWidth])

  const handleVerticalMouseDown = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY
    startYRef.current = clientY
    startHeightRef.current = bottomPanelHeight
    document.body.style.cursor = "row-resize"
    document.body.style.userSelect = "none"
    setIsResizingVertical(true)

    const handleMove = (e: MouseEvent | TouchEvent) => {
      const currentY = "touches" in e ? e.touches[0].clientY : e.clientY
      const delta = startYRef.current - currentY
      const containerHeight = containerRef.current?.clientHeight || window.innerHeight
      const maxHeight = containerHeight * 0.35
      const newHeight = startHeightRef.current + delta
      setBottomPanelHeight(Math.max(160, Math.min(maxHeight, newHeight)))
    }

    const handleEnd = () => {
      document.body.style.cursor = ""
      document.body.style.userSelect = ""
      setIsResizingVertical(false)
      document.removeEventListener("mousemove", handleMove)
      document.removeEventListener("mouseup", handleEnd)
      document.removeEventListener("touchmove", handleMove)
      document.removeEventListener("touchend", handleEnd)
    }

    document.addEventListener("mousemove", handleMove)
    document.addEventListener("mouseup", handleEnd)
    document.addEventListener("touchmove", handleMove, { passive: false })
    document.addEventListener("touchend", handleEnd)
  }, [bottomPanelHeight])

  const handleOverlayClick = useCallback(() => {
    if (isMobile && sidebarOpen) {
      setSidebarOpen(false)
    }
  }, [isMobile, sidebarOpen])

  const cycleLayout = () => {
    const modes: LayoutMode[] = ['grid', 'spotlight', 'sidebar']
    const idx = modes.indexOf(layoutMode)
    setLayoutMode(modes[(idx + 1) % modes.length])
  }

  const handleLeaveClick = () => {
    if (isHost) {
      setShowLeaveModal(true)
    } else {
      // Clear the last room code since we're intentionally leaving
      localStorage.removeItem('lastRoomCode')
      leaveRoom({ peerId }).then(() => navigate('/'))
    }
  }

  const handleLeaveConfirm = async (deleteRoomFlag: boolean) => {
    setShowLeaveModal(false)
    // Clear the last room code since we're intentionally leaving
    localStorage.removeItem('lastRoomCode')
    if (deleteRoomFlag && room) {
      await deleteRoom({ roomId: room._id })
    } else {
      await leaveRoom({ peerId })
    }
    navigate('/')
  }

  const handleSendMessage = async () => {
    if (!chatMessage.trim() || !room) return
    await sendMessage({
      roomId: room._id,
      senderId: peerId,
      senderName: userName,
      content: chatMessage.trim(),
    })
    setChatMessage('')
  }

  // room === undefined means still loading, room === null means not found (will redirect)
  if (room === undefined || room === null) {
    return (
      <div className="h-screen w-full bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-foreground border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-muted-foreground">
            {room === null ? 'Room not found, redirecting...' : 'Loading room...'}
          </p>
        </div>
      </div>
    )
  }

  // Show join prompt if user needs to enter their name
  if (showJoinPrompt) {
    return (
      <div className="h-screen w-full bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-medium mb-2">Join Room</h1>
            <p className="text-muted-foreground text-sm">
              Joining: <span className="font-mono">{room.name}</span>
            </p>
            <p className="text-muted-foreground text-xs mt-1">
              Room Code: {code}
            </p>
          </div>

          <div className="space-y-4">
            <input
              type="text"
              placeholder="Enter your name"
              value={joinName}
              onChange={(e) => setJoinName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleJoinSubmit()}
              className="w-full px-4 py-3 bg-secondary rounded-lg outline-none focus:ring-2 ring-ring placeholder:text-muted-foreground"
              autoFocus
            />

            <button
              onClick={handleJoinSubmit}
              disabled={!joinName.trim()}
              className="w-full py-3 bg-foreground text-background rounded-full font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Join Room
            </button>

            <button
              onClick={() => navigate('/')}
              className="w-full py-2 text-muted-foreground text-sm hover:text-foreground transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Build video tiles array
  const tiles = [
    { id: 'local', stream: localStream, name: userName || 'You', isLocal: true, isMuted, isVideoOff, isScreenSharing },
    ...Array.from(peers.values()).map((p) => ({
      id: p.peerId,
      stream: p.stream || null,
      name: p.name,
      isLocal: false,
      isMuted: participants?.find(part => part.peerId === p.peerId)?.isMuted || false,
      isVideoOff: participants?.find(part => part.peerId === p.peerId)?.isVideoOff || false,
      isScreenSharing: false, // Remote users' screen share state would need to be tracked separately
    })),
  ]

  const tileCount = tiles.length

  // Calculate grid layout
  const getGridClass = () => {
    if (layoutMode === 'spotlight') return 'grid-cols-1'
    if (layoutMode === 'sidebar') return 'grid-cols-1'
    if (tileCount === 1) return 'grid-cols-1'
    if (tileCount === 2) return 'grid-cols-1 md:grid-cols-2'
    if (tileCount <= 4) return 'grid-cols-2'
    if (tileCount <= 6) return 'grid-cols-2 md:grid-cols-3'
    if (tileCount <= 9) return 'grid-cols-3'
    return 'grid-cols-3 md:grid-cols-4'
  }

  return (
    <div className="h-screen w-full bg-background flex overflow-hidden">
      {/* Background picker modal */}
      <AnimatePresence>
        {showBgPicker && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
            onClick={() => setShowBgPicker(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-card border border-border rounded-2xl p-6 max-w-2xl w-full shadow-xl max-h-[80vh] flex flex-col"
            >
              <div className="flex items-center gap-3 mb-4">
                <h2 className="text-lg font-medium">Pick a background</h2>
                <button
                  onClick={() => setShowBgPicker(false)}
                  className="ml-auto p-1 hover:bg-accent rounded-lg transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={bgSearchTerm}
                  onChange={(e) => setBgSearchTerm(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleFetchBackgrounds()
                  }}
                  placeholder="Search Unsplash (e.g. mountains, ocean)"
                  className="flex-1 px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-foreground/20"
                />
                <button
                  onClick={handleFetchBackgrounds}
                  disabled={bgLoading || !bgSearchTerm.trim()}
                  className="px-4 py-2 bg-foreground text-background rounded-lg font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {bgLoading ? 'Loading…' : 'Search'}
                </button>
              </div>

              {bgError && (
                <p className="text-sm text-red-500 mb-3">{bgError}</p>
              )}

              <div className="flex-1 overflow-y-auto">
                {bgLoading && bgUrls.length === 0 ? (
                  <p className="text-muted-foreground text-sm">Fetching backgrounds…</p>
                ) : bgUrls.length === 0 ? (
                  <p className="text-muted-foreground text-sm">
                    {bgSearched
                      ? `No images found for "${bgSearchTerm}". Try a different term.`
                      : 'Search a term above to load backgrounds.'}
                  </p>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {bgUrls.map((url) => (
                      <button
                        key={url}
                        onClick={() => handlePickBackground(url)}
                        className={cn(
                          "aspect-video rounded-lg overflow-hidden border-2 transition-colors",
                          backgroundUrl === url
                            ? "border-foreground"
                            : "border-transparent hover:border-muted-foreground"
                        )}
                      >
                        <img
                          src={url}
                          alt=""
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {backgroundUrl && (
                <button
                  onClick={() => handlePickBackground(null)}
                  className="mt-4 w-full py-2 bg-secondary text-foreground rounded-lg font-medium hover:bg-accent transition-colors"
                >
                  Clear background
                </button>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Leave confirmation modal for host */}
      <AnimatePresence>
        {showLeaveModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
            onClick={() => setShowLeaveModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-card border border-border rounded-2xl p-6 max-w-sm w-full shadow-xl"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-red-500/20 rounded-full">
                  <AlertTriangle className="text-red-500" size={24} />
                </div>
                <h2 className="text-lg font-medium">Leave Room?</h2>
                <button
                  onClick={() => setShowLeaveModal(false)}
                  className="ml-auto p-1 hover:bg-accent rounded-lg transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <p className="text-muted-foreground text-sm mb-6">
                You are the host of this room. What would you like to do?
              </p>

              <div className="space-y-2">
                <button
                  onClick={() => handleLeaveConfirm(true)}
                  className="w-full py-3 bg-red-500 text-white rounded-xl font-medium hover:bg-red-600 transition-colors"
                >
                  End Room for Everyone
                </button>
                <button
                  onClick={() => handleLeaveConfirm(false)}
                  className="w-full py-3 bg-secondary text-foreground rounded-xl font-medium hover:bg-accent transition-colors"
                >
                  Leave (Keep Room Open)
                </button>
                <button
                  onClick={() => setShowLeaveModal(false)}
                  className="w-full py-2 text-muted-foreground text-sm hover:text-foreground transition-colors"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile sheet overlay backdrop */}
      <AnimatePresence>
        {isMobile && sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/50 z-30"
            onClick={handleOverlayClick}
            aria-hidden="true"
          />
        )}
      </AnimatePresence>

      {/* Mobile bottom sheet */}
      <AnimatePresence>
        {isMobile && sidebarOpen && (
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
            className={cn(
              "fixed left-0 right-0 bottom-0 z-40",
              "bg-card border-t border-x border-border rounded-t-2xl shadow-lg",
              "flex flex-col"
            )}
            style={{ height: "60%" }}
          >
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 rounded-full bg-border" />
            </div>
            <div className="flex items-center justify-end px-4 pb-2">
              <button
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "rounded-lg hover:bg-accent active:scale-95",
                  "transition-colors duration-150 text-foreground"
                )}
                style={{ padding: 8 }}
                aria-label="Close menu"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-auto px-4 pb-4">
              {/* Mobile Member List */}
              {participants && participants.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs text-muted-foreground uppercase tracking-wider">
                    In Call · {participants.length} {participants.length === 1 ? 'Member' : 'Members'}
                  </div>
                  {participants.map((p) => (
                    <div
                      key={p.peerId}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/50 transition-colors"
                    >
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-medium ${
                          ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-orange-500', 'bg-pink-500'][
                            Math.abs(p.name.split('').reduce((a, b) => a + b.charCodeAt(0), 0)) % 5
                          ]
                        }`}
                      >
                        {p.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">
                          {p.name}
                          {p.peerId === peerId && <span className="text-muted-foreground"> (You)</span>}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {p.isHost ? 'Host' : 'Participant'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Desktop sidebar */}
      {!isMobile && <Sidebar isOpen={sidebarOpen} participants={participants} currentPeerId={peerId} roomCode={code} />}

      {/* Main container wrapper */}
      <motion.div
        ref={containerRef}
        className={cn("flex-1 h-full", isMobile ? "flex flex-col" : "flex")}
        style={{ padding: isMobile ? 16 : 24, gap: isMobile ? 8 : 4 }}
        animate={{ marginLeft: !isMobile && sidebarOpen ? 72 : 0 }}
        transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
      >
        {/* Main rounded container - Video Grid */}
        <div
          className={cn(
            "bg-card rounded-2xl border border-border overflow-hidden relative",
            isMobile ? "min-h-0" : "flex-1"
          )}
          style={{
            ...(isMobile ? { flex: 1 } : {}),
            ...(backgroundUrl
              ? {
                  backgroundImage: `url(${backgroundUrl})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }
              : {}),
          }}
        >
          <div className={cn("h-full flex flex-col")} style={{ padding: 16 }}>
            {/* Header */}
            <div className="flex items-center" style={{ height: 40, marginBottom: 12, gap: 8 }}>
              <div className="flex items-center gap-1 bg-secondary/50 rounded-full p-1">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className={cn(
                  "rounded-full hover:bg-accent active:scale-95",
                  "transition-colors duration-150 text-foreground"
                )}
                style={{ padding: 8 }}
                aria-label="Toggle sidebar"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20">
                  <g>
                    <rect x="1" y="5" width="14" height="10" rx="1.5" ry="1.5" transform="translate(-2 18) rotate(-90)" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" fill="currentColor" />
                    <line x1="17" y1="15" x2="17" y2="5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                  </g>
                </svg>
              </button>

              <button
                onClick={handleThemeToggle}
                className={cn(
                  "rounded-full hover:bg-accent active:scale-95",
                  "transition-colors duration-150 text-foreground"
                )}
                style={{ padding: 8 }}
                aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
              >
                {isDark ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="5" />
                    <line x1="12" y1="1" x2="12" y2="3" />
                    <line x1="12" y1="21" x2="12" y2="23" />
                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                    <line x1="1" y1="12" x2="3" y2="12" />
                    <line x1="21" y1="12" x2="23" y2="12" />
                    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                  </svg>
                )}
              </button>

              <button
                onClick={cycleLayout}
                className={cn(
                  "rounded-full hover:bg-accent active:scale-95",
                  "transition-colors duration-150 text-foreground"
                )}
                style={{ padding: 8 }}
                title={`Layout: ${layoutMode}`}
              >
                <GridIcon size={20} />
              </button>

              <button
                onClick={() => {
                  setShowBgPicker(true)
                  if (bgUrls.length === 0) handleFetchBackgrounds()
                }}
                className={cn(
                  "rounded-full hover:bg-accent active:scale-95",
                  "transition-colors duration-150 text-foreground"
                )}
                style={{ padding: 8 }}
                title="Change background"
              >
                <ImageIcon size={20} />
              </button>
              </div>

              <div className="flex-1" />
            </div>

            {/* Video Grid */}
            <div className="flex-1 min-h-0 overflow-hidden">
              {layoutMode === 'spotlight' ? (
                <div className="h-full flex flex-col gap-2">
                  <div className="flex-1 min-h-0">
                    <VideoTile
                      tile={tiles.find(t => t.id === (spotlightId || 'local')) || tiles[0]}
                      className="h-full"
                    />
                  </div>
                  {tiles.length > 1 && (
                    <div className="flex gap-2 overflow-x-auto py-2 scrollbar-hide">
                      {tiles.map((tile) => (
                        <button
                          key={tile.id}
                          onClick={() => setSpotlightId(tile.id)}
                          className={`shrink-0 w-24 h-16 md:w-32 md:h-20 rounded-lg overflow-hidden border-2 transition-colors ${
                            (spotlightId || 'local') === tile.id
                              ? 'border-foreground'
                              : 'border-transparent hover:border-muted-foreground'
                          }`}
                        >
                          <VideoTile tile={tile} className="h-full" compact />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : layoutMode === 'sidebar' ? (
                <div className="h-full grid grid-cols-[1fr] md:grid-cols-[1fr_180px] gap-2">
                  <div className="h-full min-h-0">
                    <VideoTile
                      tile={tiles.find(t => t.id === (spotlightId || 'local')) || tiles[0]}
                      className="h-full"
                    />
                  </div>
                  {tiles.length > 1 && (
                    <div className="hidden md:flex flex-col gap-2 overflow-y-auto scrollbar-hide">
                      {tiles.filter(t => t.id !== (spotlightId || 'local')).map((tile) => (
                        <button
                          key={tile.id}
                          onClick={() => setSpotlightId(tile.id)}
                          className="aspect-video rounded-lg overflow-hidden hover:ring-2 ring-muted-foreground transition-all"
                        >
                          <VideoTile tile={tile} className="h-full" compact />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className={`grid ${getGridClass()} gap-2 h-full auto-rows-fr`}>
                  {tiles.map((tile) => (
                    <VideoTile key={tile.id} tile={tile} />
                  ))}
                </div>
              )}
            </div>

            {/* Bottom bar - Controls */}
            <div className="flex items-center justify-center gap-3" style={{ height: 56, marginTop: 12 }}>
              <button
                onClick={toggleMute}
                className={`p-3 rounded-full transition-colors ${
                  isMuted ? 'bg-red-500 text-white' : 'bg-secondary hover:bg-accent'
                }`}
                title={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted ? <MicOffIcon size={20} /> : <MicIcon size={20} />}
              </button>

              <button
                onClick={toggleVideo}
                className={`p-3 rounded-full transition-colors ${
                  isVideoOff ? 'bg-red-500 text-white' : 'bg-secondary hover:bg-accent'
                }`}
                title={isVideoOff ? 'Turn on camera' : 'Turn off camera'}
              >
                {isVideoOff ? <VideoOffIcon size={20} /> : <VideoIcon size={20} />}
              </button>

              {!isMobile && (
                <button
                  onClick={toggleScreenShare}
                  className={`p-3 rounded-full transition-colors ${
                    isScreenSharing ? 'bg-green-500 text-white' : 'bg-secondary hover:bg-accent'
                  }`}
                  title={isScreenSharing ? 'Stop sharing' : 'Share screen'}
                >
                  {isScreenSharing ? <ScreenShareOffIcon size={20} /> : <ScreenShareIcon size={20} />}
                </button>
              )}

              <button
                onClick={handleLeaveClick}
                className="p-3 rounded-full bg-red-500 text-white hover:bg-red-600 transition-colors"
                title="Leave call"
              >
                <LeaveIcon size={20} />
              </button>
            </div>
          </div>
        </div>

        {/* Resize handle */}
        {!isMobile ? (
          <div
            onMouseDown={handleMouseDown}
            className={cn(
              "w-4 cursor-col-resize touch-none select-none",
              "flex items-center justify-center group -mx-1.5"
            )}
            role="separator"
          >
            <div className={cn(
              "w-1 h-8 rounded-full bg-border group-hover:bg-muted-foreground transition-colors duration-150",
              isResizing && "bg-muted-foreground"
            )} />
          </div>
        ) : (
          <div
            onMouseDown={handleVerticalMouseDown}
            onTouchStart={handleVerticalMouseDown}
            className={cn(
              "h-6 cursor-row-resize touch-none select-none",
              "flex items-center justify-center group -my-2.5 z-10"
            )}
            role="separator"
          >
            <div className={cn(
              "h-1 w-8 rounded-full bg-border group-hover:bg-muted-foreground transition-colors duration-150",
              isResizingVertical && "bg-muted-foreground"
            )} />
          </div>
        )}

        {/* Right/Bottom panel - Chat */}
        <div
          ref={rightPanelRef}
          style={isMobile ? { height: bottomPanelHeight } : { width: rightPanelWidth }}
          className={cn(
            "bg-card rounded-2xl border border-border overflow-hidden flex-shrink-0"
          )}
        >
          <div className={cn("h-full w-full flex flex-col")} style={{ padding: 16 }}>
            {/* Chat header */}
            <div className="flex items-center" style={{ height: 40, marginBottom: 12 }}>
              <span className="font-medium">Chat</span>
            </div>

            {/* Chat messages */}
            <div className="flex-1 overflow-y-auto space-y-3 scrollbar-hide">
              {messages?.map((msg) => (
                <div key={msg._id} className={msg.senderId === peerId ? 'text-right' : ''}>
                  <div className="text-xs text-muted-foreground mb-1">
                    {msg.senderName}
                  </div>
                  <div
                    className={`inline-block px-3 py-2 rounded-xl max-w-[80%] text-sm ${
                      msg.senderId === peerId
                        ? 'bg-foreground text-background'
                        : 'bg-secondary'
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            {/* Chat input */}
            <div className="flex gap-2" style={{ marginTop: 12 }}>
              <input
                type="text"
                value={chatMessage}
                onChange={(e) => setChatMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="Type a message..."
                className="flex-1 px-3 py-2 bg-secondary rounded-xl outline-none focus:ring-2 ring-ring text-sm"
              />
              <button
                onClick={handleSendMessage}
                className="p-2 bg-foreground text-background rounded-xl hover:opacity-90 transition-opacity"
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

interface VideoTileProps {
  tile: {
    id: string
    stream: MediaStream | null
    name: string
    isLocal: boolean
    isMuted: boolean
    isVideoOff: boolean
    isScreenSharing?: boolean
  }
  className?: string
  compact?: boolean
}

function VideoTile({ tile, className = '', compact = false }: VideoTileProps) {
  // Ref callback that attaches the stream to the <video> element the moment it
  // mounts in the DOM. Using a callback ref (rather than useRef + useEffect)
  // guarantees attachment happens synchronously when the element appears,
  // avoiding ordering issues where useEffect might run before the element is
  // mounted or skip when its deps appear unchanged.
  const setVideoRef = useCallback((el: HTMLVideoElement | null) => {
    if (!el) return
    if (!tile.stream) {
      el.srcObject = null
      return
    }
    if (el.srcObject !== tile.stream) {
      el.srcObject = tile.stream
    }
    const attempt = el.play()
    if (attempt && typeof attempt.catch === 'function') {
      attempt.catch(() => {
        // Autoplay-with-sound blocked. Retry muted; remote tile only.
        if (!tile.isLocal) {
          el.muted = true
          el.play().then(() => {
            setTimeout(() => {
              if (el.isConnected) el.muted = false
            }, 200)
          }).catch(() => { /* user gesture required */ })
        }
      })
    }
  }, [tile.stream, tile.isLocal])

  const shouldMirror = tile.isLocal && !tile.isScreenSharing
  const hasVideoTrack = !!tile.stream && tile.stream.getVideoTracks().length > 0
  const showVideo = hasVideoTrack && !tile.isVideoOff

  return (
    <div className={`relative bg-secondary rounded-xl overflow-hidden ${className}`}>
      <video
        ref={setVideoRef}
        autoPlay
        playsInline
        muted={tile.isLocal}
        className={`w-full h-full object-contain ${shouldMirror ? 'scale-x-[-1]' : ''} ${showVideo ? '' : 'invisible'}`}
      />
      {!showVideo && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted">
          <div
            className={`rounded-full bg-secondary flex items-center justify-center font-medium ${
              compact ? 'w-8 h-8 text-sm' : 'w-16 h-16 text-xl'
            }`}
          >
            {tile.name.charAt(0).toUpperCase()}
          </div>
        </div>
      )}

      {/* Name tag */}
      <div
        className={`absolute bottom-2 left-2 px-2 py-1 bg-black/60 rounded text-white flex items-center gap-1 ${
          compact ? 'text-xs' : 'text-sm'
        }`}
      >
        {tile.isMuted && <MicOffIcon size={compact ? 10 : 12} />}
        {tile.isScreenSharing && <ScreenShareIcon size={compact ? 10 : 12} />}
        <span className="truncate max-w-[100px]">
          {tile.name}
          {tile.isLocal && ' (You)'}
        </span>
      </div>
    </div>
  )
}
