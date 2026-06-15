import { useBoundStore } from '@/store/useBoundStore'

export default function QuestionsNavbar ({ changueCurrent }) {
	const { queries, questions, currentQuestion, questionProgress, adaptiveHistory } = useBoundStore(state => state)

	if (queries.infinitymode) {
		// Total dots = past answered questions + 1 for the current unanswered question
		const totalDots = adaptiveHistory.length + 1
		// The current (unanswered) question is at index adaptiveHistory.length (0-based), i.e. position totalDots
		const currentActiveIndex = adaptiveHistory.length // 0-based index of the live question

		function handleInfinityClick(i) {
			// Clicking the current active question — always allowed
			if (i === currentActiveIndex) {
				changueCurrent(i + 1)
				return
			}
			// Block future questions (beyond the current active)
			if (i > currentActiveIndex) return
			// Past question — check if it was wrong
			const histItem = adaptiveHistory[i]
			if (histItem && histItem.userAnswer === -1) {
				// Wrong answer: find the nearest valid (non-wrong) question to skip to
				// Search forward first
				for (let j = i + 1; j <= currentActiveIndex; j++) {
					if (j === currentActiveIndex) { changueCurrent(j + 1); return }
					if (adaptiveHistory[j] && adaptiveHistory[j].userAnswer !== -1) { changueCurrent(j + 1); return }
				}
				// Search backward if no forward valid found
				for (let j = i - 1; j >= 0; j--) {
					if (adaptiveHistory[j] && adaptiveHistory[j].userAnswer !== -1) { changueCurrent(j + 1); return }
				}
				// All past are wrong, go to current active
				changueCurrent(currentActiveIndex + 1)
				return
			}
			// Valid past question — navigate
			changueCurrent(i + 1)
		}

		function infinityButtonBg(i) {
			// Current active (unanswered) question
			if (i === currentActiveIndex) {
				let bg = 'bg-white text-blue-500'
				if (i + 1 === currentQuestion) bg += ' outline outline-offset-2 hover:outline-offset-4 outline-blue-500'
				return bg + ' cursor-pointer hover:scale-105'
			}
			// Future — should not exist but safeguard
			if (i > currentActiveIndex) return 'bg-slate-600 hover:cursor-auto'
			// Past answered question
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

		return (
			<ol className='progressBar mt-8 md:mt-0 flex relative overflow-auto sm:overflow-visible mb-5 md:mb-10 justify-between items-center w-full text-white after:absolute after:top-1/2 after:-z-10 after:transition-all after:duration-700 after:rounded-full after:-translate-y-1/2 after:h-[6px] after:bg-blue-500' style={{ '--segments': Math.max(totalDots - 1, 1), '--current': Math.min(currentActiveIndex, totalDots - 1) }}>
				{[...Array(totalDots)].map((_, i) => (
					<li key={i}>
						<button onClick={() => handleInfinityClick(i)} className={`w-8 h-8 flex items-center justify-center pt-[2px] font-medium transition-all rounded-full text-center text-sm ${infinityButtonBg(i)}`}>{i + 1}</button>
					</li>
				))}
			</ol>
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
