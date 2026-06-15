import { useMemo, useRef } from 'react'
import categories from '@/assets/categories.json'
import { useBoundStore } from '@/store/useBoundStore'

const DEFAULT_COLOR = '#3b82f6'

/**
 * Generates HSL variations of a hex color for ambient effects.
 */
function hexToHSL(hex) {
	let r = parseInt(hex.slice(1, 3), 16) / 255
	let g = parseInt(hex.slice(3, 5), 16) / 255
	let b = parseInt(hex.slice(5, 7), 16) / 255
	const max = Math.max(r, g, b), min = Math.min(r, g, b)
	let h, s, l = (max + min) / 2
	if (max === min) { h = s = 0 }
	else {
		const d = max - min
		s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
		if (max === r) { h = ((g - b) / d + (g < b ? 6 : 0)) / 6 }
		else if (max === g) { h = ((b - r) / d + 2) / 6 }
		else { h = ((r - g) / d + 4) / 6 }
	}
	return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) }
}

// 16 particles with varied sizes, positions, and timing
const PARTICLE_COUNT = 16

/**
 * @param {{ effects: { gradient: boolean, pattern: boolean, shimmer: boolean, particles: boolean } }} props
 */
export default function PlayBackground({ effects }) {
	const { queries } = useBoundStore(state => state)

	const categoryId = queries.categories?.[0]
	const category = categoryId ? categories.find(c => c.id === categoryId) : null
	const rawColor = category?.color || null

	// Remember the last real category color so null-category questions
	// keep the previous background instead of snapping to the default.
	const lastColorRef = useRef(null)
	if (rawColor && rawColor !== DEFAULT_COLOR) {
		lastColorRef.current = rawColor
	}
	const color = rawColor || lastColorRef.current || DEFAULT_COLOR

	const hsl = useMemo(() => hexToHSL(color), [color])

	// Pre-compute particle configs so they don't change on re-render
	const particles = useMemo(() => {
		return Array.from({ length: PARTICLE_COUNT }, (_, i) => {
			const size = 6 + (i % 5) * 6 + Math.floor(i / 5) * 3
			const left = (i * 6.25) % 100
			const duration = 8 + (i % 4) * 3 + (i % 3) * 2
			const delay = (i * 0.7) % 6
			const hueShift = (i % 3 - 1) * 15
			const opacity = 0.32 + (i % 3) * 0.06
			return { size, left, duration, delay, hueShift, opacity }
		})
	}, [])

	// If every effect is turned off, render nothing
	const showGradient = effects?.gradient !== false
	const showPattern = effects?.pattern !== false
	const showShimmer = effects?.shimmer !== false
	const showParticles = effects?.particles !== false

	if (!showGradient && !showPattern && !showShimmer && !showParticles) return null

	return (
		<div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
			{/* Keyframes */}
			<style>{`
				@keyframes play-float-up {
					0% { transform: translateY(0) scale(1) rotate(0deg); opacity: var(--p-opacity); }
					50% { transform: translateY(-50vh) scale(0.7) rotate(180deg); opacity: calc(var(--p-opacity) * 0.6); }
					100% { transform: translateY(-110vh) scale(0.2) rotate(360deg); opacity: 0; }
				}
				@keyframes play-drift {
					0%, 100% { transform: translateX(0); }
					50% { transform: translateX(30px); }
				}
				@keyframes play-gradient-shift {
					0% { background-position: 0% 0%; }
					50% { background-position: 100% 100%; }
					100% { background-position: 0% 0%; }
				}
				@keyframes play-pattern-scroll {
					from { background-position: 0 0; }
					to { background-position: 0 200%; }
				}
				@keyframes play-shimmer {
					0% { opacity: 0.03; }
					50% { opacity: 0.08; }
					100% { opacity: 0.03; }
				}
			`}</style>

			{/* Animated gradient underlay */}
			{showGradient && (
				<div
					style={{
						position: 'absolute',
						inset: 0,
						background: `
							radial-gradient(ellipse 80% 60% at 20% 80%, hsla(${hsl.h}, ${hsl.s}%, ${Math.min(hsl.l + 15, 70)}%, 0.15) 0%, transparent 70%),
							radial-gradient(ellipse 60% 80% at 80% 20%, hsla(${(hsl.h + 30) % 360}, ${hsl.s}%, ${Math.min(hsl.l + 10, 65)}%, 0.12) 0%, transparent 70%),
							radial-gradient(ellipse 50% 50% at 50% 50%, hsla(${(hsl.h - 20 + 360) % 360}, ${hsl.s}%, ${Math.min(hsl.l + 5, 60)}%, 0.08) 0%, transparent 60%)
						`,
						backgroundSize: '200% 200%',
						animation: 'play-gradient-shift 20s ease-in-out infinite',
					}}
				/>
			)}

			{/* Scrolling SVG pattern overlay (like PageLoading's bg-vertical-scroll-animation) */}
			{showPattern && (
				<div
					style={{
						position: 'absolute',
						inset: 0,
						backgroundImage: "url('/bg-home.svg')",
						backgroundSize: '28rem',
						backgroundRepeat: 'repeat',
						animation: 'play-pattern-scroll 40s linear infinite',
						opacity: 0.08,
					}}
				/>
			)}

			{/* Subtle shimmer vignette */}
			{showShimmer && (
				<div
					style={{
						position: 'absolute',
						inset: 0,
						background: `radial-gradient(ellipse at center, transparent 40%, hsla(${hsl.h}, ${hsl.s}%, ${Math.max(hsl.l - 20, 10)}%, 0.3) 100%)`,
						animation: 'play-shimmer 8s ease-in-out infinite',
					}}
				/>
			)}

			{/* Floating particles */}
			{showParticles && particles.map((p, i) => (
				<div
					key={i}
					style={{
						position: 'absolute',
						bottom: '-30px',
						left: `${p.left}%`,
						width: `${p.size}px`,
						height: `${p.size}px`,
						borderRadius: i % 3 === 0 ? '30%' : '50%',
						background: `hsla(${hsl.h + p.hueShift}, ${Math.min(hsl.s + 10, 100)}%, ${Math.min(hsl.l + 20, 80)}%, 0.7)`,
						'--p-opacity': p.opacity,
						opacity: p.opacity,
						filter: `blur(${1 + (i % 3)}px)`,
						animation: `play-float-up ${p.duration}s ease-in ${p.delay}s infinite`,
					}}
				>
					{/* Horizontal drift nested inside */}
					<div
						style={{
							width: '100%',
							height: '100%',
							animation: `play-drift ${3 + (i % 4) * 2}s ease-in-out ${p.delay}s infinite`,
						}}
					/>
				</div>
			))}
		</div>
	)
}
