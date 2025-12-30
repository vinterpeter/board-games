import React from 'react'

type SuitType = 'acorn' | 'bell' | 'leaf' | 'heart'

interface SuitIconProps {
  suit: SuitType
  size?: number | string
  color?: string
  className?: string
}

const defaultColors: Record<SuitType, string> = {
  acorn: '#8B4513',  // Brown
  bell: '#DAA520',   // Goldenrod
  leaf: '#228B22',   // Forest green
  heart: '#DC143C',  // Crimson
}

// Inline SVG components for each suit - matching the SVG files in assets/suits/
const AcornIcon = (_props: { color: string }) => (
  <svg viewBox="0 0 100 100">
    {/* Yellow ball (cap) */}
    <circle cx="50" cy="42" r="32" fill="#f9e324" stroke="#000" strokeWidth="1"/>
    {/* Red stripe across */}
    <path d="M20 38 Q50 28 80 38 L80 52 Q50 42 20 52 Z" fill="#ff0000" stroke="#000" strokeWidth="0.5"/>
    {/* Stem */}
    <path d="M44 12 Q50 8 56 12 L54 20 Q50 22 46 20 Z" fill="#000"/>
    {/* Green leaf decoration at bottom */}
    <path d="M50 74 Q30 78 26 88 Q32 82 50 80 Q68 82 74 88 Q70 78 50 74" fill="#008000" stroke="#000" strokeWidth="0.5"/>
    <path d="M42 80 Q38 90 34 94 Q40 88 46 84" fill="#008000" stroke="#000" strokeWidth="0.5"/>
    <path d="M58 80 Q62 90 66 94 Q60 88 54 84" fill="#008000" stroke="#000" strokeWidth="0.5"/>
  </svg>
)

const BellIcon = ({ color }: { color: string }) => (
  <svg viewBox="0 0 100 100">
    {/* Top loop */}
    <rect x="44" y="5" width="12" height="12" rx="4" fill={color}/>
    {/* Bell body */}
    <path d="M20 55 Q20 25 50 20 Q80 25 80 55 Q80 75 50 85 Q20 75 20 55 Z" fill={color}/>
    {/* Inner shadow/hole */}
    <ellipse cx="50" cy="50" rx="20" ry="24" fill="none" stroke="rgba(0,0,0,0.3)" strokeWidth="6"/>
    {/* Clapper */}
    <circle cx="50" cy="80" r="7" fill={color}/>
    <rect x="48" y="60" width="4" height="22" fill={color}/>
    {/* Highlight */}
    <path d="M30 40 Q35 30 45 28" stroke="rgba(255,255,255,0.3)" strokeWidth="3" fill="none" strokeLinecap="round"/>
  </svg>
)

const LeafIcon = ({ color }: { color: string }) => (
  <svg viewBox="0 0 100 100">
    {/* Main leaf shape */}
    <path d="M50 8 Q85 25 80 55 Q75 80 50 95 Q25 80 20 55 Q15 25 50 8 Z" fill={color}/>
    {/* Center vein */}
    <path d="M50 20 L50 85" stroke="rgba(0,0,0,0.2)" strokeWidth="3" fill="none"/>
    {/* Side veins */}
    <path d="M50 35 Q32 42 25 52" stroke="rgba(0,0,0,0.15)" strokeWidth="2" fill="none"/>
    <path d="M50 35 Q68 42 75 52" stroke="rgba(0,0,0,0.15)" strokeWidth="2" fill="none"/>
    <path d="M50 50 Q35 56 28 65" stroke="rgba(0,0,0,0.15)" strokeWidth="2" fill="none"/>
    <path d="M50 50 Q65 56 72 65" stroke="rgba(0,0,0,0.15)" strokeWidth="2" fill="none"/>
    <path d="M50 65 Q40 70 35 78" stroke="rgba(0,0,0,0.15)" strokeWidth="2" fill="none"/>
    <path d="M50 65 Q60 70 65 78" stroke="rgba(0,0,0,0.15)" strokeWidth="2" fill="none"/>
    {/* Highlight */}
    <path d="M35 25 Q42 18 50 15" stroke="rgba(255,255,255,0.25)" strokeWidth="3" fill="none" strokeLinecap="round"/>
  </svg>
)

const HeartIcon = ({ color }: { color: string }) => (
  <svg viewBox="0 0 100 100">
    {/* Main heart shape */}
    <path d="M50 92 C15 60 5 35 18 20 C32 5 50 12 50 28 C50 12 68 5 82 20 C95 35 85 60 50 92 Z" fill={color}/>
    {/* Highlight */}
    <path d="M28 30 Q32 18 42 15" stroke="rgba(255,255,255,0.3)" strokeWidth="4" fill="none" strokeLinecap="round"/>
    <ellipse cx="30" cy="35" rx="8" ry="10" fill="rgba(255,255,255,0.15)"/>
  </svg>
)

export default function SuitIcon({ suit, size = 24, color, className }: SuitIconProps) {
  const iconColor = color || defaultColors[suit]
  const sizeValue = typeof size === 'number' ? `${size}px` : size

  const style = {
    width: sizeValue,
    height: sizeValue,
    display: 'inline-block',
  }

  const icons: Record<SuitType, React.ReactNode> = {
    acorn: <AcornIcon color={iconColor} />,
    bell: <BellIcon color={iconColor} />,
    leaf: <LeafIcon color={iconColor} />,
    heart: <HeartIcon color={iconColor} />,
  }

  return (
    <span className={className} style={style}>
      {icons[suit]}
    </span>
  )
}

export { SuitIcon }
export type { SuitType }
