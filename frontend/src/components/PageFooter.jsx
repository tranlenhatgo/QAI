import Image from 'next/image'
import playSound from '@/helpers/playSound'
import { useBoundStore } from '@/store/useBoundStore'
import soundOn from '../assets/sound-on.svg'
import soundOff from '../assets/sound-off.svg'
import { useEffect, useState } from 'react'
import { GoAlert } from 'react-icons/go'
import { FiMessageSquare, FiX } from 'react-icons/fi'
import { useRouter } from 'next/router'

export default function Footer({ alert = false }) {
	const router = useRouter()
	const { toggleChat, isOpen, hasUnread, chatConfig } = useBoundStore(state => state)
	const [sound, setSound] = useState(true)
	const [showInfo, setShowInfo] = useState(false)

	useEffect(() => {
		const savedSound = localStorage.getItem('sound')
		if (savedSound === null) {
			localStorage.setItem('sound', 'true')
			setSound(true)
			return
		}
		setSound(savedSound === 'true')
	}, [])

	useEffect(() => localStorage.setItem('sound', String(sound)), [sound])

	function handleClick(info = false) {
		info ? setShowInfo(!showInfo) : setSound(!sound)
		playSound('switch-on')
	}

	function handleSoundON() {
		setSound(true)
		localStorage.setItem('sound', 'true')
		playSound('switch-on')
	}

	const isChatHidden = chatConfig?.hiddenPaths?.some(path => router.pathname === path)

	return (
		<footer className='fixed right-4 bottom-3 z-20'>
			<nav>
				<ul className='flex gap-4'>
					<li className='relative'>
						{ alert &&
							<>
								<button title='Show info' className={`align-middle relative z-20 hover:scale-105 p-1.5 bg-white rounded-md ${showInfo ? 'scale-110' : ''}`} onClick={() => handleClick(true)}>
									<GoAlert className='text-[25px] mx-auto' color='#0f172a' />
								</button>
								<p className={`absolute bottom-full -right-14 sm:bottom-auto sm:top-[2px] whitespace-pre sm:whitespace-nowrap text-sm md:text-base bg-white text-slate-900 rounded-md py-1 px-4 text-left transition-all ${showInfo ? 'opacity-100 -right-14  sm:!right-7 ' : 'opacity-0 right-0 pointer-events-none'}`}>
									The questions made by AI may have errors. Only some questions are made by AI
								</p>
							</>
						}
					</li>

					<li>
						<button title={sound ? 'Mute' : 'Play music'} className='align-middle hover:scale-105 p-1.5 bg-white rounded-md'>
							{
								sound
									? <Image src={soundOn} alt="" width={25} height={25} onClick={() => setSound(false)} />
									: <Image src={soundOff} alt="" width={25} height={25} onClick={handleSoundON} />
							}
						</button>
					</li>

					{!isChatHidden && (
						<li className='relative'>
							<button
								type='button'
								title={isOpen ? 'Close chat' : 'Open chat'}
								onClick={toggleChat}
								className='relative align-middle hover:scale-105 p-1.5 bg-white rounded-md text-slate-900'
							>
								{isOpen ? <FiX className='text-[25px]' /> : <FiMessageSquare className='text-[25px]' />}
								<span className={`absolute -right-1 -top-1 h-3 w-3 rounded-full bg-emerald-500 border border-white ${hasUnread ? 'opacity-100' : 'opacity-0'}`} />
							</button>
						</li>
					)}
				</ul>
			</nav>
		</footer>
	)
}
