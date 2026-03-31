import { cn } from "../lib/utils"

interface MainContentProps {
  onSidebarToggle: () => void
  onThemeToggle: () => void
  isDark: boolean
}

export function MainContent({ onSidebarToggle, onThemeToggle, isDark }: MainContentProps) {
  return (
    <div
      className={cn(
        "h-full",
        "flex flex-col"
      )}
      style={{ padding: 16 }}
    >
      {/* Header area with toggles */}
      <div
        className="flex items-center"
        style={{ height: 40, marginBottom: 12, gap: 8 }}
      >
        {/* Sidebar toggle - expanded hit area */}
        <button
          onClick={onSidebarToggle}
          className={cn(
            "rounded-lg",
            "hover:bg-accent active:scale-95",
            "transition-colors duration-150",
            "text-foreground",
            "focus-visible:ring-2 focus-visible:ring-ring"
          )}
          style={{ padding: 8 }}
          aria-label="Toggle sidebar"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 20 20"
            aria-hidden="true"
          >
            <g>
              <rect x="1" y="5" width="14" height="10" rx="1.5" ry="1.5" transform="translate(-2 18) rotate(-90)" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" fill="currentColor" />
              <line x1="17" y1="15" x2="17" y2="5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
            </g>
          </svg>
        </button>

        {/* Theme toggle - expanded hit area */}
        <button
          onClick={onThemeToggle}
          className={cn(
            "rounded-lg",
            "hover:bg-accent active:scale-95",
            "transition-colors duration-150",
            "text-foreground",
            "focus-visible:ring-2 focus-visible:ring-ring"
          )}
          style={{ padding: 8 }}
          aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
        >
          {isDark ? (
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
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          )}
        </button>
      </div>

      {/* Main content area - empty */}
      <div className="flex-1">
        {/* Empty content */}
      </div>

      {/* Bottom bar area */}
      <div style={{ height: 40, marginTop: 12 }}>
        {/* Empty bottom bar */}
      </div>
    </div>
  )
}
