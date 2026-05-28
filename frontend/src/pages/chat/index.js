import Head from 'next/head'
import Link from 'next/link'
import { useEffect, useMemo } from 'react'
import { useRouter } from 'next/router'
import { BiArrowBack } from 'react-icons/bi'
import { FiChevronRight, FiMessageSquare, FiPlus, FiSettings, FiTrash2, FiUser } from 'react-icons/fi'
import { useBoundStore } from '@/store/useBoundStore'
import ChatTranscript from '@/components/Chat/ChatTranscript'
import PageFooter from '@/components/PageFooter'

function SidebarSection({ title, icon, children, action }) {
	return (
		<section className="rounded-xl bg-white shadow-md border border-gray-100 p-4">
			<div className="mb-4 flex items-center justify-between gap-3">
				<div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-500">
					{icon}
					<span>{title}</span>
				</div>
				{action}
			</div>
			{children}
		</section>
	)
}

function ToggleRow({ label, description, checked, onChange }) {
	return (
		<button
			type="button"
			onClick={() => onChange(!checked)}
			className="flex w-full items-center justify-between gap-4 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-left transition-colors hover:bg-gray-100"
		>
			<div>
				<p className="text-sm font-medium text-slate-800">{label}</p>
				<p className="text-xs text-slate-500">{description}</p>
			</div>
			<span className={`flex h-6 w-11 items-center rounded-full p-1 transition-colors ${checked ? 'bg-blue-500' : 'bg-gray-300'}`}>
				<span className={`h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
			</span>
		</button>
	)
}

export default function ChatPage() {
	const router = useRouter()
	const {
		chatReady,
		hydrateChat,
		setChatConfig,
		setChatSessionActive,
		connectChat,
		disconnectChat,
		ensureConversation,
		newConversation,
		selectConversation,
		deleteConversation,
		clearAllConversations,
		setSidebarSection,
		setSetting,
		setChatMode,
		sendChatMessage,
		setDraft,
		chatConfig,
		user,
		authloading,
		logout,
		isConnected,
		isStreaming,
		draft,
		streamingText,
		settings,
		conversations,
		activeConversationId,
	} = useBoundStore(state => state)

	useEffect(() => {
		if (!chatReady) {
			hydrateChat()
		}
		setChatConfig({
			userId: user?.uid ?? 'anonymous',
			serverUrl: chatConfig.serverUrl,
			transport: 'websocket',
			hiddenPaths: ['/chat'],
		})
		setChatSessionActive(true)
		ensureConversation()
		connectChat()

		return () => {
			setChatSessionActive(false)
			disconnectChat()
		}
	}, [chatReady, hydrateChat, setChatConfig, user?.uid, chatConfig.serverUrl, setChatSessionActive, ensureConversation, connectChat, disconnectChat])

	const activeConversation = useMemo(
		() => conversations.find(conversation => conversation.id === activeConversationId) || null,
		[conversations, activeConversationId],
	)

	const messages = activeConversation?.messages || []
	const displayName = user?.displayName || 'Guest'
	const displayEmail = user?.email || 'No account connected'
	const activeTitle = activeConversation?.title || 'New chat'
	const isWebhookMode = (chatConfig?.transport || 'webhook') === 'webhook'
	const chatMode = chatConfig?.chatMode === 'agentic' ? 'agentic' : 'simple'
	const statusText = isConnected
		? (isStreaming ? 'Thinking...' : (chatMode === 'agentic' ? 'Agentic mode' : 'Chat mode'))
		: 'Reconnecting...'

	function handleLogout() {
		logout().then(() => router.push('/'))
	}

	function handleSignIn() {
		document.getElementById('authDialog')?.showModal()
	}

	return (
		<>
			<Head>
				<title>QAI | Chat</title>
			</Head>

			{/* Header - matches ProfileHeader style */}
			<nav className='sticky top-0 z-50 w-full bg-[url("/profile-header.svg")] bg-horizontal-scroll-animation shadow-lg'>
				<div className='max-w-7xl mx-auto px-4 md:px-8 py-4 flex items-center justify-between gap-4'>
					<button
						onClick={() => router.push('/')}
						className='flex items-center gap-2 text-white hover:opacity-80 transition-opacity p-2 rounded-lg hover:bg-blue-700'
					>
						<BiArrowBack className='text-2xl' title='Go back' />
					</button>

					<div className='flex items-center gap-3 flex-1'>
						<div className='bg-black bg-opacity-40 backdrop-blur-sm rounded-lg px-4 py-2'>
							<h1 className='text-white font-bold text-lg'>AI Study Coach</h1>
							<p className='text-blue-100 text-sm'>{statusText}</p>
						</div>
					</div>

					<div className='hidden sm:flex items-center gap-2 bg-black bg-opacity-30 backdrop-blur-sm rounded-lg px-3 py-1.5'>
						<span className={`h-2.5 w-2.5 rounded-full ${isConnected ? 'bg-emerald-400' : 'bg-amber-400'}`} />
						<span className='text-sm text-white/80'>{isConnected ? 'Online' : 'Offline'}</span>
					</div>
				</div>
			</nav>

			{/* Main content */}
			<main className='max-w-7xl mx-auto px-4 md:px-8 pt-6 pb-16'>
				<div className='grid grid-cols-1 lg:grid-cols-[20rem_minmax(0,1fr)] gap-6'>
					{/* Sidebar */}
					<aside className='flex flex-col gap-4 lg:sticky lg:top-20 h-fit'>
						{/* History */}
						<SidebarSection
							title="History"
							icon={<FiMessageSquare className="text-blue-500" />}
							action={
								<div className="flex items-center gap-2">
									<button
										type="button"
										onClick={() => { if (window.confirm('Delete all chat history?')) clearAllConversations() }}
										className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 transition-colors hover:bg-red-100"
									>
										<FiTrash2 />
										Clear
									</button>
									<button
										type="button"
										onClick={() => newConversation('New chat')}
										className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-600 transition-colors hover:bg-blue-100"
									>
										<FiPlus />
										New
									</button>
								</div>
							}
						>
							<div className="space-y-2">
								{conversations.length === 0 ? (
									<p className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-sm text-slate-400">Start a new conversation to build your chat history.</p>
								) : conversations.map(conversation => (
									<div
										key={conversation.id}
										className={`group flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${conversation.id === activeConversationId ? 'border-blue-300 bg-blue-50' : 'border-gray-200 bg-gray-50 hover:bg-gray-100'}`}
									>
										<button
											type="button"
											onClick={() => selectConversation(conversation.id)}
											className="min-w-0 flex-1 text-left"
										>
											<p className="truncate text-sm font-medium text-slate-800">{conversation.title}</p>
											<p className="mt-1 text-xs text-slate-400">{conversation.messages.length} messages</p>
										</button>
										<button
											type="button"
											onClick={() => deleteConversation(conversation.id)}
											className="rounded-full p-2 text-slate-400 transition-colors hover:bg-gray-200 hover:text-rose-500"
											aria-label="Delete conversation"
										>
											<FiTrash2 />
										</button>
									</div>
								))}
							</div>
						</SidebarSection>

						{/* Account */}
						<SidebarSection title="Account" icon={<FiUser className="text-blue-500" />}>
							<div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-4">
								<img src={user?.photoURL || '/default-avatar.jpg'} alt="Profile" className="h-12 w-12 rounded-full border-2 border-blue-200 object-cover" />
								<div className="min-w-0">
									<p className="truncate text-sm font-semibold text-slate-800">{displayName}</p>
									<p className="truncate text-xs text-slate-500">{displayEmail}</p>
								</div>
							</div>
							<div className="mt-3 flex flex-col gap-2">
								<Link href="/profile" className="inline-flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-slate-700 transition-colors hover:bg-gray-100">
									Profile
									<FiChevronRight className="text-slate-400" />
								</Link>
								{user ? (
									<button type="button" onClick={handleLogout} className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-600 transition-colors hover:bg-rose-100">
										Log out
									</button>
								) : (
									<button type="button" onClick={handleSignIn} className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-600 transition-colors hover:bg-blue-100">
										Sign in
									</button>
								)}
							</div>
						</SidebarSection>

						{/* Settings */}
						<SidebarSection title="Settings" icon={<FiSettings className="text-blue-500" />}>
							<div className="space-y-3">
								<ToggleRow label="Compact mode" description="Tighter spacing for denser conversations" checked={settings.compactMode} onChange={value => setSetting('compactMode', value)} />
								<ToggleRow label="Show timestamps" description="Display message times in chat history" checked={settings.showTimestamps} onChange={value => setSetting('showTimestamps', value)} />
								<ToggleRow label="Auto connect" description="Reconnect the chat when this page is open" checked={settings.autoConnect} onChange={value => setSetting('autoConnect', value)} />
							</div>
							<div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-xs uppercase tracking-widest text-slate-400">
								Study coach is ready to help.
							</div>
						</SidebarSection>
					</aside>

					{/* Chat panel */}
					<section className="rounded-2xl bg-white shadow-lg overflow-hidden">
						<div className="flex h-full min-h-[calc(100vh-8rem)] flex-col">
							<div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4 md:px-6">
								<div>
									<p className="text-xs uppercase tracking-widest text-blue-900">Conversation</p>
									<h2 className="text-lg font-semibold text-white">{activeTitle}</h2>
								</div>
								<div className="hidden rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-blue-200 md:block">
									{isConnected ? (isStreaming ? 'Generating response...' : (chatMode === 'agentic' ? 'Using agentic API' : 'Using chat API')) : 'Waiting for connection'}
								</div>
							</div>

							<div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-6">
								{messages.length === 0 ? (
									<div className="flex h-full min-h-[24rem] flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/5 px-6 text-center">
										<div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-500/15 text-blue-300">
											<FiMessageSquare className="text-2xl" />
										</div>
										<p className="text-lg font-semibold text-white">Start a new chat</p>
										<p className="mt-2 max-w-md text-sm text-slate-400">Ask for a quiz explanation, a study plan, or a breakdown of your latest answer. The same conversation history is shared with the floating widget.</p>
									</div>
								) : (
									<ChatTranscript
										messages={messages}
										streamingText={streamingText}
										draft={draft}
										setDraft={setDraft}
										onSend={sendChatMessage}
										isConnected={isConnected}
										isStreaming={isStreaming}
										chatMode={chatMode}
										onChatModeChange={setChatMode}
										canSendWithoutSocket={isWebhookMode}
										messageListClassName={`space-y-4 ${settings.compactMode ? 'max-w-4xl' : 'max-w-5xl'} mx-auto`}
										composerClassName="mt-5 mx-auto w-full max-w-5xl"
										placeholder="Message AI Study Coach…"
										compact={settings.compactMode}
									/>
								)}
							</div>
						</div>
					</section>
				</div>
			</main>

			<PageFooter />
		</>
	)
}
