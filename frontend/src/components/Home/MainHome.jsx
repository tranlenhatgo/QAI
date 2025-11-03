import categories from '@/assets/categories.json'
import PageFooter from '../PageFooter'
import playSound from '@/helpers/playSound'
import HomeHeader from './HomeHeader'
import { useBoundStore } from '@/store/useBoundStore'

export default function MainHome() {
	const { setDest } = useBoundStore(state => state)
	function handleTitleHover(e) {
		e.target.classList.add('jello-vertical')
		e.target.style.color = categories[Math.floor(Math.random() * categories.length)].color
		e.target.addEventListener('animationend', () => e.target.classList.remove('jello-vertical'))
	}

	const handleTitleLeave = (e) => (e.target.style.color = 'white')

	function handlePlay() {
		playSound('pop')
		document.getElementById('newGameDialog')?.showModal()
	}
	function handleCreate() {
		playSound('pop');
		const user = JSON.parse(sessionStorage.getItem('user')); // Check if the user is authenticated
		if (user) {
			document.getElementById('createQuizRoomDialog')?.showModal(); // Open the create quiz room dialog
		} else {
			setDest('create'); // Set the destination for after login
			document.getElementById('authDialog')?.showModal(); // Show the auth dialog
		}
	}

	return (
		<main className='mainHome bg-vertical-scroll-animation max-w-6xl relative  mx-auto w-full min-h-[25rem] flex gap-4 flex-col justify-between items-center px-5 md:px-10 py-20 lg:col-start-2 lg:row-start-1 lg:row-end-3 text-center text-white'>
			<HomeHeader />
			<article>
				<h1 className='text-8xl font-medium w-full uppercase z-10 relative' translate='no'>
					{'Quizz'.split('').map((letter, index) => (
						<span key={index} id={letter + index + 10} className='relative inline-block transition-all duration-300' onMouseEnter={handleTitleHover} onMouseLeave={handleTitleLeave}>
							{letter}
						</span>
					))}
				</h1>
				<div className='bg-[#1c233a] absolute w-full lg:w-[41.7vw] h-40 top-16 left-0'></div>
				<p className=' mb-20 relative'>
					Play an infinite number of possible questions!
				</p>
			</article>
			<div className='flex flex-col gap-4 mt-auto w-full max-w-md'>
				<button onClick={handlePlay} id='play' href="play" className='btn-primary uppercase px-6 py-4 text-lg w-full' >
					Play
				</button>
				<button onClick={handleCreate} id='create' href="create" className='btn-primary uppercase px-4 py-2 text-md w-full' >
					Create
				</button>
			</div>
			<PageFooter />
		</main >
	)
}
