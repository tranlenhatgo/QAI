import { FiLock } from 'react-icons/fi'
import { useRouter } from 'next/router'
import { useBoundStore } from '@/store/useBoundStore'
import { shallow } from 'zustand/shallow'

export default function SubscriptionRequiredModal() {
	const { subscriptionModalOpen, closeSubscriptionModal } = useBoundStore(state => ({
		subscriptionModalOpen: state.subscriptionModalOpen,
		closeSubscriptionModal: state.closeSubscriptionModal,
	}), shallow)
	const router = useRouter()

	if (!subscriptionModalOpen) return null

	function viewPlans() {
		closeSubscriptionModal()
		router.push('/payment')
	}

	return (
		<div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/65 px-4">
			<div className="w-full max-w-md rounded-lg bg-white p-6 text-slate-900 shadow-2xl">
				<div className="mb-4 flex items-center gap-3">
					<span className="inline-flex h-11 w-11 items-center justify-center rounded-md bg-blue-50 text-blue-700">
						<FiLock className="text-xl" />
					</span>
					<div>
						<h2 className="text-lg font-semibold">Full mode requires a subscription</h2>
						<p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Choose a plan to unlock Full.</p>
					</div>
				</div>
				<p className="text-sm leading-6 text-slate-600">
					Full unlocks advanced reasoning, richer question generation, web search, and study-material search. Your account can keep using Lite mode for now.
				</p>
				<div className="mt-5 grid gap-2 sm:grid-cols-2">
					<button
						type="button"
						onClick={viewPlans}
						className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
					>
						View plans
					</button>
					<button
						type="button"
						onClick={closeSubscriptionModal}
						className="rounded-md border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
					>
						Stay on Lite
					</button>
				</div>
			</div>
		</div>
	)
}
