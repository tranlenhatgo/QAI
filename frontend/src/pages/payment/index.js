import Head from 'next/head'
import { useCallback, useRef, useState } from 'react'
import { useRouter } from 'next/router'
import ReactCanvasConfetti from 'react-canvas-confetti'
import { FiArrowLeft, FiBookOpen, FiCheck, FiCreditCard, FiRepeat, FiStar, FiZap } from 'react-icons/fi'
import { useBoundStore } from '@/store/useBoundStore'

const PLANS = [
	{
		id: 'monthly',
		name: '1 Month',
		price: '$2',
		period: '30 days of Full mode',
		description: 'Good for a short exam sprint or project week.',
		kicker: 'Sprint',
		icon: FiZap,
		cardClassName: 'border-blue-200 bg-gradient-to-b from-white to-blue-50/80 shadow-[0_4px_0_#bfdbfe]',
		iconClassName: 'bg-blue-600 text-white shadow-[0_3px_0_#1d4ed8]',
		badgeClassName: 'border-blue-200 bg-blue-50 text-blue-700',
		buttonClassName: 'btn-primary before:!bg-blue-700 !bg-blue-500',
		detailClassName: 'bg-blue-500',
		perks: ['Fast upgrade', 'Exam sprint friendly', 'Cancel naturally after a month'],
	},
	{
		id: 'yearly',
		name: '1 Year',
		price: '$20',
		period: '12 months of Full mode',
		description: 'Best value for steady study and quiz creation.',
		kicker: 'Best value',
		icon: FiStar,
		cardClassName: 'border-violet-200 bg-gradient-to-b from-white via-violet-50/80 to-white shadow-[0_4px_0_#ddd6fe]',
		iconClassName: 'bg-gradient-to-br from-indigo-700 to-violet-600 text-white shadow-[0_3px_0_#5b21b6]',
		badgeClassName: 'border-violet-200 bg-violet-50 text-violet-700',
		buttonClassName: 'btn-primary before:!bg-violet-800 !bg-violet-600',
		detailClassName: 'bg-violet-500',
		perks: ['Lowest monthly cost', 'Steady study rhythm', 'Full generation all year'],
	},
	{
		id: 'forever',
		name: 'Forever',
		price: '$100',
		period: 'Lifetime Full mode',
		description: 'One payment for permanent Full access.',
		kicker: 'Lifetime',
		icon: FiBookOpen,
		cardClassName: 'border-emerald-200 bg-gradient-to-b from-white to-emerald-50/80 shadow-[0_4px_0_#bbf7d0]',
		iconClassName: 'bg-emerald-600 text-white shadow-[0_3px_0_#047857]',
		badgeClassName: 'border-emerald-200 bg-emerald-50 text-emerald-700',
		buttonClassName: 'btn-primary before:!bg-emerald-800 !bg-emerald-600',
		detailClassName: 'bg-emerald-500',
		perks: ['Permanent Full access', 'No renewal dates', 'Best for long-term use'],
	},
]

const confettiCanvasStyles = {
	position: 'fixed',
	pointerEvents: 'none',
	width: '100%',
	height: '100%',
	top: 0,
	left: 0,
	zIndex: 80,
}

export default function PaymentPage() {
	const router = useRouter()
	const { subscription, checkoutSubscription } = useBoundStore(state => state)
	const [selectedPlan, setSelectedPlan] = useState(null)
	const [isSubmitting, setIsSubmitting] = useState(false)
	const [error, setError] = useState('')
	const [successPlan, setSuccessPlan] = useState(null)
	const confettiRef = useRef(null)

	const getConfettiInstance = useCallback((instance) => {
		confettiRef.current = instance
	}, [])

	const party = useCallback((planId, sourceElement) => {
		const colorsByPlan = {
			monthly: ['#2563eb', '#60a5fa', '#ffffff'],
			yearly: ['#7c3aed', '#a78bfa', '#ffffff'],
			forever: ['#059669', '#34d399', '#ffffff'],
		}
		const colors = colorsByPlan[planId] || colorsByPlan.yearly
		const card = sourceElement?.closest?.('[data-plan-card]') || document.querySelector(`[data-plan-card="${planId}"]`) || sourceElement
		const rect = card?.getBoundingClientRect?.()
		const origin = rect
			? {
				x: Math.min(0.95, Math.max(0.05, (rect.left + rect.width / 2) / window.innerWidth)),
				y: Math.min(0.9, Math.max(0.1, (rect.top + rect.height / 2) / window.innerHeight)),
			}
			: { y: 0.65 }

		confettiRef.current?.({
			particleCount: 95,
			spread: 58,
			startVelocity: 38,
			origin,
			colors,
		})
	}, [])

	async function handleCheckout(plan, event) {
		const sourceElement = event.currentTarget
		setSelectedPlan(plan.id)
		setIsSubmitting(true)
		setError('')
		setSuccessPlan(null)
		try {
			const updatedSubscription = await checkoutSubscription(plan.id)
			setSuccessPlan(updatedSubscription?.plan || plan.id)
			party(plan.id, sourceElement)
		} catch (checkoutError) {
			setError(checkoutError?.message || 'Payment update failed')
		} finally {
			setIsSubmitting(false)
		}
	}

	return (
		<>
			<Head>
				<title>QAI | Full Subscription</title>
			</Head>
			<main className="min-h-screen bg-[#eef7fb] bg-[url('/bg-gamemodes.svg')] text-slate-900">
				<ReactCanvasConfetti refConfetti={getConfettiInstance} style={confettiCanvasStyles} />

				<header className="relative overflow-hidden border-b border-blue-300/20 bg-[#1c233a] bg-[url('/bg-home.svg')] bg-[length:560px] text-white shadow-xl">
					<div className="absolute inset-0 bg-gradient-to-r from-[#1c233a]/95 via-[#1c233a]/88 to-[#1c233a]/78" />
					<div className="relative mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 md:px-8">
						<button
							type="button"
							onClick={() => router.push('/coach')}
							className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md border border-white/25 bg-white text-slate-900 shadow-[0_3px_0_rgba(37,99,235,0.45)] transition-all hover:-translate-y-0.5 hover:bg-blue-50 active:translate-y-0 active:shadow-none"
							aria-label="Back to coach"
						>
							<FiArrowLeft />
						</button>
						<div className="min-w-0 flex-1">
							<h1 className="truncate text-xl font-bold tracking-wide">Full Subscription</h1>
							<p className="truncate text-xs font-medium text-blue-100">Mock checkout for AI Coach Full mode</p>
						</div>
						<div className="hidden rounded-md border border-white/20 bg-white/10 px-3 py-2 text-xs font-bold uppercase tracking-wider text-blue-100 sm:block">
							Current: {subscription?.plan || 'loading'}
						</div>
					</div>
				</header>

				<section className="mx-auto max-w-6xl px-4 py-6 md:px-8">
					<div className="mb-5 rounded-md border-2 border-blue-100 bg-white px-4 py-4 shadow-[0_4px_0_#dbeafe] md:flex md:items-center md:justify-between md:gap-4">
						<div>
							<p className="text-xs font-bold uppercase tracking-widest text-blue-700">Full mode unlock</p>
							<h2 className="text-2xl font-bold text-slate-900">Pick the plan that matches your study rhythm</h2>
							<p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
								This page simulates payment only. Choosing a plan updates your subscription through the backend and enables Full mode immediately.
							</p>
						</div>
						<div className="mt-4 inline-flex items-center gap-2 rounded-md border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-bold uppercase tracking-wider text-violet-700 md:mt-0">
							<FiCreditCard />
							Full access
						</div>
					</div>

					{error && (
						<div className="mb-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
							{error}
						</div>
					)}

					{successPlan && (
						<div className="mb-5 flex flex-col gap-3 rounded-md border-2 border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800 shadow-[0_3px_0_#bbf7d0] sm:flex-row sm:items-center sm:justify-between">
							<span>Full mode is active on the {successPlan} plan.</span>
							<button
								type="button"
								onClick={() => router.push('/coach')}
								className="inline-flex items-center justify-center rounded-md bg-emerald-700 px-3 py-2 text-sm font-bold text-white transition-colors hover:bg-emerald-800"
							>
								Go to Coach
							</button>
						</div>
					)}

					<div className="grid gap-4 md:grid-cols-3">
						{PLANS.map(plan => {
							const isBusy = isSubmitting && selectedPlan === plan.id
							const isCurrent = subscription?.plan === plan.id && subscription?.fullAccess
							const PlanIcon = plan.icon
							return (
								<article key={plan.id} data-plan-card={plan.id} className={`relative overflow-hidden rounded-md border-2 p-5 transition-all hover:-translate-y-1 ${plan.cardClassName}`}>
									<span className={`absolute left-0 top-0 h-1.5 w-full ${plan.detailClassName}`} />
									<div className="absolute right-4 top-14 h-16 w-16 rounded-full border border-white/80 bg-white/50 blur-xl" />

									<div className="mb-4 flex items-start justify-between gap-3">
										<div>
											<span className={`mb-2 inline-flex rounded-md border px-2 py-1 text-[11px] font-bold uppercase tracking-wider ${plan.badgeClassName}`}>
												{plan.kicker}
											</span>
											<h2 className="text-xl font-bold">{plan.name}</h2>
											<p className="text-xs font-medium text-slate-500">{plan.period}</p>
										</div>
										<span className={`inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-md text-xl ${plan.iconClassName}`}>
											{isCurrent ? <FiCheck /> : <PlanIcon />}
										</span>
									</div>
									<div className="mb-4 flex items-end gap-2">
										<p className="text-4xl font-black tracking-wide">{plan.price}</p>
										<span className="pb-1 text-xs font-bold uppercase tracking-wider text-slate-500">
											{plan.id === 'forever' ? 'once' : 'mock pay'}
										</span>
									</div>
									<p className="mb-4 min-h-[40px] text-sm leading-5 text-slate-600">{plan.description}</p>
									<ul className="mb-5 grid gap-2">
										{plan.perks.map(perk => (
											<li key={perk} className="flex items-center gap-2 text-sm font-medium text-slate-700">
												<FiCheck className="flex-shrink-0 text-emerald-600" />
												<span>{perk}</span>
											</li>
										))}
									</ul>
									<button
										type="button"
										onClick={(event) => handleCheckout(plan, event)}
										disabled={isSubmitting}
										className={`inline-flex h-11 w-full items-center justify-center gap-2 rounded-md px-4 text-sm font-bold uppercase tracking-wider text-white disabled:cursor-not-allowed disabled:opacity-60 ${plan.buttonClassName}`}
									>
										<span className="relative z-10 inline-flex h-full items-center justify-center gap-2 leading-none">
											{isBusy ? (
												<>
													<FiRepeat className="h-4 w-4 flex-shrink-0 animate-spin" />
													<span>Updating</span>
												</>
											) : (
												<span>{isCurrent ? 'Renew plan' : 'Choose plan'}</span>
											)}
										</span>
									</button>
								</article>
							)
						})}
					</div>
				</section>
			</main>
		</>
	)
}

PaymentPage.requireAuth = true
