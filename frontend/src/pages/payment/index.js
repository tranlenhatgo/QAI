import Head from 'next/head'
import { useState } from 'react'
import { useRouter } from 'next/router'
import { FiArrowLeft, FiCheck, FiCreditCard } from 'react-icons/fi'
import { useBoundStore } from '@/store/useBoundStore'

const PLANS = [
	{
		id: 'monthly',
		name: '1 Month',
		price: '$2',
		period: '30 days of Full mode',
		description: 'Good for a short exam sprint or project week.',
	},
	{
		id: 'yearly',
		name: '1 Year',
		price: '$20',
		period: '12 months of Full mode',
		description: 'Best value for steady study and quiz creation.',
	},
	{
		id: 'forever',
		name: 'Forever',
		price: '$100',
		period: 'Lifetime Full mode',
		description: 'One payment for permanent Full access.',
	},
]

export default function PaymentPage() {
	const router = useRouter()
	const { subscription, checkoutSubscription } = useBoundStore(state => state)
	const [selectedPlan, setSelectedPlan] = useState(null)
	const [isSubmitting, setIsSubmitting] = useState(false)
	const [error, setError] = useState('')
	const [successPlan, setSuccessPlan] = useState(null)

	async function handleCheckout(plan) {
		setSelectedPlan(plan.id)
		setIsSubmitting(true)
		setError('')
		setSuccessPlan(null)
		try {
			const updatedSubscription = await checkoutSubscription(plan.id)
			setSuccessPlan(updatedSubscription?.plan || plan.id)
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
			<main className="min-h-screen bg-slate-100 text-slate-900">
				<header className="border-b border-slate-200 bg-white">
					<div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 md:px-8">
						<button
							type="button"
							onClick={() => router.push('/coach')}
							className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 text-slate-700 transition-colors hover:bg-slate-50"
							aria-label="Back to coach"
						>
							<FiArrowLeft />
						</button>
						<div className="min-w-0 flex-1">
							<h1 className="truncate text-lg font-semibold">Full Subscription</h1>
							<p className="truncate text-xs text-slate-500">Mock checkout for AI Coach Full mode</p>
						</div>
						<div className="hidden rounded-md border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 sm:block">
							Current: {subscription?.plan || 'loading'}
						</div>
					</div>
				</header>

				<section className="mx-auto max-w-6xl px-4 py-6 md:px-8">
					<div className="mb-5 rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
						This page simulates payment only. Choosing a plan updates your subscription through the backend and enables Full mode immediately.
					</div>

					{error && (
						<div className="mb-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
							{error}
						</div>
					)}

					{successPlan && (
						<div className="mb-5 flex flex-col gap-3 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 sm:flex-row sm:items-center sm:justify-between">
							<span>Full mode is active on the {successPlan} plan.</span>
							<button
								type="button"
								onClick={() => router.push('/coach')}
								className="inline-flex items-center justify-center rounded-md bg-emerald-700 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-800"
							>
								Go to Coach
							</button>
						</div>
					)}

					<div className="grid gap-4 md:grid-cols-3">
						{PLANS.map(plan => {
							const isBusy = isSubmitting && selectedPlan === plan.id
							const isCurrent = subscription?.plan === plan.id && subscription?.fullAccess
							return (
								<article key={plan.id} className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
									<div className="mb-4 flex items-start justify-between gap-3">
										<div>
											<h2 className="text-base font-semibold">{plan.name}</h2>
											<p className="text-xs text-slate-500">{plan.period}</p>
										</div>
										<span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-slate-100 text-slate-700">
											{isCurrent ? <FiCheck /> : <FiCreditCard />}
										</span>
									</div>
									<p className="mb-2 text-3xl font-bold">{plan.price}</p>
									<p className="mb-5 min-h-[40px] text-sm leading-5 text-slate-600">{plan.description}</p>
									<button
										type="button"
										onClick={() => handleCheckout(plan)}
										disabled={isSubmitting}
										className="inline-flex h-10 w-full items-center justify-center rounded-md bg-slate-900 px-4 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
									>
										{isBusy ? 'Updating...' : isCurrent ? 'Renew plan' : 'Choose plan'}
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
