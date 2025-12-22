import { useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { IoCloseSharp } from 'react-icons/io5';
import playSound from '@/helpers/playSound';
import { useBoundStore } from '@/store/useBoundStore';
import PageLoading from '@/components/PageLoading';

export default function AuthForm() {
	const { dest, setDest, login, authloading, loginWithGoogle, logout, register, privateKeyToShow, setPrivateKeyToShow } = useBoundStore(state => state);
	const dialog = useRef(null);
	const privateKeyDialog = useRef(null);
	const router = useRouter();

	// State for expanding/collapsing the sign-up section
	const [isSignUpExpanded, setIsSignUpExpanded] = useState(false);
	const [copiedPrivateKey, setCopiedPrivateKey] = useState(false);

	async function handleSubmit(e) {
		e.preventDefault();
		
		if (isSignUpExpanded) {
			// Handle sign up
			await register(e.target.email.value, e.target.signupPassword.value);
			// Show private key dialog
			privateKeyDialog.current?.showModal();
			closeDialog();
		} else {
			// Handle login
			if (dest && dest !== 'create') {
				await login(e.target.username.value, e.target.password.value).then(closeDialog()).then(router.push('/' + dest));
			} else if (dest === 'create') {
				await login(e.target.username.value, e.target.password.value).then(closeDialog()).then(document.getElementById('createQuizRoomDialog')?.showModal());
			}
			setDest(null);
		}
	}

	async function handleLogin(e) {
		e.preventDefault();
		if (e.target.name === 'google') {
			try {
				const user = await loginWithGoogle(); // Wait for the user data to be returned
				sessionStorage.setItem('user', JSON.stringify(user)); // Store the user in sessionStorage
				closeDialog(); // Close the dialog
				if (dest === 'create') {
					document.getElementById('createQuizRoomDialog')?.showModal(); // Open the create quiz room dialog
				} else if (dest) {
					router.push('/' + dest); // Redirect to the destination
				}
			} catch (error) {
				console.error('Google login failed:', error);
			}
		}
	}

	function clickOutsideDialog(e) {
		const rect = dialog.current.getBoundingClientRect();
		if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) {
			closeDialog();
		}
	}

	function closeDialog() {
		playSound('pop-down');
		dialog.current.classList.add('hide');
		function handleAnimationEnd() {
			dialog.current.classList.remove('hide');
			dialog.current.close();
			dialog.current.removeEventListener('animationend', handleAnimationEnd);
		}
		dialog.current.addEventListener('animationend', handleAnimationEnd);
	}

	function closePrivateKeyDialog() {
		playSound('pop-down');
		setCopiedPrivateKey(false);
		setPrivateKeyToShow(null);
		privateKeyDialog.current?.close();
	}

	function copyPrivateKey() {
		if (privateKeyToShow) {
			navigator.clipboard.writeText(privateKeyToShow);
			setCopiedPrivateKey(true);
			setTimeout(() => setCopiedPrivateKey(false), 3000);
		}
	}

	return (
		<>
			{authloading && <PageLoading />}
			<dialog ref={dialog} onClick={(e) => clickOutsideDialog(e)} id="authDialog" className='fixed top-1/2 w-5/6 sm:w-fit left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white text-slate-900 m-0 backdrop-blur-lg rounded-md py-9 px-8 md:px-11'>
				<button className='absolute top-2 right-2 text-3xl hover:scale-110 transition-all' onClick={closeDialog} >
					<IoCloseSharp />
				</button>

				<form onSubmit={handleSubmit}>
					<div className='flex flex-col sm:flex-row gap-4 sm:gap-8 '>
						<div className={`expandable ${isSignUpExpanded ? '' : 'expanded py-2'}`}>
							{!isSignUpExpanded && ( // Render only when not in Sign-Up mode
								<div className='flex flex-col gap-4'>
									<label className='flex flex-col'>
										<span className='font-semibold mb-2'>Username</span>
										<input type='text' name='username' className='p-2 mx-2 border rounded' required />
									</label>
									<label className='flex flex-col'>
										<span className='font-semibold mb-2'>Password</span>
										<input type='password' name='password' className='p-2 mx-2 border rounded' required />
									</label>
								</div>
							)}
						</div>
					</div>

					<div className="flex flex-col sm:flex-row gap-4 sm:gap-8 ">
						<div className={`expandable ${isSignUpExpanded ? 'expanded py-2' : ''}`}>
							{isSignUpExpanded && ( // Render only when in Sign-Up mode
								<div className='flex flex-col gap-4'>
									<label className='flex flex-col'>
										<span className='font-semibold mb-2'>Email</span>
										<input type='email' name='email' className='p-2 mx-2 border rounded' required />
									</label>
									<label className='flex flex-col'>
										<span className='font-semibold mb-2'>Username</span>
										<input type='text' name='signupUsername' className='p-2 mx-2 border rounded' required />
									</label>
									<label className='flex flex-col'>
										<span className='font-semibold mb-2'>Password</span>
										<input type='password' name='signupPassword' className='p-2 mx-2 border rounded' required />
									</label>
								</div>
							)}
						</div>
					</div>

					<hr className='my-4' />

					<button type='submit' name='singUp' className={`${isSignUpExpanded ? '' : 'hidden'} btn-primary uppercase py-3 px-6 w-full mb-5 tracking-widest`}>Sign Up</button>
					<button type='submit' name='login' className={`${isSignUpExpanded ? 'hidden' : ''} btn-primary uppercase py-3 px-6 w-full mb-5 tracking-widest`}>Login</button>
					<div
						className="flex justify-center items-center cursor-pointer"
						onClick={() => setIsSignUpExpanded(!isSignUpExpanded)}
					>
						<span className="text-gray-700 font-medium underline underline-offset-2">{isSignUpExpanded ? 'Login' : 'Sign-Up'}</span>
					</div>
					{/* Google OAuth Button */}
					<div className="flex flex-col items-center gap-4 my-4">
						<span className="text-gray-500 text-sm">or</span>
						<button
							type="button"
							name='google'
							className="flex items-center justify-center gap-2 w-full py-3 px-6 border border-gray-300 rounded-md shadow-sm hover:bg-gray-100 transition-all"
							onClick={(e) => handleLogin(e)}
						>
							<img
								src="https://developers.google.com/identity/images/g-logo.png"
								alt="Google Logo"
								className="w-5 h-5"
							/>
							<span className="text-sm font-medium text-gray-700">Sign in with Google</span>
						</button>
					</div>
				</form>
			</dialog>

			{/* Private Key Dialog */}
			<dialog ref={privateKeyDialog} className='fixed top-1/2 w-11/12 sm:w-[600px] left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white text-slate-900 m-0 backdrop-blur-lg rounded-md py-9 px-8 md:px-11 z-50'>
				<button className='absolute top-2 right-2 text-3xl hover:scale-110 transition-all' onClick={closePrivateKeyDialog}>
					<IoCloseSharp />
				</button>

				<div className='flex flex-col gap-4'>
					<h2 className='text-2xl font-bold text-center text-red-600'>⚠️ Important: Save Your Private Key</h2>
					
					<div className='bg-yellow-50 border-l-4 border-yellow-400 p-4'>
						<p className='text-sm text-yellow-800 font-semibold'>
							This is your ONLY chance to save your wallet's private key!
						</p>
						<ul className='list-disc list-inside text-sm text-yellow-700 mt-2 space-y-1'>
							<li>Without this key, you cannot access your QRAFT tokens</li>
							<li>We do NOT store this key - if you lose it, your tokens are lost forever</li>
							<li>Never share this key with anyone</li>
							<li>Store it in a secure password manager or write it down and keep it safe</li>
						</ul>
					</div>

					<div className='bg-gray-100 p-4 rounded-md break-all font-mono text-sm'>
						{privateKeyToShow}
					</div>

					<button
						onClick={copyPrivateKey}
						className='btn-primary py-3 px-6 w-full'
					>
						{copiedPrivateKey ? '✓ Copied!' : '📋 Copy Private Key'}
					</button>

					<button
						onClick={closePrivateKeyDialog}
						className='bg-red-500 text-white py-3 px-6 w-full rounded-md hover:bg-red-600 transition-colors font-semibold'
					>
						I have saved my private key
					</button>
				</div>
			</dialog>
		</>
	);
}
