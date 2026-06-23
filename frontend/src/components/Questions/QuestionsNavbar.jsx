import { useBoundStore } from '@/store/useBoundStore'

export default function QuestionsNavbar ({ changueCurrent }) {
	const { queries, questions, currentQuestion, questionProgress, adaptiveHistory } = useBoundStore(state => state)

	if (queries.infinitymode) {
		const WINDOW_SIZE = 5
		// Total dots = past answered questions + 1 for the current unanswered question
		const totalDots = adaptiveHistory.length + 1
		const currentActiveIndex = adaptiveHistory.length // 0-based index of the live question

		// Compute the sliding window: which 0-based indices to show
		// Default: show the last WINDOW_SIZE dots ending at the active question
		// When navigating back, shift the window to keep currentQuestion visible
		let windowStart
		const currentIdx = currentQuestion - 1 // 0-based
		// Default end is at the active question
		const defaultStart = Math.max(0, totalDots - WINDOW_SIZE)
		if (currentIdx < defaultStart) {
			// User navigated before the default window — shift window to include currentQuestion
			windowStart = Math.max(0, currentIdx - Math.floor(WINDOW_SIZE / 2))
		} else {
			windowStart = defaultStart
		}
		const windowEnd = Math.min(windowStart + WINDOW_SIZE, totalDots) // exclusive
		const visibleIndices = []
		for (let i = windowStart; i < windowEnd; i++) visibleIndices.push(i)

		const hasLeft = windowStart > 0
		const hasRight = windowEnd < totalDots

		function handleInfinityClick(i) {
			if (i === currentActiveIndex) {
				changueCurrent(i + 1)
				return
			}
			if (i > currentActiveIndex) return
			const histItem = adaptiveHistory[i]
			if (histItem && histItem.userAnswer === -1) {
				for (let j = i + 1; j <= currentActiveIndex; j++) {
					if (j === currentActiveIndex) { changueCurrent(j + 1); return }
					if (adaptiveHistory[j] && adaptiveHistory[j].userAnswer !== -1) { changueCurrent(j + 1); return }
				}
				for (let j = i - 1; j >= 0; j--) {
					if (adaptiveHistory[j] && adaptiveHistory[j].userAnswer !== -1) { changueCurrent(j + 1); return }
				}
				changueCurrent(currentActiveIndex + 1)
				return
			}
			changueCurrent(i + 1)
		}

		function navigateWindowLeft() {
			// Find a valid question before the current window start to navigate to
			for (let j = windowStart - 1; j >= 0; j--) {
				if (j === currentActiveIndex) { changueCurrent(j + 1); return }
				const histItem = adaptiveHistory[j]
				if (!histItem || histItem.userAnswer !== -1) { changueCurrent(j + 1); return }
			}
		}

		function navigateWindowRight() {
			// Find a valid question after the current window end to navigate to
			for (let j = windowEnd; j <= currentActiveIndex; j++) {
				if (j === currentActiveIndex) { changueCurrent(j + 1); return }
				const histItem = adaptiveHistory[j]
				if (!histItem || histItem.userAnswer !== -1) { changueCurrent(j + 1); return }
			}
		}

		function infinityButtonBg(i) {
			if (i === currentActiveIndex) {
				let bg = 'bg-white text-blue-500'
				if (i + 1 === currentQuestion) bg += ' outline outline-offset-2 hover:outline-offset-4 outline-blue-500'
				return bg + ' cursor-pointer hover:scale-105'
			}
			if (i > currentActiveIndex) return 'bg-slate-600 hover:cursor-auto'
			const histItem = adaptiveHistory[i]
			let bg = 'bg-slate-600'
			if (histItem) {
				if (histItem.userAnswer === 1) bg = 'bg-green-500 !text-white'
				else if (histItem.userAnswer === -1) bg = 'bg-red-500 !text-white opacity-60'
				else if (histItem.userAnswer === 2) bg = 'bg-blue-500 !text-white'
			}
			bg += ' cursor-pointer hover:scale-105'
			if (i + 1 === currentQuestion) bg += ' outline outline-offset-2 hover:outline-offset-4 outline-blue-500'
			return bg
		}

		const segmentCount = Math.max(visibleIndices.length - 1, 1)
		const currentSegment = Math.max(0, visibleIndices.indexOf(currentActiveIndex < windowEnd ? currentActiveIndex : windowEnd - 1))

		return (
			<div className='flex items-center gap-2 mt-8 md:mt-0 mb-5 md:mb-10 justify-center w-full text-white'>
				{hasLeft && (
					<button onClick={navigateWindowLeft} className='w-8 h-8 flex items-center justify-center rounded-full bg-slate-600 hover:bg-slate-500 hover:scale-105 transition-all text-white text-sm font-bold' title='View earlier questions'>
						‹
					</button>
				)}
				<ol className='progressBar flex relative overflow-visible justify-between items-center flex-1 max-w-xs after:absolute after:top-1/2 after:-z-10 after:transition-all after:duration-700 after:rounded-full after:-translate-y-1/2 after:h-[6px] after:bg-blue-500' style={{ '--segments': segmentCount, '--current': currentSegment }}>
					{visibleIndices.map((i) => (
						<li key={i}>
							<button onClick={() => handleInfinityClick(i)} className={`w-8 h-8 flex items-center justify-center pt-[2px] font-medium transition-all rounded-full text-center text-sm ${infinityButtonBg(i)}`}>{i + 1}</button>
						</li>
					))}
				</ol>
				{hasRight && (
					<button onClick={navigateWindowRight} className='w-8 h-8 flex items-center justify-center rounded-full bg-slate-600 hover:bg-slate-500 hover:scale-105 transition-all text-white text-sm font-bold' title='View later questions'>
						›
					</button>
				)}
			</div>
		)
	}

	function buttonBg (i) {
		// console.log(questions, i, questions[i])
		let bg = 'bg-slate-600 hover:cursor-auto'
		if (i + 1 === questionProgress) bg = 'bg-white text-blue-500'
		if (questions[i].userAnswer === 1) bg = 'bg-green-500 !text-white'
		if (questions[i].userAnswer === -1) bg = 'bg-red-500 !text-white'
		if (questions[i].userAnswer === 2) bg = 'bg-blue-500 !text-white'
		if (i + 1 <= questionProgress) bg += ' cursor-pointer hover:scale-105'
		if (i + 1 === currentQuestion) bg += ' outline outline-offset-2 hover:outline-offset-4 outline-blue-500'
		return bg
	}

	return (
		<ol className='progressBar mt-8 md:mt-0 flex relative overflow-auto sm:overflow-visible  mb-5 md:mb-10 justify-between items-center w-full text-white after:absolute after:top-1/2 after:-z-10 after:transition-all after:duration-700 after:rounded-full after:-translate-y-1/2 after:h-[6px] after:bg-blue-500' style={{ '--segments': parseInt(questions.length) - 1, '--current': questionProgress - 1 }}>
			{[...Array(parseInt(questions.length))].map((_, i) => (
				<li key={i}>
					<button onClick={() => changueCurrent(i + 1)} disabled={i + 1 > questionProgress} className={`w-8 h-8 flex items-center justify-center pt-[2px] font-medium transition-all rounded-full text-center text-sm ${buttonBg(i)}`}>{i + 1}</button>
				</li>
			))}
		</ol>
	)
}
