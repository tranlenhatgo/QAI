import Image from 'next/image'
import { defaultQuestions } from '@/helpers/gameConfig'
import { BsQuestionCircleFill, BsSkipEndFill } from 'react-icons/bs'
import { IoMdInfinite } from 'react-icons/io'
import { FaHeart } from 'react-icons/fa'
import fiftyImg from '@/assets/fifty.svg'
import categoriesJSON from '@/assets/categories.json'
import { adaptiveCategoryLimitForTier, shouldShowClassicControls } from '@/helpers/adaptiveInfinity.mjs'

export default function NewGameForm ({ handleInputs, nowQueries, coachTier = 'lite' }) {
	const selectedCategories = Array.isArray(nowQueries.categories) ? nowQueries.categories : []
	const selectedCategory = selectedCategories[0] || categoriesJSON[0].id
	const infinityMode = nowQueries.infinitymode === true || nowQueries.infinitymode === 'true'
	const timeMode = nowQueries.timemode === true || nowQueries.timemode === 'true'
	const questionCount = nowQueries.questions || defaultQuestions.minQuestions
	const showClassicControls = shouldShowClassicControls(nowQueries)
	const categoryLimit = adaptiveCategoryLimitForTier(coachTier)
	const visibleSelectedCategories = infinityMode
		? selectedCategories.slice(0, categoryLimit)
		: [selectedCategory]

	const WILDCARDS = [
		{ name: 'Skip question', icon: <BsSkipEndFill color='white' className='text-2xl' />, amount: 1 },
		{ name: 'Delete two wrong questions', icon: <Image src={fiftyImg.src} alt="fifty fifty" width={23} height={23} />, amount: 1 },
		{ name: 'Lives', icon: <FaHeart color='white' className='text-2xl' />, amount: 1 }
	]

	const MODES = [
		{ label: 'Classic Quiz', value: false, icon: <BsQuestionCircleFill className='text-xl' /> },
		{ label: 'Infinity Quiz', value: true, icon: <IoMdInfinite className='text-3xl' />, badge: 'Special' }
	]

	return (
		<div className='grid gap-5'>
			<fieldset className='rounded-md border border-blue-100 bg-white p-3 shadow-sm shadow-blue-100/60 sm:p-4'>
				<legend className='px-1 text-lg font-bold'>Mode</legend>
				<div className='grid grid-cols-2 gap-3'>
					{MODES.map(mode => {
						const selected = infinityMode === mode.value
						const modeClass = selected
							? mode.value
								? 'border-cyan-400 bg-cyan-50 text-slate-950 shadow-[0_0_0_3px_rgba(34,211,238,0.18)]'
								: 'border-blue-500 bg-blue-50 text-slate-950 shadow-[0_0_0_3px_rgba(37,99,235,0.14)]'
							: 'border-slate-200 bg-slate-50 text-slate-700 hover:border-blue-300 hover:bg-white'

						return (
							<label key={mode.label} className={`relative flex min-h-[86px] cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 p-3 transition-all active:scale-[0.99] sm:min-h-[72px] sm:flex-row sm:items-center sm:justify-start ${modeClass}`}>
								<input
									type='radio'
									name='infinitymode'
									value={mode.value ? 'true' : 'false'}
									checked={selected}
									onChange={handleInputs}
									className='sr-only'
								/>
								{mode.badge && <span className='absolute right-2 top-2 rounded-full bg-cyan-600 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-white sm:px-2 sm:text-[10px]'>{mode.badge}</span>}
								<span className={`grid h-8 w-8 shrink-0 place-items-center rounded-md sm:h-11 sm:w-11 ${mode.value ? 'bg-cyan-500 text-white' : 'bg-blue-500 text-white'}`}>
									{mode.icon}
								</span>
								<span className='min-w-0 text-center sm:text-left'>
									<span className='block whitespace-nowrap text-sm font-black leading-tight sm:text-base'>{mode.label}</span>
								</span>
							</label>
						)
					})}
				</div>
			</fieldset>

			<div className={`grid gap-5 ${showClassicControls ? 'lg:grid-cols-[minmax(0,1fr)_minmax(14rem,17rem)]' : ''}`}>
				{showClassicControls && <div className='grid gap-4'>
					<fieldset className='rounded-md border border-slate-200 bg-white p-3 sm:p-4'>
						<legend className='px-1 text-base font-bold'>Wildcards</legend>
						<ul className='grid grid-cols-3 gap-2 font-medium'>
							{WILDCARDS.map(({ name, icon, amount }) => (
								<li key={name} className='flex items-center justify-between rounded-md bg-slate-100 px-2 py-2' title={name}>
									<span className='grid h-9 w-9 place-items-center rounded bg-blue-500 text-white'>
										{icon}
									</span>
									<span className='text-lg font-black'>x{amount}</span>
								</li>
							))}
						</ul>
					</fieldset>

					<div className='grid grid-cols-2 gap-3 sm:gap-4'>
						<fieldset className='rounded-md border border-slate-200 bg-white p-3 sm:p-4'>
							<legend className='px-1 text-base font-bold'>Questions</legend>
							<div className='mb-3 flex h-8 items-center justify-between'>
								<span className='text-sm font-semibold text-slate-600'>{infinityMode ? 'Infinity' : 'Classic'}</span>
								<span className='grid min-w-[2.5rem] place-items-center rounded bg-slate-100 px-2 py-1 text-lg font-black text-blue-600'>
									{infinityMode ? <IoMdInfinite /> : questionCount}
								</span>
							</div>
							<input
								type='range'
								name='questions'
								min={defaultQuestions.minQuestions}
								max={defaultQuestions.maxQuestions}
								value={questionCount}
								onChange={handleInputs}
								className={`h-2 w-full accent-blue-600 ${infinityMode ? 'cursor-not-allowed opacity-30' : 'cursor-pointer'}`}
								disabled={infinityMode}
							/>
						</fieldset>

						<fieldset className='rounded-md border border-slate-200 bg-white p-3 sm:p-4'>
							<legend className='px-1 text-base font-bold'>Time</legend>
							<div className='mb-3 flex h-8 items-center justify-between'>
								<span className='text-sm font-semibold text-slate-600'>Timer</span>
								<label className='relative inline-flex h-7 w-12 cursor-pointer items-center'>
									<input id='cbx2' onChange={handleInputs} checked={timeMode} type='checkbox' name='timemode' className='peer sr-only' />
									<span className='absolute inset-0 rounded-full bg-slate-300 transition-colors peer-checked:bg-blue-600'></span>
									<span className='absolute left-1 h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5'></span>
								</label>
							</div>
							<div className='grid grid-cols-4 gap-1 sm:gap-2'>
								{[10, 20, 30, 60].map(time => (
									<label key={time} className='min-w-0'>
										<input className='peer absolute hidden' type='radio' name='time' id={`${time}s`} value={time} checked={time === Number(nowQueries.time)} onChange={handleInputs} disabled={!timeMode} />
										<span className={`block w-full rounded-md px-1 py-2 text-center text-xs font-bold transition-colors peer-checked:bg-blue-600 peer-checked:text-white sm:text-sm ${!timeMode ? 'cursor-not-allowed bg-slate-100 text-slate-400' : 'cursor-pointer bg-slate-100 text-slate-800 active:scale-95'}`} translate='no'>{time}s</span>
									</label>
								))}
							</div>
						</fieldset>
					</div>
				</div>}

				<fieldset className='rounded-md border border-slate-200 bg-white p-3 sm:p-4'>
					<legend className='px-1 text-base font-bold'>Category</legend>
					<div className='grid grid-cols-4 gap-2 lg:grid-cols-3'>
						{categoriesJSON.map(category => (
							<label key={category.id} className='relative flex h-12 cursor-pointer items-center justify-center rounded-md sm:h-14' title={category.name}>
								<input
									checked={visibleSelectedCategories.includes(category.id)}
									className='peer sr-only'
									type={infinityMode ? 'checkbox' : 'radio'}
									name='categories'
									id={category.name}
									value={category.id}
									onChange={handleInputs}
								/>
								<span className='absolute inset-0 rounded-md border border-slate-200 bg-slate-100 transition-all peer-checked:border-transparent peer-checked:bg-[var(--bgColor)] peer-checked:shadow-[0_0_0_3px_rgba(37,99,235,0.16)]' style={{ '--bgColor': category.color }}></span>
								<Image className='relative z-10 h-7 w-7 opacity-80 transition-all peer-checked:scale-110 peer-checked:opacity-100 sm:h-8 sm:w-8' src={`/categories-icons/${category.name.toLowerCase()}.svg`} alt={category.name} width={40} height={40} />
							</label>
						))}
					</div>
				</fieldset>
			</div>
		</div>
	)
}
