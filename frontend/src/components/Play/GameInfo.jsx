import Image from 'next/image'
import { AiFillInfoCircle } from 'react-icons/ai'
import categories from '@/assets/categories.json'
import { useState } from 'react'
import { useBoundStore } from '@/store/useBoundStore'

export default function GameInfo() {
	const { queries } = useBoundStore(state => state)
	const [showInfo, setShowInfo] = useState(false)

	const mode = queries.quizmode
		? 'Quiz'
		: queries.timemode && queries.infinitymode
			? 'Time | Infinity Quiz'
			: !queries.timemode && !queries.infinitymode
				? 'Classic'
				: queries.timemode
					? 'Time'
					: 'Infinity Quiz';

	const singleCategoryId = queries.categories?.[0]
	const singleCategory = singleCategoryId ? categories.find(c => c.id === singleCategoryId) : null

	return (
		<>
			<button
				title={showInfo ? 'Hide info' : 'Show info'}
				onClick={() => setShowInfo(showInfo => !showInfo)}
				className="fixed bottom-4 left-4 lg:hidden z-20 flex items-center justify-center w-10 h-10 bg-white rounded-xl shadow-sm hover:shadow-md transition-all duration-300 hover:scale-110 active:scale-95"
			>
				<AiFillInfoCircle className='text-[22px] text-slate-900' />
			</button>

			<aside className={`fixed h-fit transition-all duration-500 z-10 lg:bottom-4 left-4 md:top-1/2 md:-translate-y-1/2 text-center font-medium lg:!scale-100 lg:!opacity-100 ${showInfo ? 'bottom-16 scale-100 opacity-100' : 'bottom-0 scale-50 opacity-0 pointer-events-none lg:pointer-events-auto'}`}>
				<div className='flex flex-col gap-2 min-w-[120px]'>
					{singleCategory && (
						<div
							className='bg-white rounded-xl p-3 flex items-center gap-2.5 shadow-sm transition-transform hover:scale-105'
							style={{ borderLeft: `3px solid ${singleCategory.color}` }}
						>
							<Image
								title={singleCategory.name}
								alt={singleCategory.name}
								className="p-1.5 rounded-lg shrink-0"
								style={{ backgroundColor: singleCategory.color, boxShadow: `0 4px 12px ${singleCategory.color}44` }}
								src={`/categories-icons/${singleCategory.name.toLowerCase()}.svg`}
								width={36} height={36}
							/>
							<span className='text-slate-900 text-xs font-semibold tracking-wide text-left leading-tight'>
								{singleCategory.name}
							</span>
						</div>
					)}

					{/* Mode badge */}
					<div
						className='bg-white rounded-xl p-2.5 flex justify-center items-center gap-1.5 shadow-sm transition-transform hover:scale-105'
						title='Mode'
					>
						<span className='text-slate-900 text-xs font-semibold tracking-wider uppercase'>{mode}</span>
					</div>

					{/* Question count / Time info */}
					<div className='flex gap-2'>
						{!queries.infinitymode && (
							<div
								className='bg-white rounded-xl p-2.5 w-full flex flex-col items-center justify-center shadow-sm transition-transform hover:scale-105'
								title='Number of questions'
							>
								<span className='text-slate-900 text-lg font-bold leading-none'>{queries.questions}</span>
								<span className='text-slate-400 text-[9px] font-medium uppercase tracking-wider mt-1'>Questions</span>
							</div>
						)}
						{queries.timemode && (
							<div
								className='bg-white rounded-xl p-2.5 w-full flex flex-col items-center justify-center shadow-sm transition-transform hover:scale-105'
								title='Time per question'
							>
								<span className='text-slate-900 text-lg font-bold leading-none'>{queries.time}s</span>
								<span className='text-slate-400 text-[9px] font-medium uppercase tracking-wider mt-1'>Timer</span>
							</div>
						)}
					</div>
				</div>
			</aside>

			<style jsx global>
				{`
				#__next {
					background: linear-gradient(0deg, rgb(0 0 0 / 10%) 0%, rgba(255, 255, 255, 0.05) 100%);
				}
				`}
			</style>
		</>
	)
}
