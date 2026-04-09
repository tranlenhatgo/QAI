export default function ProfileInfo({ user, logout }) {
	return (
		<article className='bg-gradient-to-br from-white to-blue-50 p-5 rounded-xl shadow-md border border-blue-100 w-full text-black'>
			{/* Compact Header */}
			<div className='flex items-center gap-3 mb-4 pb-4 border-b border-blue-200'>
				<img
					src={user?.photoURL || '/default-avatar.jpg'}
					alt="Profile Picture"
					className="w-16 h-16 rounded-full border-2 border-blue-400 shadow-md"
				/>
				<div>
					<h3 className='text-xl font-bold text-blue-900'>{user?.displayName || "User"}</h3>
					<p className='text-sm text-gray-600'>{user?.email}</p>
				</div>
			</div>

			{/* Quick Stats */}
			<div className='grid grid-cols-2 gap-3 mb-4'>
				<div className='bg-blue-100 p-3 rounded-lg'>
					<p className='text-xs font-semibold text-gray-600 uppercase'>Tests Taken</p>
					<p className='text-2xl font-bold text-blue-600'>-</p>
				</div>
				<div className='bg-green-100 p-3 rounded-lg'>
					<p className='text-xs font-semibold text-gray-600 uppercase'>Avg Score</p>
					<p className='text-2xl font-bold text-green-600'>-</p>
				</div>
			</div>

			{/* Logout Button */}
			<button 
				className="w-full btn-primary wrongAnswer py-2 px-4 rounded-lg transition-all" 
				onClick={logout}
			>
				Logout
			</button>
		</article>
	)
}
