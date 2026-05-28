import { useState } from 'react'
import { createPortal } from 'react-dom'

const AVATARS = [
	{ id: 'cat', label: 'Cat', src: '/avatars/cat.svg' },
	{ id: 'bear', label: 'Bear', src: '/avatars/bear.svg' },
	{ id: 'frog', label: 'Frog', src: '/avatars/frog.svg' },
	{ id: 'fox', label: 'Fox', src: '/avatars/fox.svg' },
	{ id: 'rabbit', label: 'Rabbit', src: '/avatars/rabbit.svg' },
	{ id: 'panda', label: 'Panda', src: '/avatars/panda.svg' },
	{ id: 'chick', label: 'Chick', src: '/avatars/chick.svg' },
	{ id: 'owl', label: 'Owl', src: '/avatars/owl.svg' },
	{ id: 'whale', label: 'Whale', src: '/avatars/whale.svg' },
	{ id: 'lion', label: 'Lion', src: '/avatars/lion.svg' },
]

const STORAGE_KEY = 'qai-avatar'

export function getAvatarSrc(userId) {
	if (typeof window === 'undefined') return AVATARS[0].src
	const stored = localStorage.getItem(`${STORAGE_KEY}-${userId}`)
	if (stored) {
		const avatar = AVATARS.find(a => a.id === stored)
		if (avatar) return avatar.src
	}
	// Random default based on userId hash
	const hash = (userId || 'x').split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
	return AVATARS[hash % AVATARS.length].src
}

export function getAvatarId(userId) {
	if (typeof window === 'undefined') return AVATARS[0].id
	const stored = localStorage.getItem(`${STORAGE_KEY}-${userId}`)
	if (stored && AVATARS.find(a => a.id === stored)) return stored
	const hash = (userId || 'x').split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
	return AVATARS[hash % AVATARS.length].id
}

function setAvatar(userId, avatarId) {
	localStorage.setItem(`${STORAGE_KEY}-${userId}`, avatarId)
}

export default function AvatarPicker({ userId, onSelect }) {
	const [open, setOpen] = useState(false)
	const currentId = getAvatarId(userId)

	function handlePick(avatar) {
		setAvatar(userId, avatar.id)
		setOpen(false)
		if (onSelect) onSelect(avatar.src)
	}

	return (
		<>
			<button
				type="button"
				onClick={() => setOpen(true)}
				className="group relative"
				title="Change avatar"
			>
				<img
					src={getAvatarSrc(userId)}
					alt="Profile avatar"
					className="h-16 w-16 rounded-full border-2 border-blue-400 shadow-md transition-transform group-hover:scale-105"
				/>
				<span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 text-xs font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100">
					Change
				</span>
			</button>

			{open && createPortal(
				<div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50" onClick={() => setOpen(false)}>
					<div className="w-80 rounded-xl bg-white p-5 shadow-2xl" onClick={e => e.stopPropagation()}>
						<h3 className="mb-4 text-center text-lg font-bold text-slate-800">Choose your avatar</h3>
						<div className="grid grid-cols-5 gap-3">
							{AVATARS.map(avatar => (
								<button
									key={avatar.id}
									type="button"
									onClick={() => handlePick(avatar)}
									className={`rounded-full p-1 transition-all hover:scale-110 ${currentId === avatar.id ? 'ring-3 ring-blue-500 ring-offset-2' : ''}`}
									title={avatar.label}
								>
									<img src={avatar.src} alt={avatar.label} className="h-12 w-12 rounded-full" />
								</button>
							))}
						</div>
						<button
							type="button"
							onClick={() => setOpen(false)}
							className="mt-4 w-full rounded-lg bg-gray-100 py-2 text-sm font-medium text-slate-600 hover:bg-gray-200"
						>
							Cancel
						</button>
					</div>
				</div>,
				document.body
			)}
		</>
	)
}
