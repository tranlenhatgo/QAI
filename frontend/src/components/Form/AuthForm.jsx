import { useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { IoCloseSharp } from 'react-icons/io5';
import playSound from '@/helpers/playSound';
import { useBoundStore } from '@/store/useBoundStore';
import PageLoading from '@/components/PageLoading';
import { shallow } from 'zustand/shallow';
import { FiMail, FiLock, FiUser, FiAlertCircle } from 'react-icons/fi';

const WEAK_PASSWORD_MESSAGE = 'Must be at least 6 characters.';
const LOGIN_ERROR_MESSAGE = 'Invalid email or password.';
const SIGNUP_ERROR_MESSAGE = 'Could not create account. Please check your details.';

function getAuthErrorMessage(error, fallbackMessage) {
	if (error?.code === 'auth/weak-password') return WEAK_PASSWORD_MESSAGE;
	if (error?.code === 'auth/invalid-email') return 'Enter a valid email address.';
	if (error?.code === 'auth/email-already-in-use') return 'This email is already registered.';
	if (error?.code === 'auth/network-request-failed') return 'Network error. Please try again.';
	if (error?.code === 'auth/operation-not-allowed') return 'Email sign up is not enabled.';
	if (error?.code === 'auth/invalid-credential' || error?.code === 'auth/user-not-found' || error?.code === 'auth/wrong-password') {
		return LOGIN_ERROR_MESSAGE;
	}
	return fallbackMessage;
}

export default function AuthForm() {
	const { dest, setDest, login, register, authloading, loginWithGoogle } = useBoundStore(state => ({
		dest: state.dest,
		setDest: state.setDest,
		login: state.login,
		register: state.register,
		authloading: state.authloading,
		loginWithGoogle: state.loginWithGoogle,
	}), shallow);
	const dialog = useRef(null);
	const router = useRouter();

	// Whitelist of valid post-auth redirect destinations to prevent open redirects
	const ALLOWED_DESTS = ['profile', 'create', 'play', 'chat', 'coach'];

	// State for expanding/collapsing the sign-up section
	const [isSignUpExpanded, setIsSignUpExpanded] = useState(false);
	const [authError, setAuthError] = useState('');

	async function handleSubmit(e) {
		e.preventDefault();
		setAuthError('');
		const submitAction = e.nativeEvent?.submitter?.name;

		if (submitAction === 'signUp') {
			const email = e.currentTarget.elements.email.value;
			const displayName = e.currentTarget.elements.signupUsername.value.trim();
			const password = e.currentTarget.elements.signupPassword.value;

			if (password.length < 6) {
				setAuthError(WEAK_PASSWORD_MESSAGE);
				return;
			}

			try {
				await register(email, password, displayName);
			} catch (error) {
				setAuthError(getAuthErrorMessage(error, SIGNUP_ERROR_MESSAGE));
				return;
			}

			setIsSignUpExpanded(false);
			closeDialog();
			if (dest === 'coach') {
				router.push('/coach');
			}
			setDest(null);
			return;
		}

		try {
			await login(e.currentTarget.elements.loginEmail.value, e.currentTarget.elements.password.value);
		} catch (error) {
			setAuthError(getAuthErrorMessage(error, LOGIN_ERROR_MESSAGE));
			return;
		}

		if (dest === 'create') {
			closeDialog();
			document.getElementById('createQuizRoomDialog')?.showModal();
		} else if (dest && ALLOWED_DESTS.includes(dest)) {
			closeDialog();
			router.push('/' + dest);
		} else {
			closeDialog();
		}

		setDest(null);
	}

	async function handleLogin(e) {
		e.preventDefault();
		setAuthError('');
		if (e.currentTarget.name === 'google') {
			try {
				const user = await loginWithGoogle(); // Wait for the user data to be returned
				if (!user) return;
				closeDialog(); // Close the dialog
				if (dest === 'create') {
					document.getElementById('createQuizRoomDialog')?.showModal();
				} else if (dest && ALLOWED_DESTS.includes(dest)) {
					router.push('/' + dest);
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
		setAuthError('');
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
			<PageLoading visible={authloading} />
			<dialog
				ref={dialog}
				onClick={(e) => clickOutsideDialog(e)}
				id="authDialog"
				className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-[400px] bg-white text-slate-800 m-0 rounded-2xl p-6 sm:p-8 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.1),_0_0_50px_rgba(99,102,241,0.06)] border border-slate-100 backdrop-blur-xl overflow-hidden"
			>
				{/* Ambient glowing background decoration */}
				<div className="absolute top-0 -left-12 w-48 h-48 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none"></div>
				<div className="absolute bottom-0 -right-12 w-48 h-48 bg-violet-500/5 rounded-full blur-3xl pointer-events-none"></div>

				<button
					className="absolute top-3 right-3 text-slate-400 hover:text-slate-700 hover:bg-slate-100 p-1.5 rounded-full transition-all border border-transparent hover:border-slate-200 z-20 focus:outline-none"
					onClick={closeDialog}
					aria-label="Close"
				>
					<IoCloseSharp className="text-xl" />
				</button>

				<form onSubmit={handleSubmit} className="relative z-10">
					{/* Header section */}
					<div className="flex flex-col items-center mb-6 mt-2">
						<div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/25 mb-3">
							<svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
							</svg>
						</div>
						<h2 className="text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-700 tracking-tight">
							{isSignUpExpanded ? 'Create Account' : 'Welcome to Qraft'}
						</h2>
						<p className="text-xs text-slate-500 mt-1 text-center max-w-[280px]">
							{isSignUpExpanded
								? 'Sign up to customize avatars, track progress, and build quizzes!'
								: 'Log in to start your quest, challenge friends, and track achievements.'}
						</p>
					</div>

					{/* Inputs Container with height transition */}
					<div
						className="relative overflow-hidden transition-all duration-500 ease-in-out"
						style={{ minHeight: isSignUpExpanded ? '196px' : '116px' }}
					>
						{/* Login form segment */}
						<div
							className={`w-full transition-all duration-500 ease-in-out ${
								isSignUpExpanded
									? 'opacity-0 translate-y-4 pointer-events-none absolute inset-x-0 top-0'
									: 'opacity-100 translate-y-0 relative'
							}`}
						>
							<div className="flex flex-col gap-3">
								<div className="relative">
									<span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 pointer-events-none">
										<FiMail className="w-5 h-5" />
									</span>
									<input
										type="email"
										name="loginEmail"
										placeholder="Email Address"
										required={!isSignUpExpanded}
										className="w-full bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 focus:bg-white rounded-xl py-3 pl-11 pr-4 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
									/>
								</div>
								<div className="relative">
									<span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 pointer-events-none">
										<FiLock className="w-5 h-5" />
									</span>
									<input
										type="password"
										name="password"
										placeholder="Password"
										required={!isSignUpExpanded}
										className="w-full bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 focus:bg-white rounded-xl py-3 pl-11 pr-4 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
									/>
								</div>
							</div>
						</div>

						{/* Sign Up form segment */}
						<div
							className={`w-full transition-all duration-500 ease-in-out ${
								isSignUpExpanded
									? 'opacity-100 translate-y-0 relative'
									: 'opacity-0 -translate-y-4 pointer-events-none absolute inset-x-0 top-0'
							}`}
						>
							<div className="flex flex-col gap-3">
								<div className="relative">
									<span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 pointer-events-none">
										<FiMail className="w-5 h-5" />
									</span>
									<input
										type="email"
										name="email"
										placeholder="Email Address"
										required={isSignUpExpanded}
										className="w-full bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 focus:bg-white rounded-xl py-3 pl-11 pr-4 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
									/>
								</div>
								<div className="relative">
									<span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 pointer-events-none">
										<FiUser className="w-5 h-5" />
									</span>
									<input
										type="text"
										name="signupUsername"
										placeholder="Username"
										required={isSignUpExpanded}
										className="w-full bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 focus:bg-white rounded-xl py-3 pl-11 pr-4 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
									/>
								</div>
								<div className="relative">
									<span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 pointer-events-none">
										<FiLock className="w-5 h-5" />
									</span>
									<input
										type="password"
										name="signupPassword"
										placeholder="Password"
										required={isSignUpExpanded}
										className="w-full bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 focus:bg-white rounded-xl py-3 pl-11 pr-4 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
									/>
								</div>
							</div>
						</div>
					</div>

					{/* Error Alert */}
					{authError && (
						<div role="alert" className="flex items-start gap-2 mt-4 bg-rose-50 border border-rose-100 text-rose-600 rounded-xl p-3 text-xs font-medium">
							<FiAlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
							<span>{authError}</span>
						</div>
					)}

					<div className="mt-6">
						<button
							type={isSignUpExpanded ? 'submit' : 'button'}
							name="signUp"
							className={`${isSignUpExpanded ? '' : 'hidden'} w-full bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-700 hover:via-purple-700 hover:to-pink-700 text-white font-bold py-3 px-6 rounded-xl shadow-[0_4px_20px_rgba(99,102,241,0.15)] hover:shadow-[0_4px_25px_rgba(99,102,241,0.3)] transition-all duration-300 hover:-translate-y-0.5 active:translate-y-0 uppercase text-xs tracking-widest`}
						>
							Sign Up
						</button>
						<button
							type={isSignUpExpanded ? 'button' : 'submit'}
							name="login"
							className={`${isSignUpExpanded ? 'hidden' : ''} w-full bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-700 hover:via-purple-700 hover:to-pink-700 text-white font-bold py-3 px-6 rounded-xl shadow-[0_4px_20px_rgba(99,102,241,0.15)] hover:shadow-[0_4px_25px_rgba(99,102,241,0.3)] transition-all duration-300 hover:-translate-y-0.5 active:translate-y-0 uppercase text-xs tracking-widest`}
						>
							Log In
						</button>
					</div>

					{/* Switch Auth mode text */}
					<div className="flex justify-center items-center mt-4 text-xs sm:text-sm">
						<span className="text-slate-500">
							{isSignUpExpanded ? 'Already have an account?' : "Don't have an account?"}
						</span>
						<button
							type="button"
							onClick={() => setIsSignUpExpanded(!isSignUpExpanded)}
							className="ml-1.5 text-indigo-600 hover:text-indigo-500 font-bold hover:underline transition-all focus:outline-none"
						>
							{isSignUpExpanded ? 'Log In' : 'Sign Up'}
						</button>
					</div>

					{/* Divider */}
					<div className="relative flex py-4 items-center mt-2">
						<div className="flex-grow border-t border-slate-200"></div>
						<span className="flex-shrink mx-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">or</span>
						<div className="flex-grow border-t border-slate-200"></div>
					</div>

					{/* Google login button */}
					<button
						type="button"
						name="google"
						className="flex items-center justify-center gap-3 w-full py-3 px-6 bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-xl shadow-sm text-slate-700 hover:text-slate-900 font-medium text-sm transition-all duration-300 hover:-translate-y-0.5 active:translate-y-0 focus:outline-none"
						onClick={(e) => handleLogin(e)}
					>
						<svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
							<path
								fill="#EA4335"
								d="M5.266 9.765A7.077 7.077 0 0112 4.909c1.69 0 3.218.6 4.418 1.582l3.51-3.51C17.642 1.09 14.99 0 12 0 7.354 0 3.394 2.673 1.488 6.564l3.778 3.201z"
							/>
							<path
								fill="#34A853"
								d="M16.04 15.342c-1.044.697-2.4 1.137-4.04 1.137a7.07 7.07 0 01-6.734-4.856L1.488 14.83C3.394 18.724 7.354 21.39 12 21.39c2.909 0 5.618-1.045 7.645-2.836l-3.605-3.212z"
							/>
							<path
								fill="#4285F4"
								d="M23.49 12.275c0-.818-.08-1.609-.218-2.373H12v4.582h6.455c-.29 1.518-1.145 2.809-2.427 3.655l3.605 3.212c2.109-1.954 3.354-4.836 3.354-8.076z"
							/>
							<path
								fill="#FBBC05"
								d="M5.266 14.235A7.067 7.067 0 014.91 12c0-.783.136-1.536.355-2.235L1.488 6.564C.545 8.218 0 10.055 0 12c0 1.945.545 3.782 1.488 5.436l3.778-3.201z"
							/>
						</svg>
						<span>Sign in with Google</span>
					</button>
				</form>
			</dialog>
		</>
	);
}
