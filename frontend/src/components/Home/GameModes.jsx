import { useEffect, useMemo } from 'react'
import { ImInfinite } from 'react-icons/im'
import { BiTimeFive } from 'react-icons/bi'
import { TbDeviceGamepad2 } from 'react-icons/tb'
import { FiMessageSquare, FiRefreshCw } from 'react-icons/fi'
import ChatTranscript from '@/components/Chat/ChatTranscript'
import { useBoundStore } from '@/store/useBoundStore'

const gameModes = [
	{
		icon: <TbDeviceGamepad2 className='text-3xl' />,
		title: 'Classic',
		description: 'Complete questions without fail to win! You have wildcards that can help you'
	},
	{
		icon: <BiTimeFive className='text-3xl' />,
		title: 'Time',
		description: 'Complete questions within the time limit to win! You can use wildcards'
	},
	{
		icon: <ImInfinite className='text-3xl' />,
		title: 'Infinite',
		description: 'Break your record by completing as many questions as you can! You can use wildcards'
	}
]

export default function GameModes () {
	const {
		chatReady,
		hydrateChat,
		setChatSessionActive,
		ensureConversation,
		connectChat,
		disconnectChat,
		sendChatMessage,
		setDraft,
		newConversation,
		isConnected,
		isStreaming,
		draft,
		streamingText,
		conversations,
		activeConversationId,
		chatConfig,
	} = useBoundStore(state => state)

	useEffect(() => {
		if (!chatReady) hydrateChat()
		setChatSessionActive(true)
		ensureConversation()
		connectChat()

		return () => {
			setChatSessionActive(false)
			disconnectChat()
		}
	}, [chatReady, hydrateChat, setChatSessionActive, ensureConversation, connectChat, disconnectChat])

	const activeConversation = useMemo(
		() => conversations.find(conversation => conversation.id === activeConversationId) || null,
		[conversations, activeConversationId],
	)
	const messages = activeConversation?.messages || []
	const isWebhookMode = (chatConfig?.transport || 'webhook') === 'webhook'
	const handleClearChat = () => {
		newConversation('New chat')
	}

	return (
		<section className='lg:max-w-6xl mx-auto lg:col-start-1 lg:col-end-2 px-8 py-6 flex flex-col justify-center bg-[url("/bg-gamemodes.svg")] text-slate-900 w-full'>
			<h2 className='text-2xl mb-4 font-medium '>Game modes </h2>
			<nav>
				<ul className='flex flex-col sm:flex-row justify-center gap-5'>
					{gameModes.map((mode, index) => (
						<li key={index + mode.title} className='bg-neutral-300 max-w-sm md:max-w-none bg-opacity-30 backdrop-blur-[2px] rounded p-5 hover:scale-[1.03] transition-all hover:backdrop-blur-0 hover:bg-opacity-100 hover:bg-white shadow-sm mx-auto'>
							{mode.icon}
							<h3 className='text-xl font-medium my-1'>{mode.title}</h3>
							<p className='text-sm'>{mode.description}</p>
						</li>
					))}
				</ul>
			</nav>
			<section className='mt-5 flex h-[28rem] w-full flex-col overflow-hidden rounded-md border border-blue-100 bg-white text-slate-900 shadow-lg'>
				<div className='sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-blue-600 px-4 py-3'>
					<div className='flex items-center gap-2'>
						<FiMessageSquare className='text-xl' />
						<h3 className='text-base font-semibold text-white'>AI Study Coach</h3>
					</div>
					<button
						type='button'
						onClick={handleClearChat}
						className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-white transition-colors hover:bg-white/15 ${isConnected ? 'bg-emerald-500' : 'bg-amber-500'}`}
						title='Clear chat'
						aria-label='Clear chat'
					>
						<FiRefreshCw className='text-base' />
					</button>
				</div>
				<div className='min-h-0 flex-1 px-4 py-4'>
					<ChatTranscript
						messages={messages}
						streamingText={streamingText}
						draft={draft}
						setDraft={setDraft}
						onSend={sendChatMessage}
						isConnected={isConnected}
						isStreaming={isStreaming}
						canSendWithoutSocket={isWebhookMode}
						messageListClassName='space-y-3'
						composerClassName='mt-4'
						placeholder='Message AI Study Coach...'
						compact={true}
					/>
				</div>
			</section>
		</section>
	)
}
