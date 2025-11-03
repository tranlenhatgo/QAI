import { BsArrowRepeat } from 'react-icons/bs'
import { useBoundStore } from '@/store/useBoundStore'
import { CgProfile } from "react-icons/cg";
import playSound from '@/helpers/playSound'
import { useRouter } from 'next/router';

export default function HomeHeader() {
	const { setDest } = useBoundStore(state => state)
	const router = useRouter();
	function handleLogin() {
		playSound('pop');
		const user = JSON.parse(sessionStorage.getItem('user')); 
		if (user) {
			setDest(null); 
			router.push('/profile'); 
		} else {
			setDest('profile'); 
			document.getElementById('authDialog')?.showModal();
		}
	}
	return (
		<nav className='fixed right-4 top-3 z-20'>
			<ul className='flex gap-4'>
				<li>
					<button href="/" className='block' onClick={handleLogin}>
						<CgProfile color='#0f172a' className='text-4xl hover:scale-105 transition-all  p-1 bg-white rounded' title='Login' />
					</button>
				</li>
			</ul>
		</nav>
	)
}
