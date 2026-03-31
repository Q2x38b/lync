import { cn } from "../lib/utils"

export function RightPanel() {
  return (
    <div
      className={cn(
        "h-full w-full",
        "flex flex-col"
      )}
      style={{ padding: 16 }}
    >
      {/* Header area */}
      <div style={{ height: 40, marginBottom: 12 }}>
        {/* Empty header */}
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-hidden">
        {/* Empty content */}
      </div>

      {/* Bottom input area */}
      <div style={{ height: 40, marginTop: 12 }}>
        {/* Empty input area */}
      </div>
    </div>
  )
}
