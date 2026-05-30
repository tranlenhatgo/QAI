import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useBoundStore } from '@/store/useBoundStore'

const TIERS = [
	{
		id: 'lite',
		label: 'Lite',
		description: 'Local AI (LM Studio)',
		icon: '⚡',
		color: 'from-emerald-400 to-teal-500',
		border: 'border-emerald-400',
		bg: 'bg-emerald-50',
		text: 'text-emerald-700',
		badge: 'bg-emerald-100 text-emerald-700',
	},
	{
		id: 'full',
		label: 'Full',
		description: 'Cloud AI (DeepSeek)',
		icon: '🚀',
		color: 'from-violet-500 to-indigo-600',
		border: 'border-violet-400',
		bg: 'bg-violet-50',
		text: 'text-violet-700',
		badge: 'bg-violet-100 text-violet-700',
	},
]

export default function TierSelector() {
	const [open, setOpen] = useState(false)
	const { coachTier, setCoachTier } = useBoundStore(state => state)
	const currentTier = TIERS.find(t => t.id === coachTier) || TIERS[0]

	function handleSelect(tier) {
		setCoachTier(tier.id)
		setOpen(false)
	}

	return (
		<>
			<button
				type="button"
				onClick={() => setOpen(true)}
				className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold border transition-all hover:scale-105 ${currentTier.border} ${currentTier.bg} ${currentTier.text}`}
				title="Change AI tier"
			>
				<span>{currentTier.icon}</span>
				<span>{currentTier.label}</span>
			</button>

			{open && createPortal(
				<div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)}>
					<div className="w-80 rounded-2xl bg-white p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
						<h3 className="mb-1 text-center text-lg font-bold text-slate-800">Select AI Tier</h3>
						<p className="mb-5 text-center text-xs text-slate-500">Choose the AI model for Coach & Chat</p>
						<div className="flex flex-col gap-3">
							{TIERS.map(tier => {
								const isActive = coachTier === tier.id
								return (
									<button
										key={tier.id}
										type="button"
										onClick={() => handleSelect(tier)}
										className={`relative flex items-center gap-4 rounded-xl border-2 p-4 text-left transition-all hover:scale-[1.02] ${
											isActive
												? `${tier.border} shadow-md`
												: 'border-gray-200 hover:border-gray-300'
										}`}
									>
										<div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${tier.color} text-2xl shadow-sm`}>
											{tier.icon}
										</div>
										<div className="flex-1">
											<p className="text-sm font-bold text-slate-800">{tier.label}</p>
											<p className="text-xs text-slate-500">{tier.description}</p>
										</div>
										{isActive && (
											<span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${tier.badge}`}>
												Active
											</span>
										)}
									</button>
								)
							})}
						</div>
						<button
							type="button"
							onClick={() => setOpen(false)}
							className="mt-4 w-full rounded-lg bg-gray-100 py-2 text-sm font-medium text-slate-600 hover:bg-gray-200"
						>
							Cancel
						</button>
					</div>
				</div>,
				document.body
			)}
		</>
	)
}
