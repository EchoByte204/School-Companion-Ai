import { cn } from "@/lib/utils";
import type { AppRole } from "../personas";
import { PERSONAS } from "../personas";

type AiAvatarProps = {
  role: AppRole;
  /** 0-1 audio level; drives mouth openness for lip-sync. */
  level?: number;
  state?: "idle" | "listening" | "thinking" | "speaking";
  className?: string;
};

/**
 * Lightweight 2D SVG avatar. The mouth height follows live audio amplitude so
 * the face appears to speak the assistant's words, and the eyes blink on a
 * CSS keyframe so it never looks frozen.
 */
export function AiAvatar({ role, level = 0, state = "idle", className }: AiAvatarProps) {
  const persona = PERSONAS[role];
  const openness = Math.min(1, Math.max(0, level * 2.4));
  const mouthHeight = state === "speaking" ? 3 + openness * 13 : 3.5;
  const mouthWidth = state === "speaking" ? 20 - openness * 4 : 20;

  return (
    <div className={cn("relative", className)}>
      <div
        className={cn(
          "absolute inset-0 rounded-full blur-2xl transition-opacity duration-500",
          state === "idle" ? "opacity-25" : "opacity-60",
        )}
        style={{ background: persona.accent }}
        aria-hidden="true"
      />
      <svg
        viewBox="0 0 120 120"
        className="relative size-full drop-shadow-sm"
        role="img"
        aria-label={`${persona.name}, ${persona.title} avatar`}
      >
        <defs>
          <radialGradient id={`face-${role}`} cx="40%" cy="30%" r="80%">
            <stop offset="0%" stopColor="var(--color-card)" />
            <stop offset="100%" stopColor="var(--color-surface)" />
          </radialGradient>
        </defs>

        <circle
          cx="60"
          cy="60"
          r="55"
          fill="none"
          stroke={persona.accent}
          strokeWidth="2"
          strokeDasharray="6 10"
          className={
            state === "thinking" ? "origin-center animate-spin [animation-duration:9s]" : ""
          }
          opacity="0.5"
        />
        <circle
          cx="60"
          cy="62"
          r="42"
          fill={`url(#face-${role})`}
          stroke={persona.accent}
          strokeWidth="2.5"
        />

        {/* hair / turban-free simple head cap for a neutral, friendly look */}
        <path
          d="M20 54a40 40 0 0 1 80 0c-10-14-24-20-40-20S30 40 20 54Z"
          fill={persona.accent}
          opacity="0.85"
        />

        {/* eyes */}
        <g className="xyz-blink" fill="var(--color-foreground)">
          <ellipse cx="46" cy="60" rx="3.6" ry="4.4" />
          <ellipse cx="74" cy="60" rx="3.6" ry="4.4" />
        </g>

        {/* brows lift while listening */}
        <g stroke="var(--color-foreground)" strokeWidth="2" strokeLinecap="round" opacity="0.7">
          <path d={state === "listening" ? "M40 50h12" : "M40 52h12"} />
          <path d={state === "listening" ? "M68 50h12" : "M68 52h12"} />
        </g>

        {/* cheeks */}
        <circle cx="40" cy="74" r="5" fill={persona.accent} opacity="0.25" />
        <circle cx="80" cy="74" r="5" fill={persona.accent} opacity="0.25" />

        {/* mouth: height tracks audio amplitude */}
        <rect
          x={60 - mouthWidth / 2}
          y={82 - mouthHeight / 2}
          width={mouthWidth}
          height={mouthHeight}
          rx={mouthHeight / 2}
          fill="var(--color-foreground)"
          opacity="0.85"
          style={{ transition: "all 70ms linear" }}
        />
      </svg>
      <style>{`
        @keyframes xyz-blink { 0%, 92%, 100% { transform: scaleY(1); } 96% { transform: scaleY(0.1); } }
        .xyz-blink { animation: xyz-blink 5.5s infinite; transform-origin: center 60px; }
      `}</style>
    </div>
  );
}
