interface ScoreDisplayProps {
  leftLabel: string
  leftScore: number
  rightLabel: string
  rightScore: number
  activePlayer?: 'left' | 'right' | null
  maxScore?: number
}

export default function ScoreDisplay({
  leftLabel,
  leftScore,
  rightLabel,
  rightScore,
  activePlayer,
  maxScore
}: ScoreDisplayProps) {
  const formatScore = (score: number) =>
    maxScore ? `${score}/${maxScore}` : score

  return (
    <div className="game-header">
      <span className={`score-left ${activePlayer === 'left' ? 'active' : ''}`}>
        {leftLabel} {formatScore(leftScore)}
      </span>
      <span className={`score-right ${activePlayer === 'right' ? 'active' : ''}`}>
        {rightLabel} {formatScore(rightScore)}
      </span>
    </div>
  )
}
