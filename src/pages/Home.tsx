import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { Sun, Moon, Lock, Hash, ArrowRight, Mic, MicOff, Video, VideoOff, MessageSquare, Monitor, Settings, KeyRound, Eye, EyeOff } from 'lucide-react'

// Custom icons
const CameraIcon = ({ size = 20 }: { size?: number }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 18 18">
    <path d="M12.25,8l4.259-2.342c.333-.183,.741,.058,.741,.438v5.809c0,.38-.408,.621-.741,.438l-4.259-2.342" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
    <rect x="1.75" y="3.75" width="10.5" height="10.5" rx="2" ry="2" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
    <circle cx="4.75" cy="6.75" r=".75" fill="currentColor" />
  </svg>
)

const PeopleIcon = ({ size = 20 }: { size?: number }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 20 20">
    <circle cx="6.5" cy="8.5" r="2.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    <circle cx="13.5" cy="5.5" r="2.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    <path d="m10.875,11.845c.739-.532,1.645-.845,2.625-.845,1.959,0,3.626,1.252,4.244,3" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    <path d="m2.256,17c.618-1.748,2.285-3,4.244-3s3.626,1.252,4.244,3" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
  </svg>
)

type Mode = 'initial' | 'create' | 'join'

export function Home() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<Mode>('initial')
  const [isDark, setIsDark] = useState(true)

  // Create room state
  const [roomName, setRoomName] = useState('')
  const [maxParticipants, setMaxParticipants] = useState(8)
  const [isLocked, setIsLocked] = useState(false)
  const [userName, setUserName] = useState('')
  const [createStartMuted, setCreateStartMuted] = useState(false)
  const [createStartVideoOff, setCreateStartVideoOff] = useState(false)
  // Room settings
  const [roomPassword, setRoomPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [allowChat, setAllowChat] = useState(true)
  const [allowScreenShare, setAllowScreenShare] = useState(true)

  // Join room state
  const [roomCode, setRoomCode] = useState('')
  const [joinName, setJoinName] = useState('')
  const [joinStartMuted, setJoinStartMuted] = useState(false)
  const [joinStartVideoOff, setJoinStartVideoOff] = useState(false)
  const [joinPassword, setJoinPassword] = useState('')
  const [showJoinPassword, setShowJoinPassword] = useState(false)
  const [error, setError] = useState('')

  const createRoom = useMutation(api.rooms.createRoom)
  // Room code format: XXXX-XXXX-XXXX (14 chars with dashes)
  const isValidRoomCode = roomCode.length === 14 && /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(roomCode)
  const roomByCode = useQuery(
    api.rooms.getRoomByCode,
    mode === 'join' && isValidRoomCode ? { code: roomCode.toUpperCase() } : 'skip'
  )

  useEffect(() => {
    const saved = localStorage.getItem('theme')
    const dark = saved ? saved === 'dark' : true
    setIsDark(dark)
    document.documentElement.classList.toggle('dark', dark)
  }, [])

  const toggleTheme = () => {
    const newDark = !isDark
    setIsDark(newDark)
    document.documentElement.classList.toggle('dark', newDark)
    localStorage.setItem('theme', newDark ? 'dark' : 'light')
  }

  const handleCreate = async () => {
    if (!roomName.trim() || !userName.trim()) {
      setError('Please fill in all fields')
      return
    }

    try {
      const result = await createRoom({
        name: roomName.trim(),
        maxParticipants,
        isLocked,
        password: roomPassword.trim() || undefined,
        allowChat,
        allowScreenShare,
      })

      localStorage.setItem('userName', userName.trim())
      localStorage.setItem('startMuted', createStartMuted.toString())
      localStorage.setItem('startVideoOff', createStartVideoOff.toString())
      navigate(`/room/${result.code}`)
    } catch {
      setError('Failed to create room')
    }
  }

  const verifyPassword = useQuery(
    api.rooms.verifyRoomPassword,
    mode === 'join' && isValidRoomCode && roomByCode?.hasPassword && joinPassword
      ? { code: roomCode.toUpperCase(), password: joinPassword }
      : 'skip'
  )

  const handleJoin = () => {
    if (!roomCode.trim() || !joinName.trim()) {
      setError('Please fill in all fields')
      return
    }

    if (!isValidRoomCode) {
      setError('Room code must be in format XXXX-XXXX-XXXX')
      return
    }

    if (!roomByCode) {
      setError('Room not found')
      return
    }

    // Check password if room is password-protected
    if (roomByCode.hasPassword) {
      if (!joinPassword) {
        setError('This room requires a password')
        return
      }
      if (!verifyPassword?.valid) {
        setError('Incorrect password')
        return
      }
    }

    localStorage.setItem('userName', joinName.trim())
    localStorage.setItem('startMuted', joinStartMuted.toString())
    localStorage.setItem('startVideoOff', joinStartVideoOff.toString())
    navigate(`/room/${roomCode.toUpperCase()}`)
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      {/* Theme toggle */}
      <button
        onClick={toggleTheme}
        className="fixed top-4 right-4 p-2 rounded-lg bg-secondary hover:bg-accent transition-colors"
        aria-label="Toggle theme"
      >
        {isDark ? <Sun size={20} /> : <Moon size={20} />}
      </button>

      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 18 18" className="text-foreground">
              <path d="M17.386,5.019c-.385-.227-.848-.234-1.238-.019l-2.148,1.181v5.637l2.147,1.181c.19,.105,.397,.157,.604,.157,.219,0,.438-.059,.635-.175,.385-.228,.614-.63,.614-1.077V6.096c0-.447-.229-.849-.614-1.077Z" fill="currentColor" />
              <path d="M9.75,3H3.75c-1.517,0-2.75,1.233-2.75,2.75v6.5c0,1.517,1.233,2.75,2.75,2.75h6c1.517,0,2.75-1.233,2.75-2.75V5.75c0-1.517-1.233-2.75-2.75-2.75Zm-4.75,5c-.552,0-1-.448-1-1s.448-1,1-1,1,.448,1,1-.448,1-1,1Z" fill="currentColor" />
            </svg>
            <h1 className="text-2xl font-medium">Lync</h1>
            <span className="px-2 py-0.5 text-xs bg-secondary rounded-full text-muted-foreground">
              BETA
            </span>
          </div>
          <p className="text-muted-foreground text-sm">
            No BS video calls
          </p>
        </div>

        {/* Initial options */}
        {mode === 'initial' && (
          <div className="space-y-3">
            <button
              onClick={() => setMode('create')}
              className="w-full p-4 bg-secondary hover:bg-accent rounded-lg flex items-center justify-between transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-background rounded-lg">
                  <CameraIcon size={20} />
                </div>
                <div className="text-left">
                  <div className="font-medium">Create Room</div>
                  <div className="text-sm text-muted-foreground">Start a new video call</div>
                </div>
              </div>
              <ArrowRight size={20} className="text-muted-foreground group-hover:translate-x-1 transition-transform" />
            </button>

            <button
              onClick={() => setMode('join')}
              className="w-full p-4 bg-secondary hover:bg-accent rounded-lg flex items-center justify-between transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-background rounded-lg">
                  <PeopleIcon size={20} />
                </div>
                <div className="text-left">
                  <div className="font-medium">Join Room</div>
                  <div className="text-sm text-muted-foreground">Enter a room code</div>
                </div>
              </div>
              <ArrowRight size={20} className="text-muted-foreground group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        )}

        {/* Create room form */}
        {mode === 'create' && (
          <div className="space-y-4">
            <button
              onClick={() => { setMode('initial'); setError('') }}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              ← Back
            </button>

            <div className="space-y-3">
              <input
                type="text"
                placeholder="Room name"
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                className="w-full px-4 py-3 bg-secondary rounded-lg outline-none focus:ring-2 ring-ring placeholder:text-muted-foreground"
              />

              {/* Your settings (name and media) */}
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground uppercase tracking-wider">Your Settings</label>
                <input
                  type="text"
                  placeholder="Your name"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  className="w-full px-4 py-3 bg-secondary rounded-lg outline-none focus:ring-2 ring-ring placeholder:text-muted-foreground"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setCreateStartMuted(!createStartMuted)}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg transition-colors ${
                      createStartMuted
                        ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                        : 'bg-secondary hover:bg-accent border border-transparent'
                    }`}
                  >
                    <div className="w-[18px] flex justify-center">
                      {createStartMuted ? <MicOff size={18} /> : <Mic size={18} />}
                    </div>
                    <span className="text-sm w-16 text-center">{createStartMuted ? 'Muted' : 'Mic On'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreateStartVideoOff(!createStartVideoOff)}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg transition-colors ${
                      createStartVideoOff
                        ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                        : 'bg-secondary hover:bg-accent border border-transparent'
                    }`}
                  >
                    <div className="w-[18px] flex justify-center">
                      {createStartVideoOff ? <VideoOff size={18} /> : <Video size={18} />}
                    </div>
                    <span className="text-sm w-16 text-center">{createStartVideoOff ? 'Cam Off' : 'Cam On'}</span>
                  </button>
                </div>
              </div>

              {/* Room settings */}
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                  <Settings size={12} />
                  Room Settings
                </label>

                {/* Password protection */}
                <div className="relative">
                  <KeyRound size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Room password (optional)"
                    value={roomPassword}
                    onChange={(e) => setRoomPassword(e.target.value)}
                    className="w-full pl-10 pr-10 py-3 bg-secondary rounded-lg outline-none focus:ring-2 ring-ring placeholder:text-muted-foreground"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAllowChat(!allowChat)}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-left transition-colors ${
                      allowChat
                        ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                        : 'bg-secondary hover:bg-accent border border-transparent text-muted-foreground'
                    }`}
                  >
                    <MessageSquare size={16} />
                    <span className="text-xs">{allowChat ? 'Chat On' : 'Chat Off'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAllowScreenShare(!allowScreenShare)}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-left transition-colors ${
                      allowScreenShare
                        ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                        : 'bg-secondary hover:bg-accent border border-transparent text-muted-foreground'
                    }`}
                  >
                    <Monitor size={16} />
                    <span className="text-xs">{allowScreenShare ? 'Screen Share On' : 'Screen Share Off'}</span>
                  </button>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-sm text-muted-foreground mb-1 block">Max participants</label>
                  <select
                    value={maxParticipants}
                    onChange={(e) => setMaxParticipants(Number(e.target.value))}
                    className="w-full px-4 py-3 bg-secondary rounded-lg outline-none focus:ring-2 ring-ring"
                  >
                    {[2, 4, 6, 8, 10, 12, 16].map((n) => (
                      <option key={n} value={n}>{n} people</option>
                    ))}
                  </select>
                </div>

                <div className="flex-1">
                  <label className="text-sm text-muted-foreground mb-1 block">Room access</label>
                  <button
                    onClick={() => setIsLocked(!isLocked)}
                    className={`w-full px-4 py-3 rounded-lg flex items-center justify-center gap-2 transition-colors ${
                      isLocked ? 'bg-primary text-primary-foreground' : 'bg-secondary'
                    }`}
                  >
                    <Lock size={16} />
                    {isLocked ? 'Locked' : 'Open'}
                  </button>
                </div>
              </div>
            </div>

            {error && (
              <p className="text-red-400 text-sm">{error}</p>
            )}

            <button
              onClick={handleCreate}
              className="w-full py-3 bg-foreground text-background rounded-full font-medium hover:opacity-90 transition-opacity"
            >
              Create Room
            </button>
          </div>
        )}

        {/* Join room form */}
        {mode === 'join' && (
          <div className="space-y-4">
            <button
              onClick={() => { setMode('initial'); setError('') }}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              ← Back
            </button>

            <div className="space-y-3">
              <input
                type="text"
                placeholder="Your name"
                value={joinName}
                onChange={(e) => setJoinName(e.target.value)}
                className="w-full px-4 py-3 bg-secondary rounded-lg outline-none focus:ring-2 ring-ring placeholder:text-muted-foreground"
              />

              <div className="relative">
                <Hash size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="XXXX-XXXX-XXXX"
                  value={roomCode}
                  onChange={(e) => {
                    // Remove non-alphanumeric characters and convert to uppercase
                    let value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '')
                    // Limit to 12 characters (without dashes)
                    value = value.slice(0, 12)
                    // Add dashes: XXXX-XXXX-XXXX
                    if (value.length > 4) {
                      value = value.slice(0, 4) + '-' + value.slice(4)
                    }
                    if (value.length > 9) {
                      value = value.slice(0, 9) + '-' + value.slice(9)
                    }
                    setRoomCode(value)
                  }}
                  className="w-full pl-10 pr-4 py-3 bg-secondary rounded-lg outline-none focus:ring-2 ring-ring placeholder:text-muted-foreground uppercase tracking-widest"
                />
              </div>

              {/* Media toggles */}
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground uppercase tracking-wider">Your Settings</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setJoinStartMuted(!joinStartMuted)}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg transition-colors ${
                      joinStartMuted
                        ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                        : 'bg-secondary hover:bg-accent border border-transparent'
                    }`}
                  >
                    <div className="w-[18px] flex justify-center">
                      {joinStartMuted ? <MicOff size={18} /> : <Mic size={18} />}
                    </div>
                    <span className="text-sm w-16 text-center">{joinStartMuted ? 'Muted' : 'Mic On'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setJoinStartVideoOff(!joinStartVideoOff)}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg transition-colors ${
                      joinStartVideoOff
                        ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                        : 'bg-secondary hover:bg-accent border border-transparent'
                    }`}
                  >
                    <div className="w-[18px] flex justify-center">
                      {joinStartVideoOff ? <VideoOff size={18} /> : <Video size={18} />}
                    </div>
                    <span className="text-sm w-16 text-center">{joinStartVideoOff ? 'Cam Off' : 'Cam On'}</span>
                  </button>
                </div>
              </div>

              {isValidRoomCode && roomByCode && (
                <div className="space-y-3">
                  <div className="p-3 bg-secondary rounded-lg flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-400 rounded-full" />
                    <span className="text-sm">{roomByCode.name}</span>
                    {roomByCode.hasPassword && (
                      <Lock size={14} className="text-yellow-400" />
                    )}
                    <span className="text-xs text-muted-foreground ml-auto">
                      {roomByCode.maxParticipants} max
                    </span>
                  </div>

                  {/* Password input if room is protected */}
                  {roomByCode.hasPassword && (
                    <div className="relative">
                      <KeyRound size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <input
                        type={showJoinPassword ? 'text' : 'password'}
                        placeholder="Enter room password"
                        value={joinPassword}
                        onChange={(e) => setJoinPassword(e.target.value)}
                        className="w-full pl-10 pr-10 py-3 bg-secondary rounded-lg outline-none focus:ring-2 ring-ring placeholder:text-muted-foreground"
                      />
                      <button
                        type="button"
                        onClick={() => setShowJoinPassword(!showJoinPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showJoinPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {isValidRoomCode && roomByCode === null && (
                <p className="text-red-400 text-sm">Room not found</p>
              )}
            </div>

            {error && (
              <p className="text-red-400 text-sm">{error}</p>
            )}

            <button
              onClick={handleJoin}
              disabled={!roomByCode}
              className="w-full py-3 bg-foreground text-background rounded-full font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Join Room
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
