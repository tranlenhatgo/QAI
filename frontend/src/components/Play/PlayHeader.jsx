import { BiArrowBack } from 'react-icons/bi'
import { BsArrowRepeat } from 'react-icons/bs'
import Link from 'next/link'
import { useBoundStore } from '@/store/useBoundStore'

export default function PlayHeader () {
	const { cleanQuestions, cleanWildCards, cleanQueries } = useBoundStore(state => state)

	return (
		<nav className='fixed top-4 left-4 z-20'>
			<ul className='flex gap-2'>
				<li>
					<Link href="/" className='group flex items-center justify-center w-10 h-10 bg-white rounded-xl transition-all duration-300 hover:scale-110 active:scale-95 shadow-sm hover:shadow-md'
						onClick={() => { cleanQuestions(); cleanWildCards(); cleanQueries() }}
						title='Go back'
					>
						<BiArrowBack className='text-xl text-slate-900 group-hover:text-blue-500 transition-colors' />
					</Link>
				</li>
				<li>
					<button
						className='group flex items-center justify-center w-10 h-10 bg-white rounded-xl transition-all duration-300 hover:scale-110 hover:rotate-180 active:scale-95 shadow-sm hover:shadow-md'
						onClick={() => document.getElementById('newGameDialog').showModal()}
						title='New game'
					>
						<BsArrowRepeat className='text-xl text-slate-900 group-hover:text-blue-500 transition-colors' />
					</button>
				</li>
			</ul>
		</nav>
	)
}
