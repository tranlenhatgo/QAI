import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/router'

import NewGameForm from './NewGameForm'
import QuizBrowser from './QuizBrowser'
import { IoCloseSharp } from 'react-icons/io5'
import playSound from '@/helpers/playSound'
import queryValidator, { quizQueryValidator } from '@/helpers/gameConfig'
import categoriesJSON from '@/assets/categories.json'
import { useBoundStore } from '@/store/useBoundStore'
import JoinGameForm from './JoinGameForm'
import { adaptiveCategoryLimitForTier } from '@/helpers/adaptiveInfinity.mjs'
import { shallow } from 'zustand/shallow'

export default function PlayForm() {
	const { getQuestions, startAdaptiveInfinity, cleanQuestions, queries, setQueries, cleanWildCards, takeQuiz, error, user, setDest, coachTier } = useBoundStore(state => ({
		getQuestions: state.getQuestions,
		startAdaptiveInfinity: state.startAdaptiveInfinity,
		cleanQuestions: state.cleanQuestions,
		queries: state.queries,
		setQueries: state.setQueries,
		cleanWildCards: state.cleanWildCards,
		takeQuiz: state.takeQuiz,
		error: state.error,
		user: state.user,
		setDest: state.setDest,
		coachTier: state.coachTier,
	}), shallow)
	const [nowQueries, setNowQueries] = useState(queries)
	const [joinQuery, setJoinQuery] = useState({ ...queries, name: '' })
	const [dialogOpen, setDialogOpen] = useState(false)
	const router = useRouter()
	const dialog = useRef(null)

	useEffect(() => setNowQueries(queries), [queries])

	useEffect(() => {
		const name = user?.displayName || user?.email?.split('@')[0] || ''
		if (name) {
			setJoinQuery(prev => ({ ...prev, name }))
		}
	}, [user])

	useEffect(() => {
		const el = dialog.current
		if (!el) return
		const observer = new MutationObserver(() => {
			setDialogOpen(el.open)
		})
		observer.observe(el, { attributes: true, attributeFilter: ['open'] })
		return () => observer.disconnect()
	}, [])

	useEffect(() => {
		if (router.isReady && router.pathname === '/play') {
			if (!queries.quizmode) {
				setQueries(queryValidator(router.query, { tier: coachTier }));
			}
		}
	}, [router.isReady, coachTier]);

	useEffect(() => {
		if (error[0]) {
			console.error('Error joining the game:', error[1]);
			alert('Failed to join the game. Returning to the main page.');
			router.push('/');
		}
	}, [error]);

	function handleInputs(e) {
		if (e.target.name === 'infinitymode') {
			const value = e.target.type === 'radio' ? e.target.value === 'true' : e.target.checked
			value ? playSound('pop-up-on') : playSound('pop-up-off')
			if (value && !user) {
				e.target.checked = false
				setDest?.('/play')
				document.getElementById('authDialog')?.showModal()
				return setNowQueries({ ...nowQueries, infinitymode: false })
			}
			const currentCategories = Array.isArray(nowQueries.categories) && nowQueries.categories.length > 0
				? nowQueries.categories
				: [categoriesJSON[0].id]
			return setNowQueries({
				...nowQueries,
				infinitymode: value,
				categories: value
					? currentCategories.slice(0, adaptiveCategoryLimitForTier(coachTier))
					: [currentCategories[0]],
			})
		}

		if (e.target.name === 'timemode') {
			const value = e.target.checked
			value ? playSound('pop-up-on') : playSound('pop-up-off')
			return setNowQueries({ ...nowQueries, timemode: value })
		}

		if (e.target.name === 'categories') {
			playSound('pop-up-on')
			if (nowQueries.infinitymode) {
				const selected = Array.isArray(nowQueries.categories) ? [...nowQueries.categories] : []
				const exists = selected.includes(e.target.value)
				const nextCategories = exists
					? selected.filter(category => category !== e.target.value)
					: selected.length < adaptiveCategoryLimitForTier(coachTier)
						? [...selected, e.target.value]
						: selected
				return setNowQueries({ ...nowQueries, categories: nextCategories.length > 0 ? nextCategories : [e.target.value] })
			}
			return setNowQueries({ ...nowQueries, [e.target.name]: [e.target.value] })
		}

		playSound('pop')
		setNowQueries({ ...nowQueries, [e.target.name]: e.target.value })
	}

	function handleJoinInputs(e) {
		const { name, value } = e.target;

		playSound('pop')

		setJoinQuery(prevState => ({
			...prevState,
			[name]: value.trim(),
		}));
	}

	function handleSelectQuiz(quiz) {
		playSound('pop')
		setJoinQuery(prevState => ({
			...prevState,
			quizId: quiz.quiz_id,
		}))
	}

	async function handleSubmit(e) {
		if (e.target.name === 'newgame') {
			e.preventDefault()
			cleanQuestions()
			cleanWildCards()

			const validQueries = queryValidator(nowQueries, { tier: coachTier })
			const query = Object.keys(validQueries)
				.filter(key => !['quizId', 'name'].includes(key)) // Exclude unwanted keys
				.map(key => `${key}=${validQueries[key]}`)
				.join('&');
			setQueries(validQueries)
			router.push({ pathname: '/play', query })

			const cate = validQueries.categories.map(cat => categoriesJSON.find(c => c.id === cat).name)
			if (router.pathname === '/play') {
				if (validQueries.infinitymode) startAdaptiveInfinity(validQueries.categories)
				else getQuestions(cate, validQueries.questions)
			}

			closeDialog()
		} else if (e.target.name === 'joingame') {
			e.preventDefault()
			cleanQuestions()
			cleanWildCards()

			const questions = await takeQuiz(joinQuery.quizId, joinQuery.name);

			const validatedQuery = { ...quizQueryValidator(joinQuery), quizmode: true, questions: questions.length };
			setQueries(validatedQuery);

			const query = Object.keys(validatedQuery).map(key => `${key}=${validatedQuery[key]}`).join('&');

			if (!error[0]) {
				router.push({ pathname: '/play', query });
				closeDialog();
			}
		}
	}

	function clickOutsideDialog(e) {
		const rect = dialog.current.getBoundingClientRect()
		if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) {
			closeDialog()
		}
	}

	function closeDialog() {
		playSound('pop-down')
		dialog.current.classList.add('hide')
		function handleAnimationEnd() {
			dialog.current.classList.remove('hide')
			dialog.current.close()
			dialog.current.removeEventListener('animationend', handleAnimationEnd)
		}
		dialog.current.addEventListener('animationend', handleAnimationEnd)
	}

	return (
		<dialog ref={dialog} onClick={(e) => clickOutsideDialog(e)} id="newGameDialog" className='fixed top-1/2 left-1/2 w-[min(92vw,54rem)] max-h-[90vh] -translate-x-1/2 -translate-y-1/2 overflow-y-auto overscroll-contain bg-slate-50 text-slate-900 m-0 rounded-md py-8 px-5 shadow-2xl sm:px-7 md:px-8'>
			<button aria-label='Close play popup' className='absolute top-3 right-3 text-3xl hover:scale-110 transition-all' onClick={closeDialog} >
				<IoCloseSharp />
			</button>

			<form onSubmit={(e) => e.preventDefault()} >
				<div className='mb-5 pr-10'>
					<h2 className='text-2xl font-black tracking-tight'>Play</h2>
				</div>

				<div className='mb-5'>
					<NewGameForm handleInputs={handleInputs} nowQueries={nowQueries} coachTier={coachTier} />
				</div>

				<button type='submit' className='btn-primary uppercase py-3 px-6 w-full tracking-widest' name='newgame' onClick={(e) => handleSubmit(e)}>New game</button>
			</form>

			<div className="my-6 h-px w-full bg-slate-200"></div>
			<form onSubmit={handleSubmit}>
				<div className='flex flex-col gap-4' >
					<QuizBrowser onSelectQuiz={handleSelectQuiz} isOpen={dialogOpen} selectedQuizId={joinQuery.quizId} />
					<JoinGameForm handleInputs={handleJoinInputs} selectedQuizId={joinQuery.quizId} playerName={joinQuery.name} />
				</div>
				<button type='submit' className='btn-primary uppercase py-3 px-6 w-full tracking-widest mt-4' name='joingame' onClick={(e) => handleSubmit(e)}>Join game</button>
			</form>

		</dialog >
	)
}
