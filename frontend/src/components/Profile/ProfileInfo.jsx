import { useBoundStore } from '@/store/useBoundStore'

function parseScore(score = '') {
	const [correctRaw, totalRaw] = String(score).split('/')
	const correct = Number(correctRaw)
	const total = Number(totalRaw)

	return {
		correct: Number.isFinite(correct) ? correct : 0,
		total: Number.isFinite(total) && total > 0 ? total : 0,
	}
}

export default function ProfileInfo({ user, logout }) {
	const { history } = useBoundStore(state => state)
	const attempts = Array.isArray(history) ? history : []
	const totals = attempts.reduce((acc, quiz) => {
		const { correct, total } = parseScore(quiz?.score)
		acc.correct += correct
		acc.total += total
		return acc
	}, { correct: 0, total: 0 })
	const average = totals.total > 0 ? ((totals.correct / totals.total) * 100).toFixed(1) : '0.0'

	return (
		<article className='bg-gradient-to-br from-white to-blue-50 p-5 rounded-xl shadow-md border border-blue-100 w-full text-black'>
			{/* Compact Header */}
			<div className='flex items-center gap-3 mb-4 pb-4 border-b border-blue-200'>
				<img
					src={user?.photoURL || '/default-avatar.jpg'}
					alt="Profile Picture"
					className="w-16 h-16 rounded-full border-2 border-blue-400 shadow-md"
				/>
				<div>
					<h3 className='text-xl font-bold text-blue-900'>{user?.displayName || "User"}</h3>
					<p className='text-sm text-gray-600'>{user?.email}</p>
				</div>
			</div>

			{/* Quick Stats */}
			<div className='grid grid-cols-2 gap-3 mb-4'>
				<div className='bg-blue-100 p-3 rounded-lg'>
					<p className='text-xs font-semibold text-gray-600 uppercase'>Tests Taken</p>
					<p className='text-2xl font-bold text-blue-600'>{attempts.length}</p>
				</div>
				<div className='bg-green-100 p-3 rounded-lg'>
					<p className='text-xs font-semibold text-gray-600 uppercase'>Avg Score</p>
					<p className='text-2xl font-bold text-green-600'>{average}%</p>
				</div>
			</div>

			{/* Logout Button */}
			<button 
				className="w-full btn-primary wrongAnswer py-2 px-4 rounded-lg transition-all" 
				onClick={logout}
			>
				Logout
			</button>
		</article>
	)
}
