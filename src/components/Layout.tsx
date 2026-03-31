import { useState, useRef, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "../lib/utils"
import { Sidebar } from "./Sidebar"
import { MainContent } from "./MainContent"
import { RightPanel } from "./RightPanel"

export function Layout() {
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
    if (isDark) {
      document.documentElement.classList.add("dark")
    }
  }, [])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    // Store initial position and width
    startXRef.current = e.clientX
    startWidthRef.current = rightPanelWidth

    // Immediately lock cursor
    document.body.style.cursor = "col-resize"
    document.body.style.userSelect = "none"

    setIsResizing(true)

    const handleMouseMove = (e: MouseEvent) => {
      // Calculate delta from start position
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

  // Vertical resize handler for mobile
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
      const maxHeight = containerHeight * 0.35 // Bottom panel can be max 35% of container
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

  // Close sheet when clicking overlay on mobile
  const handleOverlayClick = useCallback(() => {
    if (isMobile && sidebarOpen) {
      setSidebarOpen(false)
    }
  }, [isMobile, sidebarOpen])

  return (
    <div className="h-screen w-full bg-background flex overflow-hidden">
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
            {/* Sheet handle */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 rounded-full bg-border" />
            </div>
            {/* Sheet header with close */}
            <div
              className="flex items-center justify-end px-4 pb-2"
            >
              <button
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "rounded-lg",
                  "hover:bg-accent active:scale-95",
                  "transition-colors duration-150",
                  "text-foreground"
                )}
                style={{ padding: 8 }}
                aria-label="Close menu"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            {/* Sheet content */}
            <div className="flex-1 overflow-auto px-4 pb-4">
              {/* Empty sheet content */}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Desktop sidebar */}
      {!isMobile && <Sidebar isOpen={sidebarOpen} />}

      {/* Main container wrapper */}
      <motion.div
        ref={containerRef}
        className={cn(
          "flex-1 h-full",
          isMobile ? "flex flex-col" : "flex"
        )}
        style={{ padding: isMobile ? 16 : 24, gap: isMobile ? 8 : 4 }}
        animate={{
          marginLeft: !isMobile && sidebarOpen ? 140 : 0
        }}
        transition={{
          duration: 0.2,
          ease: [0.25, 0.1, 0.25, 1]
        }}
      >
        {/* Main rounded container */}
        <div
          className={cn(
            "bg-card",
            "rounded-2xl",
            "border border-border",
            "overflow-hidden",
            isMobile ? "min-h-0" : "flex-1"
          )}
          style={isMobile ? { flex: 1 } : undefined}
        >
          <MainContent
            onSidebarToggle={() => setSidebarOpen(!sidebarOpen)}
            onThemeToggle={handleThemeToggle}
            isDark={isDark}
          />
        </div>

        {/* Resize handle - horizontal on desktop, vertical on mobile */}
        {!isMobile ? (
          <div
            onMouseDown={handleMouseDown}
            className={cn(
              "w-4 cursor-col-resize touch-none select-none",
              "flex items-center justify-center",
              "group",
              "-mx-1.5"
            )}
            role="separator"
            aria-label="Resize panels"
          >
            <div className={cn(
              "w-1 h-8 rounded-full",
              "bg-border group-hover:bg-muted-foreground",
              "transition-colors duration-150",
              isResizing && "bg-muted-foreground"
            )} />
          </div>
        ) : (
          <div
            onMouseDown={handleVerticalMouseDown}
            onTouchStart={handleVerticalMouseDown}
            className={cn(
              "h-6 cursor-row-resize touch-none select-none",
              "flex items-center justify-center",
              "group",
              "-my-2.5 z-10"
            )}
            role="separator"
            aria-label="Resize panels"
          >
            <div className={cn(
              "h-1 w-8 rounded-full",
              "bg-border group-hover:bg-muted-foreground",
              "transition-colors duration-150",
              isResizingVertical && "bg-muted-foreground"
            )} />
          </div>
        )}

        {/* Right/Bottom panel container */}
        <div
          ref={rightPanelRef}
          style={isMobile ? { height: bottomPanelHeight } : { width: rightPanelWidth }}
          className={cn(
            "bg-card",
            "rounded-2xl",
            "border border-border",
            "overflow-hidden",
            "flex-shrink-0"
          )}
        >
          <RightPanel />
        </div>
      </motion.div>
    </div>
  )
}
