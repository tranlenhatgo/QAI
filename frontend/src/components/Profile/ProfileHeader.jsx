import { BiArrowBack } from 'react-icons/bi'
import { useRouter } from 'next/router'
import { useBoundStore } from '@/store/useBoundStore'
import { getAvatarSrc } from '@/components/Profile/AvatarPicker'

export default function ProfileHeader() {
	const router = useRouter()
	const { user } = useBoundStore(state => state)

	return (
		// <nav className='sticky top-0 z-50 w-full bg-gradient-to-r from-blue-600 to-blue-500 shadow-lg'>
		<nav className='sticky top-0 z-50 w-full bg-[url("/profile-header.svg")] bg-horizontal-scroll-animation shadow-lg'>
			<div className='max-w-7xl mx-auto px-4 md:px-8 py-4 flex items-center justify-between gap-4'>
				{/* Back Button */}
				<button
					onClick={() => router.push('/')}
					className='flex items-center gap-2 text-white hover:opacity-80 transition-opacity p-2 rounded-lg hover:bg-blue-700'
				>
					<BiArrowBack className='text-2xl' title='Go back' />
				</button>

				{/* User Info (Center) */}
				<div className='flex items-center gap-3 flex-1'>
					<img
						src={user?.photoURL || getAvatarSrc(user?.uid)}
						alt="Profile"
						className='w-12 h-12 rounded-full border-2 border-white shadow-md object-cover'
					/>
					<div className='hidden sm:flex sm:flex-col bg-black bg-opacity-40 backdrop-blur-sm rounded-lg px-4 py-2'>
						<h2 className='text-white font-bold text-lg'>{user?.displayName || 'User'}</h2>
						<p className='text-blue-100 text-sm'>{user?.email}</p>
					</div>
				</div>

				{/* Placeholder for spacing */}
				<div className='w-24'></div>
			</div>
		</nav>
	)
}
