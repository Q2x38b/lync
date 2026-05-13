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
  // STUN servers - help peers discover their public IP
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
  { urls: 'stun:global.stun.twilio.com:3478' },
  { urls: 'stun:stun.cloudflare.com:3478' },

  // TURN servers - relay traffic when STUN can't punch through NAT.
  // Required for cross-network calls behind symmetric NATs or
  // restrictive firewalls. Port 443 + TCP transports come first so
  // they work even on networks that block UDP / non-standard ports.
  // Metered OpenRelay (public free TURN):
  {
    urls: 'turn:openrelay.metered.ca:443?transport=tcp',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: 'turn:openrelay.metered.ca:443',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: 'turn:openrelay.metered.ca:80?transport=tcp',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: 'turn:openrelay.metered.ca:80',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  // ExpressTURN (kept as a fallback in case OpenRelay is rate-limited):
  {
    urls: 'turn:relay1.expressturn.com:3478?transport=tcp',
    username: 'efGHA4PYZXIRRJ7M',
    credential: 'K1RUu1DAbkBi8Ycb',
  },
  {
    urls: 'turn:relay1.expressturn.com:3478',
    username: 'efGHA4PYZXIRRJ7M',
    credential: 'K1RUu1DAbkBi8Ycb',
  },
]

// RTCPeerConnection configuration with ICE candidate pool
const PC_CONFIG: RTCConfiguration = {
  iceServers: ICE_SERVERS,
  iceCandidatePoolSize: 10, // Pre-gather candidates for faster connection
  bundlePolicy: 'max-bundle', // Bundle all media on single transport
  rtcpMuxPolicy: 'require', // Require RTCP multiplexing
}

// Connection timeout - if ICE doesn't connect within this time, restart
const ICE_CONNECTION_TIMEOUT_MS = 15000

// Client-side signal TTL (30 seconds) - signals older than this are ignored
const SIGNAL_TTL_MS = 30 * 1000

// Debug logging helper
const DEBUG = true
const log = (...args: unknown[]) => {
  if (DEBUG) console.log('[WebRTC]', ...args)
}

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
  const makingOfferRef = useRef<Map<string, boolean>>(new Map())
  const currentRoomIdRef = useRef<Id<"rooms"> | null>(null)
  const connectionTimeoutRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const iceRestartAttemptsRef = useRef<Map<string, number>>(new Map())

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

  // Only query signals when we have a valid roomId and are ready
  const signals = useQuery(
    api.signals.getSignals,
    roomId && isReady ? { peerId } : 'skip'
  )

  const syncPeers = useCallback(() => {
    if (mountedRef.current) {
      setPeers(new Map(peersRef.current))
    }
  }, [])

  // Initialize local media
  const initStream = useCallback(async () => {
    log('Initializing local media stream')
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
      log('Got local stream with tracks:', stream.getTracks().map(t => `${t.kind}:${t.enabled}`))
      setLocalStream(stream)
      localStreamRef.current = stream
      applyPreferences(stream)
      return stream
    } catch (err) {
      log('Video+audio failed:', err)
    }

    // Try video only
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: videoConstraints, audio: false })
      if (!mountedRef.current) {
        stream.getTracks().forEach(t => t.stop())
        return null
      }
      log('Got video-only stream')
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
    } catch (err) {
      log('Video-only failed:', err)
    }

    // Try audio only
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints, video: false })
      if (!mountedRef.current) {
        stream.getTracks().forEach(t => t.stop())
        return null
      }
      log('Got audio-only stream')
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
    } catch (err) {
      log('Audio-only failed:', err)
    }

    log('No media available')
    return null
  }, [])

  // Create peer connection
  const createPeerConnection = useCallback((targetId: string, targetName: string, isInitiator: boolean) => {
    if (!roomId) return null
    if (peersRef.current.has(targetId)) {
      log('Peer connection already exists for', targetId)
      return peersRef.current.get(targetId)!.pc
    }

    log('Creating peer connection to', targetId, 'isInitiator:', isInitiator)
    const pc = new RTCPeerConnection(PC_CONFIG)

    // Always create both audio and video transceivers in sendrecv direction so
    // the offer/answer always contains m=audio and m=video sections, even if
    // the local stream is missing one (e.g., camera-denied). Attach local tracks
    // via replaceTrack instead of addTrack so the transceiver order stays fixed
    // (audio first, video second) on both peers — Unified Plan matches by order.
    const audioTransceiver = pc.addTransceiver('audio', { direction: 'sendrecv' })
    const videoTransceiver = pc.addTransceiver('video', { direction: 'sendrecv' })

    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0]
      const videoTrack = localStreamRef.current.getVideoTracks()[0]
      log('Local tracks - audio:', !!audioTrack, 'video:', !!videoTrack)
      if (audioTrack) {
        audioTransceiver.sender.replaceTrack(audioTrack).catch(err => log('replaceTrack audio failed:', err))
      }
      if (videoTrack) {
        videoTransceiver.sender.replaceTrack(videoTrack).catch(err => log('replaceTrack video failed:', err))
      }
    } else {
      log('Warning: No local stream available when creating peer connection')
    }

    // Store connection BEFORE setting up event handlers
    // This ensures the connection exists when events fire
    const connection: PeerConnection = { peerId: targetId, pc, name: targetName }
    peersRef.current.set(targetId, connection)

    // Handle ICE candidates - batch them to reduce signal count
    pc.onicecandidate = (event) => {
      if (event.candidate && mountedRef.current && currentRoomIdRef.current) {
        // Log candidate type for debugging connectivity issues
        const candidate = event.candidate
        log('ICE candidate gathered:', candidate.type, candidate.protocol, candidate.address ? `${candidate.address}:${candidate.port}` : '')

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
          if (candidates.length > 0 && mountedRef.current && currentRoomIdRef.current) {
            log('Sending', candidates.length, 'ICE candidates to', targetId)
            sendSignal({
              roomId: currentRoomIdRef.current,
              from: peerId,
              to: targetId,
              signal: JSON.stringify({ type: 'candidates', candidates }),
            }).catch(err => log('Failed to send candidates:', err))
            iceBatchRef.current.delete(targetId)
          }
          iceBatchTimerRef.current.delete(targetId)
        }, 100)
        iceBatchTimerRef.current.set(targetId, timer)
      }
    }

    pc.oniceconnectionstatechange = () => {
      const state = pc.iceConnectionState
      log('ICE connection state changed to', state, 'for', targetId)

      // Clear any existing timeout
      const existingTimeout = connectionTimeoutRef.current.get(targetId)
      if (existingTimeout) {
        clearTimeout(existingTimeout)
        connectionTimeoutRef.current.delete(targetId)
      }

      if (state === 'checking' || state === 'new') {
        // Set timeout to detect stuck connections
        const timeout = setTimeout(() => {
          const currentState = pc.iceConnectionState
          if (currentState === 'checking' || currentState === 'new') {
            const attempts = iceRestartAttemptsRef.current.get(targetId) || 0
            if (attempts < 5) { // Increased max attempts
              log('ICE connection timeout, restarting ICE (attempt', attempts + 1, ')')
              iceRestartAttemptsRef.current.set(targetId, attempts + 1)
              // Create new offer with ICE restart flag
              pc.restartIce()
            } else {
              log('ICE connection failed after 5 restart attempts - check network/firewall')
            }
          }
        }, ICE_CONNECTION_TIMEOUT_MS)
        connectionTimeoutRef.current.set(targetId, timeout)
      } else if (state === 'failed') {
        const attempts = iceRestartAttemptsRef.current.get(targetId) || 0
        if (attempts < 5) { // Increased max attempts
          log('ICE connection failed, restarting ICE (attempt', attempts + 1, ')')
          iceRestartAttemptsRef.current.set(targetId, attempts + 1)
          // Use createOffer with iceRestart for more aggressive restart
          const shouldInitiate = peerId > targetId
          if (shouldInitiate && !makingOfferRef.current.get(targetId)) {
            makingOfferRef.current.set(targetId, true)
            pc.createOffer({ iceRestart: true })
              .then(offer => pc.setLocalDescription(offer))
              .then(() => {
                if (pc.localDescription && mountedRef.current && currentRoomIdRef.current) {
                  log('Sending ICE restart offer to', targetId)
                  sendSignal({
                    roomId: currentRoomIdRef.current,
                    from: peerId,
                    to: targetId,
                    signal: JSON.stringify({ type: 'offer', sdp: pc.localDescription }),
                  }).catch(err => log('Failed to send ICE restart offer:', err))
                }
              })
              .catch(err => log('ICE restart offer error:', err))
              .finally(() => makingOfferRef.current.set(targetId, false))
          } else if (!shouldInitiate) {
            // Non-initiator just restarts ICE and waits for new offer
            pc.restartIce()
          }
        } else {
          log('ICE connection failed permanently after 5 attempts - check network/firewall')
        }
      } else if (state === 'connected' || state === 'completed') {
        log('ICE connection established with', targetId)
        iceRestartAttemptsRef.current.delete(targetId)
      } else if (state === 'disconnected') {
        // Set a longer timeout before restart - disconnected can recover on its own
        const timeout = setTimeout(() => {
          if (pc.iceConnectionState === 'disconnected') {
            log('ICE still disconnected after 5s, restarting')
            const attempts = iceRestartAttemptsRef.current.get(targetId) || 0
            if (attempts < 5) {
              iceRestartAttemptsRef.current.set(targetId, attempts + 1)
              pc.restartIce()
            }
          }
        }, 5000) // Increased from 3s to 5s
        connectionTimeoutRef.current.set(targetId, timeout)
      }
    }

    pc.onicegatheringstatechange = () => {
      log('ICE gathering state changed to', pc.iceGatheringState, 'for', targetId)
    }

    pc.onconnectionstatechange = () => {
      log('Connection state changed to', pc.connectionState, 'for', targetId)
      if (pc.connectionState === 'failed') {
        log('Peer connection failed for', targetId)
      }
    }

    // Handle remote tracks
    pc.ontrack = (event) => {
      log('Received track from', targetId, '- kind:', event.track.kind, 'enabled:', event.track.enabled)

      const conn = peersRef.current.get(targetId)
      if (!conn) {
        log('Warning: No connection found for', targetId, 'when receiving track')
        return
      }

      // Build a fresh MediaStream that combines previously-seen tracks with the new one.
      // We always create a NEW MediaStream reference so React's useEffect deps detect the
      // change and re-attach srcObject on the <video> element. The HTMLVideoElement does
      // NOT automatically render tracks added to an already-attached MediaStream, and
      // WebRTC's track event doesn't fire MediaStream.addtrack, so reusing the same
      // stream reference would leave the video element stuck showing only the initial track.
      const sourceTracks = event.streams && event.streams[0]
        ? event.streams[0].getTracks()
        : []
      const previousTracks = conn.stream ? conn.stream.getTracks() : []
      const trackMap = new Map<string, MediaStreamTrack>()
      for (const t of previousTracks) trackMap.set(t.id, t)
      for (const t of sourceTracks) trackMap.set(t.id, t)
      trackMap.set(event.track.id, event.track)
      const remoteStream = new MediaStream(Array.from(trackMap.values()))
      log('Built remote stream with tracks:', remoteStream.getTracks().map(t => t.kind))

      // Update the connection with the new stream reference
      const updatedConn = { ...conn, stream: remoteStream }
      peersRef.current.set(targetId, updatedConn)

      // Force React to see the change by creating a new Map
      if (mountedRef.current) {
        log('Updating peers state with new stream')
        setPeers(new Map(peersRef.current))
      }
    }

    // Handle negotiation needed (for renegotiation)
    pc.onnegotiationneeded = async () => {
      // Only the initiator should send offers during renegotiation
      const shouldInitiate = peerId > targetId
      if (!shouldInitiate) {
        log('Skipping negotiation - not the initiator for', targetId)
        return
      }

      if (makingOfferRef.current.get(targetId)) {
        log('Already making offer to', targetId)
        return
      }

      try {
        makingOfferRef.current.set(targetId, true)
        log('Creating offer for', targetId, 'due to negotiation needed')
        const offer = await pc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: true,
        })
        if (pc.signalingState !== 'stable') {
          log('Signaling state not stable, aborting offer')
          return
        }
        // Log what's in the offer
        const hasAudio = offer.sdp?.includes('m=audio') || false
        const hasVideo = offer.sdp?.includes('m=video') || false
        log('Renegotiation offer - audio:', hasAudio, 'video:', hasVideo)
        await pc.setLocalDescription(offer)

        if (pc.localDescription && mountedRef.current && currentRoomIdRef.current) {
          log('Sending offer to', targetId)
          sendSignal({
            roomId: currentRoomIdRef.current,
            from: peerId,
            to: targetId,
            signal: JSON.stringify({ type: 'offer', sdp: pc.localDescription }),
          }).catch(err => log('Failed to send offer:', err))
        }
      } catch (err) {
        log('Negotiation error:', err)
      } finally {
        makingOfferRef.current.set(targetId, false)
      }
    }

    syncPeers()

    // If initiator, create and send offer
    if (isInitiator) {
      makingOfferRef.current.set(targetId, true)
      log('Creating initial offer to', targetId)
      // Log senders to verify both tracks are added
      const senders = pc.getSenders()
      log('Peer connection has', senders.length, 'senders:', senders.map(s => s.track?.kind || 'null'))

      pc.createOffer()
        .then(offer => {
          // Log what's in the offer SDP
          const hasAudio = offer.sdp?.includes('m=audio') || false
          const hasVideo = offer.sdp?.includes('m=video') || false
          log('Created offer - audio:', hasAudio, 'video:', hasVideo)
          return pc.setLocalDescription(offer)
        })
        .then(() => {
          if (pc.localDescription && mountedRef.current && currentRoomIdRef.current) {
            log('Sending initial offer to', targetId)
            return sendSignal({
              roomId: currentRoomIdRef.current,
              from: peerId,
              to: targetId,
              signal: JSON.stringify({ type: 'offer', sdp: pc.localDescription }),
            })
          }
        })
        .catch(err => log('Failed to create/send offer:', err))
        .finally(() => {
          makingOfferRef.current.set(targetId, false)
        })
    }

    return pc
  }, [roomId, peerId, sendSignal, syncPeers])

  // Handle incoming signal
  const handleSignal = useCallback(async (fromId: string, signalData: string, fromName: string) => {
    try {
      const signal = JSON.parse(signalData)
      log('Handling signal from', fromId, 'type:', signal.type)

      let conn = peersRef.current.get(fromId)

      if (signal.type === 'offer') {
        // Create connection if doesn't exist (we're the answerer)
        if (!conn) {
          log('Creating peer connection for incoming offer from', fromId)
          const pc = createPeerConnection(fromId, fromName, false)
          if (!pc) {
            log('Failed to create peer connection')
            return
          }
          conn = peersRef.current.get(fromId)
        }

        if (conn) {
          // Handle glare (both sides sent offer)
          const offerCollision = makingOfferRef.current.get(fromId) ||
            (conn.pc.signalingState !== 'stable')

          // Use polite peer pattern - lower peerId is polite
          const polite = peerId < fromId
          const ignoreOffer = !polite && offerCollision

          if (ignoreOffer) {
            log('Ignoring offer due to glare, we are impolite peer')
            return
          }

          log('Setting remote description from offer')
          // Log what media is in the offer
          const sdp = signal.sdp.sdp || ''
          const hasAudio = sdp.includes('m=audio')
          const hasVideo = sdp.includes('m=video')
          log('Offer contains - audio:', hasAudio, 'video:', hasVideo)
          await conn.pc.setRemoteDescription(new RTCSessionDescription(signal.sdp))

          // Apply any pending ICE candidates
          const pending = pendingCandidatesRef.current.get(fromId) || []
          if (pending.length > 0) {
            log('Applying', pending.length, 'pending ICE candidates')
            for (const candidate of pending) {
              try {
                await conn.pc.addIceCandidate(new RTCIceCandidate(candidate))
              } catch (err) {
                log('Failed to add pending candidate:', err)
              }
            }
            pendingCandidatesRef.current.delete(fromId)
          }

          log('Creating answer')
          const answer = await conn.pc.createAnswer()
          // Log what's in the answer SDP
          const answerHasAudio = answer.sdp?.includes('m=audio') || false
          const answerHasVideo = answer.sdp?.includes('m=video') || false
          log('Created answer - audio:', answerHasAudio, 'video:', answerHasVideo)
          await conn.pc.setLocalDescription(answer)

          if (conn.pc.localDescription && mountedRef.current && currentRoomIdRef.current) {
            log('Sending answer to', fromId)
            await sendSignal({
              roomId: currentRoomIdRef.current,
              from: peerId,
              to: fromId,
              signal: JSON.stringify({ type: 'answer', sdp: conn.pc.localDescription }),
            })
          }
        }
      } else if (signal.type === 'answer') {
        if (conn && conn.pc.signalingState === 'have-local-offer') {
          log('Setting remote description from answer')
          // Log what media is in the answer
          const sdp = signal.sdp.sdp || ''
          const hasAudio = sdp.includes('m=audio')
          const hasVideo = sdp.includes('m=video')
          log('Answer contains - audio:', hasAudio, 'video:', hasVideo)
          await conn.pc.setRemoteDescription(new RTCSessionDescription(signal.sdp))

          // Apply any pending ICE candidates
          const pending = pendingCandidatesRef.current.get(fromId) || []
          if (pending.length > 0) {
            log('Applying', pending.length, 'pending ICE candidates')
            for (const candidate of pending) {
              try {
                await conn.pc.addIceCandidate(new RTCIceCandidate(candidate))
              } catch (err) {
                log('Failed to add pending candidate:', err)
              }
            }
            pendingCandidatesRef.current.delete(fromId)
          }
        } else {
          log('Ignoring answer - wrong signaling state:', conn?.pc.signalingState)
        }
      } else if (signal.type === 'candidate') {
        // Handle single candidate (legacy)
        if (conn && conn.pc.remoteDescription) {
          try {
            await conn.pc.addIceCandidate(new RTCIceCandidate(signal.candidate))
          } catch (err) {
            log('Failed to add candidate:', err)
          }
        } else {
          const pending = pendingCandidatesRef.current.get(fromId) || []
          pending.push(signal.candidate)
          pendingCandidatesRef.current.set(fromId, pending)
        }
      } else if (signal.type === 'candidates') {
        // Handle batched candidates
        log('Processing', signal.candidates.length, 'batched candidates from', fromId)
        for (const candidate of signal.candidates) {
          if (conn && conn.pc.remoteDescription) {
            try {
              await conn.pc.addIceCandidate(new RTCIceCandidate(candidate))
            } catch (err) {
              log('Failed to add batched candidate:', err)
            }
          } else {
            const pending = pendingCandidatesRef.current.get(fromId) || []
            pending.push(candidate)
            pendingCandidatesRef.current.set(fromId, pending)
          }
        }
      }
    } catch (err) {
      log('Signal handling error:', err)
    }
  }, [createPeerConnection, peerId, sendSignal])

  // Setup on mount
  useEffect(() => {
    if (!roomId || !userName) return

    let isActive = true
    mountedRef.current = true
    currentRoomIdRef.current = roomId

    log('Setting up WebRTC for room', roomId)

    const setup = async () => {
      const stream = await initStream()
      if (!isActive || !mountedRef.current) {
        log('Component unmounted during stream init')
        return
      }

      try {
        // Clean up stale signals for this room before joining (non-blocking)
        cleanupStaleSignals({ roomId }).catch(() => {})

        log('Joining room')
        await joinRoom({ roomId, peerId, name: userName })
        hasJoinedRef.current = true

        if (isActive && mountedRef.current) {
          log('Setting isReady to true')
          setIsReady(true)
          if (!stream) {
            setIsVideoOff(true)
            setIsMuted(true)
          }

          // Sync initial muted/video state with server
          setTimeout(() => {
            const audioTrack = localStreamRef.current?.getAudioTracks()[0]
            const videoTrack = localStreamRef.current?.getVideoTracks()[0]
            const currentMuted = audioTrack ? !audioTrack.enabled : true
            const currentVideoOff = videoTrack ? !videoTrack.enabled : true
            updateParticipant({ peerId, isMuted: currentMuted, isVideoOff: currentVideoOff }).catch(() => {})
          }, 100)
        }
      } catch (err) {
        log('Failed to join room:', err)
        if (isActive && mountedRef.current) {
          setIsReady(true)
        }
      }
    }

    setup()

    return () => {
      isActive = false
      mountedRef.current = false
      currentRoomIdRef.current = null
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

  // Heartbeat every 25 seconds
  useEffect(() => {
    if (!isReady || !hasJoinedRef.current) return

    const sendHeartbeat = () => {
      if (document.visibilityState === 'visible' && hasJoinedRef.current && mountedRef.current) {
        heartbeat({ peerId }).catch(() => {})
      }
    }

    sendHeartbeat()
    const interval = setInterval(sendHeartbeat, 25000)

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
      log('Cleaning up WebRTC')
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
      iceBatchTimerRef.current.forEach(timer => clearTimeout(timer))
      iceBatchTimerRef.current.clear()
      iceBatchRef.current.clear()
      makingOfferRef.current.clear()
      connectionTimeoutRef.current.forEach(timer => clearTimeout(timer))
      connectionTimeoutRef.current.clear()
      iceRestartAttemptsRef.current.clear()
    }
  }, [])

  // Handle participants
  useEffect(() => {
    if (!participants || !isReady) return

    const others = participants.filter(p => p.peerId !== peerId)
    log('Participants updated:', others.length, 'others in room')

    others.forEach(p => {
      if (!peersRef.current.has(p.peerId)) {
        // Determine who initiates based on peerId comparison
        const shouldInitiate = peerId > p.peerId
        log('New participant:', p.name, 'shouldInitiate:', shouldInitiate)
        createPeerConnection(p.peerId, p.name, shouldInitiate)
      }
    })

    // Remove departed peers
    const activeIds = new Set(others.map(p => p.peerId))
    peersRef.current.forEach((conn, id) => {
      if (!activeIds.has(id)) {
        log('Removing departed peer:', id)
        conn.pc.close()
        peersRef.current.delete(id)
      }
    })
    syncPeers()
  }, [participants, peerId, createPeerConnection, isReady, syncPeers])

  // Handle signals
  useEffect(() => {
    if (!signals || !isReady || signals.length === 0) return

    const now = Date.now()
    const staleThreshold = now - SIGNAL_TTL_MS
    const signalsToConsume: typeof signals[0]['_id'][] = []

    log('Processing', signals.length, 'signals')

    for (const signal of signals) {
      // Skip already processed signals
      if (processedSignalsRef.current.has(signal._id)) continue
      processedSignalsRef.current.add(signal._id)

      // Client-side TTL check - skip stale signals
      if (signal.timestamp < staleThreshold) {
        log('Skipping stale signal from', signal.from)
        signalsToConsume.push(signal._id)
        continue
      }

      // Only process signals for the current room
      if (currentRoomIdRef.current && signal.roomId !== currentRoomIdRef.current) {
        log('Skipping signal from different room')
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
      const newMutedState = !track.enabled
      log('Toggled mute:', newMutedState)
      setIsMuted(newMutedState)
      updateParticipant({ peerId, isMuted: newMutedState }).catch(() => {})
    } else {
      setIsMuted(prev => {
        const newState = !prev
        updateParticipant({ peerId, isMuted: newState }).catch(() => {})
        return newState
      })
    }
  }, [peerId, updateParticipant])

  const toggleVideo = useCallback(() => {
    const track = localStreamRef.current?.getVideoTracks()[0]
    if (track) {
      track.enabled = !track.enabled
      const newVideoOffState = !track.enabled
      log('Toggled video:', newVideoOffState)
      setIsVideoOff(newVideoOffState)
      updateParticipant({ peerId, isVideoOff: newVideoOffState }).catch(() => {})
    } else {
      setIsVideoOff(prev => {
        const newState = !prev
        updateParticipant({ peerId, isVideoOff: newState }).catch(() => {})
        return newState
      })
    }
  }, [peerId, updateParticipant])

  // Stop screen sharing and restore camera
  const stopScreenShare = useCallback(() => {
    if (!screenStreamRef.current) return
    log('Stopping screen share')

    screenStreamRef.current.getTracks().forEach(track => track.stop())

    const originalTrack = originalVideoTrackRef.current
    if (originalTrack) {
      peersRef.current.forEach(({ pc }) => {
        const sender = pc.getSenders().find(s => s.track?.kind === 'video')
        if (sender) {
          sender.replaceTrack(originalTrack).catch(err => log('Failed to restore camera track:', err))
        }
      })

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
      log('Starting screen share')
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      })

      if (!mountedRef.current) {
        stream.getTracks().forEach(t => t.stop())
        return
      }

      const screenTrack = stream.getVideoTracks()[0]
      log('Got screen track:', screenTrack.label)

      screenTrack.onended = () => {
        log('Screen share ended by browser')
        stopScreenShare()
      }

      const currentVideoTrack = localStreamRef.current?.getVideoTracks()[0]
      if (currentVideoTrack) {
        originalVideoTrackRef.current = currentVideoTrack
      }

      // Replace video track in all peer connections
      let replacedCount = 0
      peersRef.current.forEach(({ pc }) => {
        const sender = pc.getSenders().find(s => s.track?.kind === 'video')
        if (sender) {
          sender.replaceTrack(screenTrack)
            .then(() => {
              replacedCount++
              log('Replaced track in peer connection')
            })
            .catch(err => log('Failed to replace track:', err))
        }
      })

      // Update local stream
      if (localStreamRef.current && currentVideoTrack) {
        localStreamRef.current.removeTrack(currentVideoTrack)
        localStreamRef.current.addTrack(screenTrack)
        setLocalStream(new MediaStream(localStreamRef.current.getTracks()))
      }

      screenStreamRef.current = stream
      setScreenStream(stream)
      setIsScreenSharing(true)
      log('Screen share started, replaced in', replacedCount, 'connections')
    } catch (err) {
      log('Screen share error:', err)
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
