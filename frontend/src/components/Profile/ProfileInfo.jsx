import { useQraftBalance } from '@/hooks/useQraftBalance';
import { BiRefresh } from 'react-icons/bi';

export default function ProfileInfo({ user, logout }) {
	const { balance, loading, refresh } = useQraftBalance(user);
	
	return (
		<article className='bg-white p-6 rounded-md shadow-md w-full max-w-md text-black'>
			<img
				src={user?.photoURL || '/default-avatar.jpg'}
				alt="Profile Picture"
				className="w-24 h-24 rounded-full mb-4 mx-auto"
			/>
			<h1 className='text-3xl font-bold mb-4'>{user ? user?.displayName : "Username"}</h1>
			<div className='text-left'>
				<p><strong>Username:</strong> {user?.displayName}</p>
				<p><strong>Email:</strong> {user?.email}</p>
				<p><strong>Wallet:</strong> {user?.walletAddress ? `${user.walletAddress.slice(0, 6)}...${user.walletAddress.slice(-4)}` : 'Not connected'}</p>
				<p className='flex items-center gap-2'>
					<strong>QRAFT Balance:</strong> 
					{loading ? (
						<span className="text-blue-500">Loading...</span>
					) : (
						<>
							<span className="text-green-600 font-bold">🪙 {balance.toFixed(2)}</span>
							<button 
								onClick={refresh} 
								className="text-blue-500 hover:text-blue-700 transition-colors"
								title="Refresh balance"
								disabled={loading}
							>
								<BiRefresh className={loading ? 'animate-spin' : ''} />
							</button>
						</>
					)}
				</p>
				<p><strong>Test Completed:</strong></p>
				<p><strong>Average Score (%):</strong></p>
				
			</div>
			<button className="btn-primary mt-4" onClick={logout}>Logout</button>
		</article>
	)
}
