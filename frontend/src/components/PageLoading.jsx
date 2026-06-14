import { useEffect, useState } from 'react';

const CATEGORY_COLORS = ['#e6c642', '#f94e4e', '#685af5', '#3ce956', '#307de7', '#a656fd', '#e857ed', '#56cfef', '#ff8c42', '#4ecdc4', '#45b7d1'];
const TIPS = [
	'Did you know? You can create your own quizzes!',
	'Tip: Read all answers before choosing one',
	'Fun fact: QAI has infinite possible questions!',
	'Hint: Speed matters — answer faster for more XP',
	'Pro tip: Use AI Coach to level up your skills',
	'Challenge your friends to beat your score!',
];

const EXIT_DURATION = 600; // ms — matches the CSS exit animation

/**
 * Full-screen game loading overlay with smooth enter/exit transitions.
 *
 * @param {object}  props
 * @param {boolean} [props.visible] – Controls visibility with an animated exit.
 *   • If omitted/undefined the component stays visible (legacy mount/unmount usage).
 *   • When set to `false`, a fade-out plays before the component unmounts itself.
 */
export default function PageLoading({ visible }) {
	const [dots, setDots] = useState('');
	const [tipIndex, setTipIndex] = useState(0);
	const [barWidth, setBarWidth] = useState(0);

	// --- Transition state machine ---
	// phase: 'enter' → 'idle' → 'exit' → 'gone'
	const [phase, setPhase] = useState(() => (visible === false ? 'gone' : 'enter'));

	// Handle the visible prop driving enter/exit
	useEffect(() => {
		if (visible === true && phase === 'gone') {
			// Re-enter: reset state for a fresh entrance
			setBarWidth(0);
			setPhase('enter');
			requestAnimationFrame(() => setPhase('idle'));
		} else if (visible === false && phase !== 'exit' && phase !== 'gone') {
			setPhase('exit');
			const timer = setTimeout(() => setPhase('gone'), EXIT_DURATION);
			return () => clearTimeout(timer);
		}
	}, [visible, phase]);

	// Entrance transition (first mount only)
	useEffect(() => {
		if (phase === 'enter') {
			const t = requestAnimationFrame(() => setPhase('idle'));
			return () => cancelAnimationFrame(t);
		}
	}, []);

	useEffect(() => {
		if (phase === 'gone') return;
		const dotTimer = setInterval(() => setDots(d => (d.length >= 3 ? '' : d + '.')), 500);
		const tipTimer = setInterval(() => setTipIndex(i => (i + 1) % TIPS.length), 4000);
		const barTimer = setInterval(() => {
			setBarWidth(prev => {
				if (prev >= 92) return prev + 0.15;
				if (prev >= 70) return prev + 0.4;
				return prev + Math.random() * 6 + 2;
			});
		}, 180);
		return () => { clearInterval(dotTimer); clearInterval(tipTimer); clearInterval(barTimer); };
	}, [phase === 'gone']);

	// When fully gone, render nothing
	if (phase === 'gone') return null;

	const isExiting = phase === 'exit';

	return (
		<div
			className="mainHome bg-vertical-scroll-animation fixed inset-0 z-[9999] flex flex-col items-center justify-center cursor-progress overflow-hidden !bg-[length:30rem]"
			style={{
				opacity: isExiting ? 0 : 1,
				transition: `opacity ${EXIT_DURATION}ms ease-in-out`,
			}}
		>
			{/* Keyframes */}
			<style>{`
				@keyframes gl-bounce {
					0%, 100% { transform: translateY(0); }
					50% { transform: translateY(-18px); }
				}
				@keyframes gl-pulse-ring {
					0% { transform: scale(0.8); opacity: 1; }
					100% { transform: scale(2.2); opacity: 0; }
				}
				@keyframes gl-float-up {
					0% { transform: translateY(0) scale(1); opacity: 0.7; }
					100% { transform: translateY(-100vh) scale(0.3); opacity: 0; }
				}
				@keyframes gl-shimmer {
					0% { background-position: -200% center; }
					100% { background-position: 200% center; }
				}
				@keyframes gl-fade-in {
					from { opacity: 0; transform: translateY(20px); }
					to { opacity: 1; transform: translateY(0); }
				}
				@keyframes gl-tip-slide {
					0% { opacity: 0; transform: translateY(10px); }
					10% { opacity: 1; transform: translateY(0); }
					90% { opacity: 1; transform: translateY(0); }
					100% { opacity: 0; transform: translateY(-10px); }
				}
				@keyframes gl-bar-shine {
					0% { left: -40%; }
					100% { left: 140%; }
				}
				@keyframes gl-icon-spin {
					0% { transform: rotate(0deg) scale(1); }
					25% { transform: rotate(90deg) scale(1.1); }
					50% { transform: rotate(180deg) scale(1); }
					75% { transform: rotate(270deg) scale(1.1); }
					100% { transform: rotate(360deg) scale(1); }
				}
				@keyframes gl-exit-scale {
					to { transform: scale(0.92) translateY(-10px); opacity: 0; }
				}
			`}</style>

			{/* Rising bubbles */}
			{CATEGORY_COLORS.map((color, i) => (
				<div
					key={i}
					style={{
						position: 'absolute',
						bottom: '-20px',
						left: `${8 + i * 8}%`,
						width: `${10 + (i % 3) * 8}px`,
						height: `${10 + (i % 3) * 8}px`,
						borderRadius: '50%',
						background: color,
						opacity: 0.25,
						filter: 'blur(2px)',
						animation: `gl-float-up ${6 + i * 1.2}s ease-in ${i * 0.6}s infinite`,
					}}
				/>
			))}

			{/* Main content */}
			<div
				style={{
					display: 'flex',
					flexDirection: 'column',
					alignItems: 'center',
					gap: '20px',
					animation: isExiting
						? `gl-exit-scale ${EXIT_DURATION}ms ease-in forwards`
						: 'gl-fade-in 0.5s ease-out forwards',
				}}
			>
				{/* Bouncing QAI letters */}
				<div style={{ display: 'flex', gap: '4px', marginBottom: '8px', position: 'relative' }}>
					{/* Pulse rings behind letters */}
					<div
						style={{
							position: 'absolute',
							top: '50%',
							left: '50%',
							width: '80px',
							height: '80px',
							marginTop: '-40px',
							marginLeft: '-40px',
							borderRadius: '50%',
							border: '3px solid rgba(59, 130, 246, 0.3)',
							animation: 'gl-pulse-ring 2s ease-out infinite',
						}}
					/>
					<div
						style={{
							position: 'absolute',
							top: '50%',
							left: '50%',
							width: '80px',
							height: '80px',
							marginTop: '-40px',
							marginLeft: '-40px',
							borderRadius: '50%',
							border: '3px solid rgba(104, 90, 245, 0.2)',
							animation: 'gl-pulse-ring 2s ease-out 0.7s infinite',
						}}
					/>
					{'QAI'.split('').map((letter, i) => (
						<span
							key={i}
							style={{
								fontSize: '72px',
								fontWeight: 700,
								color: '#fff',
								textShadow: `0 0 30px ${CATEGORY_COLORS[i * 3]}, 0 4px 0 rgba(0,0,0,0.3)`,
								animation: `gl-bounce 1.2s ease-in-out ${i * 0.15}s infinite`,
								display: 'inline-block',
								position: 'relative',
								zIndex: 1,
								letterSpacing: '0.05em',
								textTransform: 'uppercase',
							}}
						>
							{letter}
						</span>
					))}
				</div>

				{/* Loading icon + text */}
				<div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
					<div
						style={{
							width: '28px',
							height: '28px',
							borderRadius: '50%',
							background: 'linear-gradient(135deg, #3b82f6, #685af5)',
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'center',
							fontSize: '16px',
							fontWeight: 800,
							color: '#fff',
							animation: 'gl-icon-spin 3s ease-in-out infinite',
							boxShadow: '0 0 16px rgba(59,130,246,0.4)',
						}}
					>
						?
					</div>
					<span
						style={{
							fontSize: '18px',
							fontWeight: 700,
							letterSpacing: '0.2em',
							textTransform: 'uppercase',
							color: '#fff',
							textShadow: '0 2px 8px rgba(0,0,0,0.4)',
						}}
					>
						Loading{dots}
					</span>
				</div>

				{/* Progress bar */}
				<div
					style={{
						width: '280px',
						height: '18px',
						borderRadius: '10px',
						background: 'rgba(0,0,0,0.4)',
						border: '2px solid rgba(255,255,255,0.1)',
						overflow: 'hidden',
						position: 'relative',
						boxShadow: 'inset 0 3px 6px rgba(0,0,0,0.4)',
					}}
				>
					<div
						style={{
							height: '100%',
							borderRadius: '8px',
							width: isExiting ? '100%' : `${Math.min(barWidth, 100)}%`,
							background: 'linear-gradient(90deg, #3b82f6, #685af5, #a656fd)',
							transition: isExiting ? `width ${EXIT_DURATION * 0.4}ms ease-out` : 'width 0.2s ease-out',
							position: 'relative',
							boxShadow: '0 2px 0 rgba(37,99,235,0.6), 0 0 20px rgba(59,130,246,0.3)',
						}}
					>
						<div
							style={{
								position: 'absolute',
								top: '2px',
								left: '-40%',
								width: '30%',
								height: '40%',
								borderRadius: '10px',
								background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)',
								animation: 'gl-bar-shine 1.8s ease-in-out infinite',
							}}
						/>
					</div>
				</div>

				{/* Rotating game tips */}
				<p
					key={tipIndex}
					style={{
						margin: 0,
						marginTop: '12px',
						fontSize: '13px',
						fontWeight: 500,
						color: 'rgba(255,255,255,0.55)',
						textAlign: 'center',
						maxWidth: '320px',
						lineHeight: '1.5',
						animation: 'gl-tip-slide 4s ease-in-out forwards',
						fontStyle: 'italic',
					}}
				>
					💡 {TIPS[tipIndex]}
				</p>
			</div>
		</div>
	);
}
