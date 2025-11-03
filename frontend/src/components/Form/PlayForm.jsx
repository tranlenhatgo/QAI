import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/router'

import NewGameForm from './NewGameForm'
import { IoCloseSharp } from 'react-icons/io5'
import playSound from '@/helpers/playSound'
import queryValidator, { quizQueryValidator } from '@/helpers/gameConfig'
import categoriesJSON from '@/assets/categories.json'
import { useBoundStore } from '@/store/useBoundStore'
import JoinGameForm from './JoinGameForm'

export default function PlayForm() {
	const { getQuestions, cleanQuestions, queries, setQueries, cleanWildCards, takeQuiz, error } = useBoundStore(state => state)
	const [nowQueries, setNowQueries] = useState(queries)
	const [joinQuery, setJoinQuery] = useState(queries)
	const router = useRouter()
	const dialog = useRef(null)

	useEffect(() => setNowQueries(queries), [queries])

	useEffect(() => {
		if (router.isReady && router.pathname === '/play') {
			if (!queries.quizmode) {
				setQueries(queryValidator(router.query));
			}
		}
	}, [router.isReady]);

	useEffect(() => {
		if (error[0]) {
			console.error('Error joining the game:', error[1]);
			alert('Failed to join the game. Returning to the main page.');
			router.push('/');
		}
	}, [error]);

	function handleInputs(e) {
		if (e.target.name === 'infinitymode' || e.target.name === 'timemode') {
			e.target.checked ? playSound('pop-up-on') : playSound('pop-up-off')
			return setNowQueries({ ...nowQueries, [e.target.name]: e.target.name === 'infinitymode' ? !e.target.checked : e.target.checked })
		}

		if (e.target.name === 'categories') {
			e.target.checked ? playSound('pop-up-on') : playSound('pop-up-off')
			return setNowQueries({ ...nowQueries, [e.target.name]: e.target.checked ? [...nowQueries.categories, e.target.value] : nowQueries.categories.filter(cat => cat !== e.target.value) })
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

	async function handleSubmit(e) {
		if (e.target.name === 'newgame') {
			e.preventDefault()
			cleanQuestions()
			cleanWildCards()

			const query = Object.keys(nowQueries)
				.filter(key => !['quizId', 'name'].includes(key)) // Exclude unwanted keys
				.map(key => `${key}=${nowQueries[key]}`)
				.join('&'); 
			setQueries(queryValidator(nowQueries))
			router.push({ pathname: '/play', query })

			const cate = nowQueries.categories.map(cat => categoriesJSON.find(c => c.id === cat).name)
			if (router.pathname === '/play') getQuestions(cate, nowQueries.infinitymode ? 5 : nowQueries.questions)

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
		<dialog ref={dialog} onClick={(e) => clickOutsideDialog(e)} id="newGameDialog" className='fixed top-1/2 w-5/6 sm:w-fit left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white text-slate-900 m-0 backdrop-blur-lg rounded-md py-9 px-8 md:px-11'>
			<button className='absolute top-2 right-2 text-3xl hover:scale-110 transition-all' onClick={closeDialog} >
				<IoCloseSharp />
			</button>

			<form onSubmit={(e) => e.preventDefault()} >
				<div className='flex flex-col sm:flex-row gap-4 sm:gap-8 mb-4 md:mb-8'>
					<NewGameForm handleInputs={handleInputs} nowQueries={nowQueries} />
				</div>

				<button type='submit' className='btn-primary uppercase py-3 px-6 w-full tracking-widest' name='newgame' onClick={(e) => handleSubmit(e)}>New game</button>
			</form>

			<div className="my-6 border-t border-gray-300 w-full"></div>
			<form onSubmit={handleSubmit}>
				<div className='flex flex-col gap-4' >
					<JoinGameForm handleInputs={handleJoinInputs} />
				</div>
				<button type='submit' className='btn-primary uppercase py-3 px-6 w-full tracking-widest mt-4' name='joingame' onClick={(e) => handleSubmit(e)}>Join game</button>
			</form>

		</dialog >
	)
}
