import Head from 'next/head'
import Link from 'next/link'
import { useEffect, useMemo } from 'react'
import { useRouter } from 'next/router'
import { FiChevronRight, FiMessageSquare, FiMoon, FiPlus, FiSettings, FiTrash2, FiUser } from 'react-icons/fi'
import { useBoundStore } from '@/store/useBoundStore'
import ChatTranscript from '@/components/Chat/ChatTranscript'

function SidebarSection({ title, icon, children, action }) {
	return (
		<section className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-[0_20px_60px_rgba(15,23,42,0.25)] backdrop-blur-sm">
			<div className="mb-4 flex items-center justify-between gap-3">
				<div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.2em] text-slate-300">
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
			className="flex w-full items-center justify-between gap-4 rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-left transition-colors hover:bg-slate-900/90"
		>
			<div>
				<p className="text-sm font-medium text-white">{label}</p>
				<p className="text-xs text-slate-400">{description}</p>
			</div>
			<span className={`flex h-6 w-11 items-center rounded-full p-1 transition-colors ${checked ? 'bg-sky-500' : 'bg-slate-700'}`}>
				<span className={`h-4 w-4 rounded-full bg-white transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
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
		setSidebarSection,
		setSetting,
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
			transport: 'webhook',
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
	const statusText = isConnected
		? (isStreaming ? 'Thinking...' : (isWebhookMode ? 'Webhook API mode' : 'Connected'))
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
				<title>Qraft | Chat</title>
			</Head>

			<div className="min-h-screen bg-[#07101d] text-slate-100">
				<div className="absolute inset-0 -z-0 bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.18),_transparent_28%),radial-gradient(circle_at_80%_0%,_rgba(56,189,248,0.12),_transparent_20%),linear-gradient(180deg,_rgba(2,6,23,0.88),_rgba(15,23,42,0.98))]" />
				<header className="sticky top-0 z-20 border-b border-white/10 bg-slate-950/80 backdrop-blur-xl">
					<div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-4 py-4 md:px-6">
						<div>
							<p className="text-xs uppercase tracking-[0.35em] text-sky-300">Qraft AI</p>
							<h1 className="text-xl font-semibold text-white md:text-2xl">Chat</h1>
						</div>
						<div className="flex items-center gap-3">
							<div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-300 md:flex">
								<span className={`h-2.5 w-2.5 rounded-full ${isConnected ? 'bg-emerald-400' : 'bg-amber-400'}`} />
								<span>{statusText}</span>
							</div>
							<button
								type="button"
								onClick={() => router.push('/')}
								className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/10"
							>
								Back home
							</button>
						</div>
					</div>
				</header>

				<main className="mx-auto grid min-h-[calc(100vh-73px)] max-w-[1600px] grid-cols-1 gap-4 px-4 py-4 lg:grid-cols-[20rem_minmax(0,1fr)] lg:px-6">
					<aside className="flex min-h-0 flex-col gap-4 lg:sticky lg:top-[5.5rem] lg:h-[calc(100vh-7rem)]">
						<SidebarSection
							title="History"
							icon={<FiMessageSquare className="text-sky-300" />}
							action={
								<button
									type="button"
									onClick={() => newConversation('New chat')}
									className="inline-flex items-center gap-2 rounded-full border border-sky-400/30 bg-sky-500/10 px-3 py-1.5 text-xs font-semibold text-sky-200 transition-colors hover:bg-sky-500/20"
								>
									<FiPlus />
									New
								</button>
							}
						>
							<div className="space-y-2">
								{conversations.length === 0 ? (
									<p className="rounded-2xl border border-dashed border-white/10 bg-slate-950/50 px-4 py-6 text-sm text-slate-400">Start a new conversation to build your chat history.</p>
								) : conversations.map(conversation => (
									<div
										key={conversation.id}
										className={`group flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition-colors ${conversation.id === activeConversationId ? 'border-sky-400/40 bg-sky-500/10' : 'border-white/10 bg-slate-950/50 hover:bg-slate-900/80'}`}
									>
										<button
											type="button"
											onClick={() => selectConversation(conversation.id)}
											className="min-w-0 flex-1 text-left"
										>
											<p className="truncate text-sm font-medium text-white">{conversation.title}</p>
											<p className="mt-1 text-xs text-slate-400">{conversation.messages.length} messages</p>
										</button>
										<button
											type="button"
											onClick={() => deleteConversation(conversation.id)}
											className="rounded-full p-2 text-slate-500 transition-colors hover:bg-white/5 hover:text-rose-300"
											aria-label="Delete conversation"
										>
											<FiTrash2 />
										</button>
									</div>
								))}
							</div>
						</SidebarSection>

						<SidebarSection title="Account" icon={<FiUser className="text-sky-300" />}>
							<div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-4">
								<img src={user?.photoURL || '/default-avatar.jpg'} alt="Profile" className="h-12 w-12 rounded-full border border-white/10 object-cover" />
								<div className="min-w-0">
									<p className="truncate text-sm font-semibold text-white">{displayName}</p>
									<p className="truncate text-xs text-slate-400">{displayEmail}</p>
								</div>
							</div>
							<div className="mt-3 flex flex-col gap-2">
								<Link href="/profile" className="inline-flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white transition-colors hover:bg-slate-900/90">
									Profile
									<FiChevronRight className="text-slate-500" />
								</Link>
								{user ? (
									<button type="button" onClick={handleLogout} className="rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm font-medium text-rose-200 transition-colors hover:bg-rose-500/20">
										Log out
									</button>
								) : (
									<button type="button" onClick={handleSignIn} className="rounded-2xl border border-sky-400/20 bg-sky-500/10 px-4 py-3 text-sm font-medium text-sky-200 transition-colors hover:bg-sky-500/20">
										Sign in
									</button>
								)}
							</div>
						</SidebarSection>

						<SidebarSection title="Settings" icon={<FiSettings className="text-sky-300" />}>
							<div className="space-y-3">
								<ToggleRow label="Compact mode" description="Tighter spacing for denser conversations" checked={settings.compactMode} onChange={value => setSetting('compactMode', value)} />
								<ToggleRow label="Show timestamps" description="Display message times in chat history" checked={settings.showTimestamps} onChange={value => setSetting('showTimestamps', value)} />
								<ToggleRow label="Auto connect" description="Reconnect the chat when this page is open" checked={settings.autoConnect} onChange={value => setSetting('autoConnect', value)} />
							</div>
							<div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-xs uppercase tracking-[0.22em] text-slate-500">
								Study coach is ready to help.
							</div>
						</SidebarSection>
					</aside>

					<section className="min-h-0 rounded-[2rem] border border-white/10 bg-slate-950/70 shadow-[0_30px_100px_rgba(15,23,42,0.35)] backdrop-blur-sm">
						<div className="flex h-full min-h-[calc(100vh-8rem)] flex-col">
							<div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4 md:px-6">
								<div>
									<p className="text-xs uppercase tracking-[0.3em] text-sky-300">Conversation</p>
									<h2 className="text-lg font-semibold text-white">{activeTitle}</h2>
								</div>
								<div className="hidden rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300 md:block">
									{isConnected ? (isStreaming ? 'Generating response...' : (isWebhookMode ? 'Using webhook API' : 'Connected')) : 'Waiting for connection'}
								</div>
							</div>

							<div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-6">
								{messages.length === 0 ? (
									<div className="flex h-full min-h-[24rem] flex-col items-center justify-center rounded-[2rem] border border-dashed border-white/10 bg-white/5 px-6 text-center">
										<div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-sky-500/15 text-sky-300">
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
				</main>
			</div>
		</>
	)
}