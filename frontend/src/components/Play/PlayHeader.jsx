import { BiArrowBack } from 'react-icons/bi'
import { BsArrowRepeat } from 'react-icons/bs'
import Link from 'next/link'
import { useState } from 'react'
import { useBoundStore } from '@/store/useBoundStore'

export default function PlayHeader ({ bgEffects, onToggleEffect, onToggleAll }) {
	const { cleanQuestions, cleanWildCards, cleanQueries } = useBoundStore(state => state)
	const [showBgPanel, setShowBgPanel] = useState(false)

	const allOn = bgEffects && Object.values(bgEffects).every(Boolean)
	const allOff = bgEffects && Object.values(bgEffects).every(v => !v)

	return (
		<nav className='fixed top-4 left-4 z-20'>
			<ul className='flex gap-2'>
				<li>
					<Link href="/" className='group flex items-center justify-center w-10 h-10 bg-white rounded-xl transition-all duration-300 hover:scale-110 active:scale-95 shadow-sm hover:shadow-md'
						onClick={() => { cleanQuestions(); cleanWildCards(); cleanQueries() }}
						title='Go back'
					>
						<BiArrowBack className='text-xl text-slate-900 group-hover:text-blue-500 transition-colors' />
					</Link>
				</li>
				<li>
					<button
						className='group flex items-center justify-center w-10 h-10 bg-white rounded-xl transition-all duration-300 hover:scale-110 hover:rotate-180 active:scale-95 shadow-sm hover:shadow-md'
						onClick={() => document.getElementById('newGameDialog').showModal()}
						title='New game'
					>
						<BsArrowRepeat className='text-xl text-slate-900 group-hover:text-blue-500 transition-colors' />
					</button>
				</li>

				{/* Background effects toggle */}
				{bgEffects && (
					<li className="relative">
						<button
							id="bg-effects-toggle"
							title="Background effects"
							onClick={() => setShowBgPanel(p => !p)}
							className="group flex items-center justify-center w-10 h-10 bg-white rounded-xl transition-all duration-300 hover:scale-110 active:scale-95 shadow-sm hover:shadow-md"
						>
							<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"
								style={{ opacity: allOff ? 0.4 : 1, transition: 'opacity 0.3s' }}
							>
								<path d="M10 1L11.5 7.5L18 9L11.5 10.5L10 17L8.5 10.5L2 9L8.5 7.5L10 1Z"
									fill={allOff ? '#94a3b8' : '#6366f1'} stroke={allOff ? '#94a3b8' : '#6366f1'} strokeWidth="0.5" />
								<path d="M16 2L16.6 4.4L19 5L16.6 5.6L16 8L15.4 5.6L13 5L15.4 4.4L16 2Z"
									fill={allOff ? '#94a3b8' : '#a78bfa'} stroke="none" opacity="0.7" />
								<path d="M4 13L4.4 14.6L6 15L4.4 15.4L4 17L3.6 15.4L2 15L3.6 14.6L4 13Z"
									fill={allOff ? '#94a3b8' : '#a78bfa'} stroke="none" opacity="0.5" />
							</svg>
						</button>

						{/* Dropdown panel */}
						<div
							id="bg-effects-panel"
							className="absolute top-12 left-0 transition-all duration-300 origin-top-left"
							style={{
								transform: showBgPanel ? 'scale(1) translateY(0)' : 'scale(0.9) translateY(-8px)',
								opacity: showBgPanel ? 1 : 0,
								pointerEvents: showBgPanel ? 'auto' : 'none',
								background: 'rgba(255,255,255,0.92)',
								backdropFilter: 'blur(20px)',
								borderRadius: '16px',
								border: '1px solid rgba(200,200,220,0.35)',
								boxShadow: '0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)',
								padding: '16px',
								minWidth: '200px',
							}}
						>
							<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
								<span style={{ fontSize: '12px', fontWeight: 700, color: '#334155', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
									Effects
								</span>
								<button
									id="bg-effects-toggle-all"
									onClick={onToggleAll}
									style={{
										fontSize: '11px',
										fontWeight: 600,
										color: allOn ? '#ef4444' : '#6366f1',
										background: 'none',
										border: 'none',
										cursor: 'pointer',
										padding: '2px 6px',
										borderRadius: '6px',
										transition: 'background 0.2s',
									}}
									onMouseEnter={e => { e.currentTarget.style.background = 'rgba(99,102,241,0.08)' }}
									onMouseLeave={e => { e.currentTarget.style.background = 'none' }}
								>
									{allOn ? 'Turn All Off' : 'Turn All On'}
								</button>
							</div>

							{[
								{ key: 'gradient', label: 'Gradient', icon: '🌈' },
								{ key: 'pattern', label: 'Pattern', icon: '🔲' },
								{ key: 'shimmer', label: 'Shimmer', icon: '✨' },
								{ key: 'particles', label: 'Particles', icon: '🫧' },
							].map(({ key, label, icon }) => (
								<button
									id={`bg-effect-${key}`}
									key={key}
									onClick={() => onToggleEffect(key)}
									style={{
										display: 'flex',
										alignItems: 'center',
										gap: '10px',
										width: '100%',
										padding: '8px 10px',
										marginBottom: '4px',
										borderRadius: '10px',
										border: 'none',
										cursor: 'pointer',
										background: bgEffects[key] ? 'rgba(99,102,241,0.08)' : 'transparent',
										transition: 'all 0.2s',
										textAlign: 'left',
									}}
									onMouseEnter={e => { if (!bgEffects[key]) e.currentTarget.style.background = 'rgba(0,0,0,0.03)' }}
									onMouseLeave={e => { if (!bgEffects[key]) e.currentTarget.style.background = 'transparent' }}
								>
									<span style={{ fontSize: '16px', lineHeight: 1 }}>{icon}</span>
									<span style={{
										flex: 1,
										fontSize: '13px',
										fontWeight: 600,
										color: bgEffects[key] ? '#334155' : '#94a3b8',
										transition: 'color 0.2s',
									}}>
										{label}
									</span>
									{/* Toggle pill */}
									<div style={{
										width: '36px',
										height: '20px',
										borderRadius: '10px',
										background: bgEffects[key]
											? 'linear-gradient(135deg, #6366f1, #8b5cf6)'
											: '#e2e8f0',
										position: 'relative',
										transition: 'background 0.3s',
										flexShrink: 0,
									}}>
										<div style={{
											width: '16px',
											height: '16px',
											borderRadius: '50%',
											background: '#fff',
											position: 'absolute',
											top: '2px',
											left: bgEffects[key] ? '18px' : '2px',
											transition: 'left 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
											boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
										}} />
									</div>
								</button>
							))}
						</div>
					</li>
				)}
			</ul>
		</nav>
	)
}
