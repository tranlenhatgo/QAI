import { BiArrowBack } from 'react-icons/bi'
import { useRouter } from 'next/router'

export default function ProfileHeader() {
	const router = useRouter()

	return (
		<nav className='flex gap-4 p-4 fixed top-2 left-2 z-50'>
			<button onClick={() => router.push('/')} className='hover:scale-105 transition-all p-1 bg-white rounded shadow-lg'>
				<BiArrowBack color='#0f172a' className='text-4xl' title='Go back' />
			</button>
		</nav>
	)
}
