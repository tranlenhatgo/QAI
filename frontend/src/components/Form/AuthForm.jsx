import { useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { IoCloseSharp } from 'react-icons/io5';
import playSound from '@/helpers/playSound';
import { useBoundStore } from '@/store/useBoundStore';
import PageLoading from '@/components/PageLoading';

export default function AuthForm() {
	const { dest, setDest, login, register, authloading, loginWithGoogle } = useBoundStore(state => state);
	const dialog = useRef(null);
	const router = useRouter();

	// State for expanding/collapsing the sign-up section
	const [isSignUpExpanded, setIsSignUpExpanded] = useState(false);

	async function handleSubmit(e) {
		e.preventDefault();
		const submitAction = e.nativeEvent?.submitter?.name;

		if (submitAction === 'signUp') {
			await register(e.target.email.value, e.target.signupPassword.value);
			setIsSignUpExpanded(false);
			closeDialog();
			setDest(null);
			return;
		}

		await login(e.target.username.value, e.target.password.value);

		if (dest && dest !== 'create') {
			closeDialog();
			router.push('/' + dest);
		} else if (dest === 'create') {
			closeDialog();
			document.getElementById('createQuizRoomDialog')?.showModal();
		} else {
			closeDialog();
		}

		setDest(null);
	}

	async function handleLogin(e) {
		e.preventDefault();
		if (e.currentTarget.name === 'google') {
			try {
				const user = await loginWithGoogle(); // Wait for the user data to be returned
				if (!user) return;
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

					<button type='submit' name='signUp' className={`${isSignUpExpanded ? '' : 'hidden'} btn-primary uppercase py-3 px-6 w-full mb-5 tracking-widest`}>Sign Up</button>
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
		</>
	);
}
