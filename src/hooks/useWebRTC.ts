import { useEffect, useRef, useState, useCallback } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'

interface PeerConnection {
  peerId: string
  pc: RTCPeerConnection
  stream?: MediaStream
  name: string
}

// Get or create a persistent peerId for this browser session
function getOrCreatePeerId(): string {
  const storageKey = 'lync-peer-id'
  let id = sessionStorage.getItem(storageKey)
  if (!id) {
    id = crypto.randomUUID()
    sessionStorage.setItem(storageKey, id)
  }
  return id
}

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  // Free TURN servers
  {
    urls: 'turn:a.relay.metered.ca:80',
    username: 'e8dd65b92c62d5e82c2f018a',
    credential: 'uWdWNmkhvyqTEj3B',
  },
  {
    urls: 'turn:a.relay.metered.ca:443',
    username: 'e8dd65b92c62d5e82c2f018a',
    credential: 'uWdWNmkhvyqTEj3B',
  },
  {
    urls: 'turn:a.relay.metered.ca:443?transport=tcp',
    username: 'e8dd65b92c62d5e82c2f018a',
    credential: 'uWdWNmkhvyqTEj3B',
  },
]

// Client-side signal TTL (30 seconds) - signals older than this are ignored
const SIGNAL_TTL_MS = 30 * 1000

export function useWebRTC(roomId: Id<"rooms"> | null, userName: string) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null)
  const [peers, setPeers] = useState<Map<string, PeerConnection>>(new Map())
  const [isMuted, setIsMuted] = useState(false)
  const [isVideoOff, setIsVideoOff] = useState(false)
  const [isScreenSharing, setIsScreenSharing] = useState(false)
  const [peerId] = useState(getOrCreatePeerId)
  const [isReady, setIsReady] = useState(false)

  const peersRef = useRef<Map<string, PeerConnection>>(new Map())
  const localStreamRef = useRef<MediaStream | null>(null)
  const screenStreamRef = useRef<MediaStream | null>(null)
  const originalVideoTrackRef = useRef<MediaStreamTrack | null>(null)
  const processedSignalsRef = useRef<Set<string>>(new Set())
  const mountedRef = useRef(true)
  const pendingCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map())
  const hasJoinedRef = useRef(false)
  const iceBatchRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map())
  const iceBatchTimerRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const joinRoom = useMutation(api.rooms.joinRoom)
  const leaveRoom = useMutation(api.rooms.leaveRoom)
  const heartbeat = useMutation(api.rooms.heartbeat)
  const sendSignal = useMutation(api.signals.sendSignal)
  const consumeSignals = useMutation(api.signals.consumeSignals)
  const cleanupStaleSignals = useMutation(api.signals.cleanupStaleSignals)
  const updateParticipant = useMutation(api.rooms.updateParticipant)

  const participants = useQuery(
    api.rooms.getParticipants,
    roomId ? { roomId } : 'skip'
  )

  const signals = useQuery(
    api.signals.getSignals,
    { peerId }
  )

  const syncPeers = useCallback(() => {
    if (mountedRef.current) {
      setPeers(new Map(peersRef.current))
    }
  }, [])

  // Initialize local media
  const initStream = useCallback(async () => {
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)

    // Read user preferences from localStorage
    const startMuted = localStorage.getItem('startMuted') === 'true'
    const startVideoOff = localStorage.getItem('startVideoOff') === 'true'

    // Clear the preferences after reading (one-time use)
    localStorage.removeItem('startMuted')
    localStorage.removeItem('startVideoOff')

    const videoConstraints: MediaTrackConstraints = isMobile
      ? { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }
      : { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }

    const audioConstraints: MediaTrackConstraints = {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    }

    // Helper to apply user preferences to the stream
    const applyPreferences = (stream: MediaStream) => {
      if (startMuted) {
        const audioTrack = stream.getAudioTracks()[0]
        if (audioTrack) {
          audioTrack.enabled = false
          setIsMuted(true)
        }
      }
      if (startVideoOff) {
        const videoTrack = stream.getVideoTracks()[0]
        if (videoTrack) {
          videoTrack.enabled = false
          setIsVideoOff(true)
        }
      }
    }

    // Try video + audio
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: videoConstraints,
        audio: audioConstraints,
      })
      if (!mountedRef.current) {
        stream.getTracks().forEach(t => t.stop())
        return null
      }
      setLocalStream(stream)
      localStreamRef.current = stream
      applyPreferences(stream)
      return stream
    } catch {
      // Video+audio failed, try fallbacks
    }

    // Try video only
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: videoConstraints, audio: false })
      if (!mountedRef.current) {
        stream.getTracks().forEach(t => t.stop())
        return null
      }
      setLocalStream(stream)
      localStreamRef.current = stream
      setIsMuted(true)
      if (startVideoOff) {
        const videoTrack = stream.getVideoTracks()[0]
        if (videoTrack) {
          videoTrack.enabled = false
          setIsVideoOff(true)
        }
      }
      return stream
    } catch {
      // Video-only failed
    }

    // Try audio only
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints, video: false })
      if (!mountedRef.current) {
        stream.getTracks().forEach(t => t.stop())
        return null
      }
      setLocalStream(stream)
      localStreamRef.current = stream
      setIsVideoOff(true)
      if (startMuted) {
        const audioTrack = stream.getAudioTracks()[0]
        if (audioTrack) {
          audioTrack.enabled = false
          setIsMuted(true)
        }
      }
      return stream
    } catch {
      // Audio-only failed
    }

    return null
  }, [])

  // Create peer connection
  const createPeerConnection = useCallback((targetId: string, targetName: string, isInitiator: boolean) => {
    if (!roomId) return null
    if (peersRef.current.has(targetId)) {
      return peersRef.current.get(targetId)!.pc
    }

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })

    // Add local tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current!)
      })
    }

    // Handle ICE candidates - batch them to reduce signal count
    pc.onicecandidate = (event) => {
      if (event.candidate && mountedRef.current) {
        // Add to batch
        const batch = iceBatchRef.current.get(targetId) || []
        batch.push(event.candidate.toJSON())
        iceBatchRef.current.set(targetId, batch)

        // Clear existing timer
        const existingTimer = iceBatchTimerRef.current.get(targetId)
        if (existingTimer) clearTimeout(existingTimer)

        // Set new timer to send batch after 100ms
        const timer = setTimeout(() => {
          const candidates = iceBatchRef.current.get(targetId) || []
          if (candidates.length > 0 && mountedRef.current) {
            sendSignal({
              roomId,
              from: peerId,
              to: targetId,
              signal: JSON.stringify({ type: 'candidates', candidates }),
            }).catch(() => {})
            iceBatchRef.current.delete(targetId)
          }
          iceBatchTimerRef.current.delete(targetId)
        }, 100)
        iceBatchTimerRef.current.set(targetId, timer)
      }
    }

    pc.oniceconnectionstatechange = () => {
      // Connection state changed
    }

    // Handle remote tracks
    pc.ontrack = (event) => {
      const conn = peersRef.current.get(targetId)
      if (conn) {
        if (!conn.stream) {
          conn.stream = new MediaStream()
        }
        conn.stream.addTrack(event.track)
        syncPeers()
      }
    }

    // Store connection
    const connection: PeerConnection = { peerId: targetId, pc, name: targetName }
    peersRef.current.set(targetId, connection)
    syncPeers()

    // If initiator, create and send offer
    if (isInitiator) {
      pc.createOffer()
        .then(offer => pc.setLocalDescription(offer))
        .then(() => {
          if (pc.localDescription && mountedRef.current) {
            sendSignal({
              roomId,
              from: peerId,
              to: targetId,
              signal: JSON.stringify({ type: 'offer', sdp: pc.localDescription }),
            }).catch(() => {})
          }
        })
        .catch(() => {})
    }

    return pc
  }, [roomId, peerId, sendSignal, syncPeers])

  // Handle incoming signal
  const handleSignal = useCallback(async (fromId: string, signalData: string, fromName: string) => {
    try {
      const signal = JSON.parse(signalData)

      let conn = peersRef.current.get(fromId)

      if (signal.type === 'offer') {
        // Create connection if doesn't exist (we're the answerer)
        if (!conn) {
          const pc = createPeerConnection(fromId, fromName, false)
          if (!pc) return
          conn = peersRef.current.get(fromId)
        }

        if (conn) {
          await conn.pc.setRemoteDescription(new RTCSessionDescription(signal.sdp))

          // Apply any pending ICE candidates
          const pending = pendingCandidatesRef.current.get(fromId) || []
          for (const candidate of pending) {
            await conn.pc.addIceCandidate(new RTCIceCandidate(candidate))
          }
          pendingCandidatesRef.current.delete(fromId)

          const answer = await conn.pc.createAnswer()
          await conn.pc.setLocalDescription(answer)

          if (conn.pc.localDescription && mountedRef.current && roomId) {
            await sendSignal({
              roomId,
              from: peerId,
              to: fromId,
              signal: JSON.stringify({ type: 'answer', sdp: conn.pc.localDescription }),
            })
          }
        }
      } else if (signal.type === 'answer') {
        if (conn && conn.pc.signalingState === 'have-local-offer') {
          await conn.pc.setRemoteDescription(new RTCSessionDescription(signal.sdp))

          // Apply any pending ICE candidates
          const pending = pendingCandidatesRef.current.get(fromId) || []
          for (const candidate of pending) {
            await conn.pc.addIceCandidate(new RTCIceCandidate(candidate))
          }
          pendingCandidatesRef.current.delete(fromId)
        }
      } else if (signal.type === 'candidate') {
        // Handle single candidate (legacy)
        if (conn && conn.pc.remoteDescription) {
          await conn.pc.addIceCandidate(new RTCIceCandidate(signal.candidate))
        } else {
          const pending = pendingCandidatesRef.current.get(fromId) || []
          pending.push(signal.candidate)
          pendingCandidatesRef.current.set(fromId, pending)
        }
      } else if (signal.type === 'candidates') {
        // Handle batched candidates
        for (const candidate of signal.candidates) {
          if (conn && conn.pc.remoteDescription) {
            await conn.pc.addIceCandidate(new RTCIceCandidate(candidate))
          } else {
            const pending = pendingCandidatesRef.current.get(fromId) || []
            pending.push(candidate)
            pendingCandidatesRef.current.set(fromId, pending)
          }
        }
      }
    } catch {
      // Signal handling error
    }
  }, [createPeerConnection, roomId, peerId, sendSignal])

  // Setup on mount
  useEffect(() => {
    if (!roomId || !userName) return

    let isActive = true
    mountedRef.current = true

    const setup = async () => {
      const stream = await initStream()
      if (!isActive || !mountedRef.current) {
        return
      }

      try {
        // Clean up stale signals for this room before joining (non-blocking)
        cleanupStaleSignals({ roomId }).catch(() => {})

        await joinRoom({ roomId, peerId, name: userName })
        hasJoinedRef.current = true

        if (isActive && mountedRef.current) {
          setIsReady(true)
          if (!stream) {
            setIsVideoOff(true)
            setIsMuted(true)
          }

          // Sync initial muted/video state with server
          // Use setTimeout to ensure state has been set
          setTimeout(() => {
            const audioTrack = localStreamRef.current?.getAudioTracks()[0]
            const videoTrack = localStreamRef.current?.getVideoTracks()[0]
            const currentMuted = audioTrack ? !audioTrack.enabled : true
            const currentVideoOff = videoTrack ? !videoTrack.enabled : true
            updateParticipant({ peerId, isMuted: currentMuted, isVideoOff: currentVideoOff }).catch(() => {})
          }, 100)
        }
      } catch {
        if (isActive && mountedRef.current) {
          setIsReady(true)
        }
      }
    }

    setup()

    return () => {
      isActive = false
      mountedRef.current = false
    }
  }, [roomId, userName, peerId, initStream, joinRoom, cleanupStaleSignals, updateParticipant])

  // Handle page unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (hasJoinedRef.current) {
        leaveRoom({ peerId }).catch(() => {})
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [peerId, leaveRoom])

  // Heartbeat every 25 seconds to keep participant alive
  // Uses visibility API to pause when tab is hidden (saves bandwidth)
  // Stale threshold is 60s, so 2 missed heartbeats = cleanup
  useEffect(() => {
    if (!isReady || !hasJoinedRef.current) return

    const sendHeartbeat = () => {
      // Only send if tab is visible and we're still in the room
      if (document.visibilityState === 'visible' && hasJoinedRef.current && mountedRef.current) {
        heartbeat({ peerId }).catch(() => {})
      }
    }

    // Send initial heartbeat
    sendHeartbeat()

    // Regular interval
    const interval = setInterval(sendHeartbeat, 25000) // 25 seconds

    // Also send heartbeat when tab becomes visible again
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        sendHeartbeat()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [isReady, peerId, heartbeat])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      localStreamRef.current?.getTracks().forEach(t => t.stop())
      localStreamRef.current = null
      screenStreamRef.current?.getTracks().forEach(t => t.stop())
      screenStreamRef.current = null
      originalVideoTrackRef.current = null
      peersRef.current.forEach(({ pc }) => pc.close())
      peersRef.current.clear()
      pendingCandidatesRef.current.clear()
      processedSignalsRef.current.clear()
      hasJoinedRef.current = false
      // Clear ICE batch timers
      iceBatchTimerRef.current.forEach(timer => clearTimeout(timer))
      iceBatchTimerRef.current.clear()
      iceBatchRef.current.clear()
    }
  }, [])

  // Handle participants
  useEffect(() => {
    if (!participants || !isReady) return

    const others = participants.filter(p => p.peerId !== peerId)

    others.forEach(p => {
      if (!peersRef.current.has(p.peerId)) {
        // Determine who initiates based on peerId comparison
        const shouldInitiate = peerId > p.peerId
        createPeerConnection(p.peerId, p.name, shouldInitiate)
      }
    })

    // Remove departed peers
    const activeIds = new Set(others.map(p => p.peerId))
    peersRef.current.forEach((conn, id) => {
      if (!activeIds.has(id)) {
        conn.pc.close()
        peersRef.current.delete(id)
      }
    })
    syncPeers()
  }, [participants, peerId, createPeerConnection, isReady, syncPeers])

  // Handle signals - client-side TTL filtering and batch consumption
  useEffect(() => {
    if (!signals || !isReady || signals.length === 0) return

    const now = Date.now()
    const staleThreshold = now - SIGNAL_TTL_MS
    const signalsToConsume: typeof signals[0]['_id'][] = []

    for (const signal of signals) {
      // Skip already processed signals
      if (processedSignalsRef.current.has(signal._id)) continue
      processedSignalsRef.current.add(signal._id)

      // Client-side TTL check - skip stale signals
      if (signal.timestamp < staleThreshold) {
        signalsToConsume.push(signal._id)
        continue
      }

      const fromId = signal.from
      const participant = participants?.find(p => p.peerId === fromId)
      const fromName = participant?.name || 'Unknown'

      handleSignal(fromId, signal.signal, fromName)
      signalsToConsume.push(signal._id)
    }

    // Batch consume all processed signals
    if (signalsToConsume.length > 0) {
      consumeSignals({ signalIds: signalsToConsume }).catch(() => {})
    }
  }, [signals, participants, handleSignal, consumeSignals, isReady])

  const toggleMute = useCallback(() => {
    const track = localStreamRef.current?.getAudioTracks()[0]
    if (track) {
      track.enabled = !track.enabled
      setIsMuted(!track.enabled)
      updateParticipant({ peerId, isMuted: !track.enabled }).catch(() => {})
    } else {
      setIsMuted(prev => !prev)
    }
  }, [peerId, updateParticipant])

  const toggleVideo = useCallback(() => {
    const track = localStreamRef.current?.getVideoTracks()[0]
    if (track) {
      track.enabled = !track.enabled
      setIsVideoOff(!track.enabled)
      updateParticipant({ peerId, isVideoOff: !track.enabled }).catch(() => {})
    } else {
      setIsVideoOff(prev => !prev)
    }
  }, [peerId, updateParticipant])

  // Stop screen sharing and restore camera
  const stopScreenShare = useCallback(() => {
    if (!screenStreamRef.current) return

    // Stop screen tracks
    screenStreamRef.current.getTracks().forEach(track => track.stop())

    // Restore original video track in all peer connections
    const originalTrack = originalVideoTrackRef.current
    if (originalTrack) {
      peersRef.current.forEach(({ pc }) => {
        const sender = pc.getSenders().find(s => s.track?.kind === 'video')
        if (sender) {
          sender.replaceTrack(originalTrack).catch(() => {})
        }
      })

      // Update local stream to show camera again
      if (localStreamRef.current) {
        const oldVideoTrack = localStreamRef.current.getVideoTracks()[0]
        if (oldVideoTrack) {
          localStreamRef.current.removeTrack(oldVideoTrack)
        }
        localStreamRef.current.addTrack(originalTrack)
        setLocalStream(new MediaStream(localStreamRef.current.getTracks()))
      }
    }

    screenStreamRef.current = null
    originalVideoTrackRef.current = null
    setScreenStream(null)
    setIsScreenSharing(false)
  }, [])

  // Toggle screen sharing
  const toggleScreenShare = useCallback(async () => {
    if (isScreenSharing) {
      stopScreenShare()
      return
    }

    try {
      // Get screen stream
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          cursor: 'always',
        },
        audio: false,
      })

      if (!mountedRef.current) {
        stream.getTracks().forEach(t => t.stop())
        return
      }

      const screenTrack = stream.getVideoTracks()[0]

      // Handle when user stops sharing via browser UI
      screenTrack.onended = () => {
        stopScreenShare()
      }

      // Store original camera track before replacing
      const currentVideoTrack = localStreamRef.current?.getVideoTracks()[0]
      if (currentVideoTrack) {
        originalVideoTrackRef.current = currentVideoTrack
      }

      // Replace video track in all peer connections
      peersRef.current.forEach(({ pc }) => {
        const sender = pc.getSenders().find(s => s.track?.kind === 'video')
        if (sender) {
          sender.replaceTrack(screenTrack).catch(() => {})
        }
      })

      // Update local stream to show screen share
      if (localStreamRef.current && currentVideoTrack) {
        localStreamRef.current.removeTrack(currentVideoTrack)
        localStreamRef.current.addTrack(screenTrack)
        setLocalStream(new MediaStream(localStreamRef.current.getTracks()))
      }

      screenStreamRef.current = stream
      setScreenStream(stream)
      setIsScreenSharing(true)
    } catch {
      // User cancelled or error occurred
    }
  }, [isScreenSharing, stopScreenShare])

  return {
    localStream,
    screenStream,
    peers,
    isMuted,
    isVideoOff,
    isScreenSharing,
    peerId,
    toggleMute,
    toggleVideo,
    toggleScreenShare,
    participants,
  }
}
