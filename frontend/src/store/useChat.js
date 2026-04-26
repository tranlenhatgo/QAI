const CHAT_STORAGE_KEY = 'qraft-chat-state'
const DEFAULT_SERVER_URL = 'https://collected-snore-carving.ngrok-free.dev'
const DEFAULT_HIDDEN_PATHS = ['/chat']
const DEFAULT_CHAT_MODE = 'simple'
const DEFAULT_CHAT_TRANSPORT = 'webhook'

let chatSocket = null
let reconnectTimer = null

function createId(prefix = 'chat') {
	if (typeof crypto !== 'undefined' && crypto.randomUUID) {
		return `${prefix}-${crypto.randomUUID()}`
	}
	return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function now() {
	return new Date().toISOString()
}

function normalizeTitle(text = '') {
	const cleaned = text.trim().replace(/\s+/g, ' ')
	if (!cleaned) return 'New chat'
	const title = cleaned.split(' ').slice(0, 8).join(' ')
	return title.length > 42 ? `${title.slice(0, 42).trim()}…` : title
}

function createConversation(seedTitle = 'New chat') {
	const createdAt = now()
	return {
		id: createId('conversation'),
		title: seedTitle,
		createdAt,
		updatedAt: createdAt,
		messages: [],
	}
}

function createMessage(role, content) {
	return {
		id: createId('message'),
		role,
		content,
		createdAt: now(),
	}
}

function hydrateStorage() {
	if (typeof window === 'undefined') return null
	try {
		const raw = window.localStorage.getItem(CHAT_STORAGE_KEY)
		if (!raw) return null
		const parsed = JSON.parse(raw)
		if (!parsed || typeof parsed !== 'object') return null
		return parsed
	} catch (error) {
		console.warn('[chat] Failed to hydrate local storage state', error)
		return null
	}
}

function persistStorage(state) {
	if (typeof window === 'undefined') return
	try {
		const payload = {
			conversations: state.conversations,
			activeConversationId: state.activeConversationId,
			settings: state.settings,
			sidebarSection: state.sidebarSection,
		}
		window.localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(payload))
	} catch (error) {
		console.warn('[chat] Failed to persist local storage state', error)
	}
}

function normalizeServerRoot(serverUrl = DEFAULT_SERVER_URL) {
	const cleaned = String(serverUrl || DEFAULT_SERVER_URL).trim().replace(/\/+$/, '')
	return cleaned
		.replace(/\/ws\/chat$/i, '')
		.replace(/\/chat\/agentic$/i, '')
		.replace(/\/chat$/i, '')
}

function resolveWsUrl(serverUrl = DEFAULT_SERVER_URL) {
	const root = normalizeServerRoot(serverUrl)

	if (/^ws(s)?:\/\//i.test(root)) {
		return root.endsWith('/ws/chat') ? root : `${root}/ws/chat`
	}

	if (/^http(s)?:\/\//i.test(root)) {
		const wsRoot = root.replace(/^http:\/\//i, 'ws://').replace(/^https:\/\//i, 'wss://')
		return `${wsRoot}/ws/chat`
	}

	return `ws://${root}/ws/chat`
}

function resolveChatHttpUrl(serverUrl = DEFAULT_SERVER_URL, chatMode = DEFAULT_CHAT_MODE) {
	const root = normalizeServerRoot(serverUrl)
	const httpRoot = /^ws(s)?:\/\//i.test(root)
		? root.replace(/^ws:\/\//i, 'http://').replace(/^wss:\/\//i, 'https://')
		: root

	return `${httpRoot}${chatMode === 'agentic' ? '/chat/agentic' : '/chat'}`
}

function updateConversation(conversations, conversationId, updater) {
	return conversations.map(conversation => {
		if (conversation.id !== conversationId) return conversation
		return updater(conversation)
	})
}

function appendMessageToConversation(conversation, message) {
	return {
		...conversation,
		messages: [...conversation.messages, message],
		updatedAt: now(),
	}
}

function updateConversationTitle(conversation, title) {
	if (!conversation || conversation.title !== 'New chat') return conversation
	return {
		...conversation,
		title: normalizeTitle(title),
		updatedAt: now(),
	}
}

async function fallbackRequest(serverUrl, payload, chatMode) {
	const httpUrl = resolveChatHttpUrl(serverUrl, chatMode)
	const response = await fetch(httpUrl, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(payload),
	})
	return response.json()
}

export const useChatStore = (set, get) => ({
	chatReady: false,
	chatConfig: {
		userId: 'anonymous',
		serverUrl: DEFAULT_SERVER_URL,
		hiddenPaths: DEFAULT_HIDDEN_PATHS,
		chatMode: DEFAULT_CHAT_MODE,
		transport: DEFAULT_CHAT_TRANSPORT,
	},
	chatSessionActive: false,
	isOpen: false,
	isConnected: false,
	isStreaming: false,
	hasUnread: false,
	streamingText: '',
	lastWeaknesses: null,
	pendingActions: [],
	draft: '',
	sidebarSection: 'history',
	settings: {
		compactMode: false,
		showTimestamps: true,
		autoConnect: true,
	},
	conversations: [],
	activeConversationId: null,

	setChatConfig: (nextConfig = {}) => {
		set(state => ({
			chatConfig: {
				...state.chatConfig,
				...nextConfig,
				hiddenPaths: nextConfig.hiddenPaths || state.chatConfig.hiddenPaths || DEFAULT_HIDDEN_PATHS,
				serverUrl: nextConfig.serverUrl || state.chatConfig.serverUrl || DEFAULT_SERVER_URL,
				userId: nextConfig.userId || state.chatConfig.userId || 'anonymous',
				chatMode: nextConfig.chatMode || state.chatConfig.chatMode || DEFAULT_CHAT_MODE,
				transport: nextConfig.transport || state.chatConfig.transport || DEFAULT_CHAT_TRANSPORT,
			},
		}))
	},

	hydrateChat: () => {
		const hydrated = hydrateStorage()
		if (!hydrated) {
			set(state => {
				if (state.conversations.length > 0 || state.activeConversationId) {
					return { chatReady: true }
				}
				const initialConversation = createConversation()
				return {
					chatReady: true,
					conversations: [initialConversation],
					activeConversationId: initialConversation.id,
				}
			})
			return
		}

		set(state => {
			const conversations = Array.isArray(hydrated.conversations) && hydrated.conversations.length > 0
				? hydrated.conversations
				: state.conversations.length > 0
					? state.conversations
					: [createConversation()]
			const activeConversationId = hydrated.activeConversationId || conversations[0]?.id || null
			return {
				chatReady: true,
				conversations,
				activeConversationId,
				sidebarSection: hydrated.sidebarSection || state.sidebarSection,
				settings: {
					...state.settings,
					...(hydrated.settings || {}),
				},
			}
		})
	},

	setChatSessionActive: (chatSessionActive) => {
		set({ chatSessionActive })
	},

	openChat: () => {
		set({ isOpen: true, hasUnread: false, chatSessionActive: true })
		get().ensureConversation()
		get().connectChat()
	},

	closeChat: () => {
		set({ isOpen: false, chatSessionActive: false })
		get().disconnectChat()
	},

	toggleChat: () => {
		const { isOpen } = get()
		if (isOpen) {
			get().closeChat()
		} else {
			get().openChat()
		}
	},

	markUnread: () => set({ hasUnread: true }),
	clearUnread: () => set({ hasUnread: false }),
	setDraft: (draft) => set({ draft }),
	setSidebarSection: (sidebarSection) => {
		set({ sidebarSection })
		persistStorage(get())
	},
	setSetting: (key, value) => {
		set(state => ({ settings: { ...state.settings, [key]: value } }))
		persistStorage(get())
	},

	ensureConversation: (title = 'New chat') => {
		const state = get()
		if (state.activeConversationId && state.conversations.some(conversation => conversation.id === state.activeConversationId)) {
			return state.activeConversationId
		}
		const conversation = createConversation(title)
		set({ conversations: [...state.conversations, conversation], activeConversationId: conversation.id })
		persistStorage(get())
		return conversation.id
	},

	newConversation: (seedTitle = 'New chat') => {
		const conversation = createConversation(seedTitle)
		set(state => ({
			conversations: [conversation, ...state.conversations],
			activeConversationId: conversation.id,
			draft: '',
			hasUnread: false,
		}))
		persistStorage(get())
		return conversation.id
	},

	selectConversation: (conversationId) => {
		set({ activeConversationId: conversationId, hasUnread: false })
		persistStorage(get())
	},

	deleteConversation: (conversationId) => {
		set(state => {
			const nextConversations = state.conversations.filter(conversation => conversation.id !== conversationId)
			const fallbackConversation = nextConversations[0] || createConversation()
			return {
				conversations: nextConversations.length > 0 ? nextConversations : [fallbackConversation],
				activeConversationId: nextConversations.length > 0
					? (state.activeConversationId === conversationId ? fallbackConversation.id : state.activeConversationId)
					: fallbackConversation.id,
			}
		})
		persistStorage(get())
	},

	renameConversation: (conversationId, title) => {
		set(state => ({
			conversations: updateConversation(state.conversations, conversationId, conversation => ({
				...conversation,
				title: normalizeTitle(title),
				updatedAt: now(),
			})),
		}))
		persistStorage(get())
	},

	appendAssistantStream: (chunk) => {
		set(state => ({ streamingText: `${state.streamingText}${chunk}` }))
	},

	resetAssistantStream: () => set({ streamingText: '' }),

	connectChat: () => {
		const transport = get().chatConfig.transport || DEFAULT_CHAT_TRANSPORT
		if (transport === 'webhook') {
			set({ isConnected: true })
			return
		}

		if (typeof window === 'undefined' || typeof WebSocket === 'undefined') return
		if (chatSocket && (chatSocket.readyState === WebSocket.OPEN || chatSocket.readyState === WebSocket.CONNECTING)) return

		const { chatConfig } = get()
		try {
			chatSocket = new WebSocket(resolveWsUrl(chatConfig.serverUrl || DEFAULT_SERVER_URL))
			set({ isConnected: false })

			chatSocket.onopen = () => {
				set({ isConnected: true })
				if (reconnectTimer) {
					clearTimeout(reconnectTimer)
					reconnectTimer = null
				}
			}

			chatSocket.onmessage = (event) => {
				try {
					const data = JSON.parse(event.data)
					get().handleChatSocketMessage(data)
				} catch (error) {
					console.error('[chat] Failed to parse socket message', error)
				}
			}

			chatSocket.onerror = (error) => {
				console.error('[chat] WebSocket error', error)
			}

			chatSocket.onclose = () => {
				set({ isConnected: false })
				chatSocket = null
				if (get().chatSessionActive) {
					reconnectTimer = setTimeout(() => {
						reconnectTimer = null
						get().connectChat()
					}, 1500)
				}
			}
		} catch (error) {
			console.error('[chat] WebSocket connect failed', error)
			set({ isConnected: false })
			chatSocket = null
			if (get().chatSessionActive) {
				reconnectTimer = setTimeout(() => {
					reconnectTimer = null
					get().connectChat()
				}, 1500)
			}
		}
	},

	disconnectChat: () => {
		const transport = get().chatConfig.transport || DEFAULT_CHAT_TRANSPORT
		if (transport === 'webhook') {
			set({ isConnected: false, isStreaming: false, streamingText: '' })
			return
		}

		if (reconnectTimer) {
			clearTimeout(reconnectTimer)
			reconnectTimer = null
		}
		if (chatSocket) {
			chatSocket.onclose = null
			chatSocket.close()
			chatSocket = null
		}
		set({ isConnected: false, isStreaming: false, streamingText: '' })
	},

	handleChatSocketMessage: (data) => {
		switch (data?.type) {
			case 'token':
				set(state => ({ isStreaming: true, streamingText: `${state.streamingText}${data.content ?? ''}` }))
				break
			case 'action': {
				const actionItem = {
					action: data.action || 'unknown',
					params: data.params || {},
					label: data.label || data.action || 'Action',
				}
				const state = get()
				const activeConversationId = state.activeConversationId || state.ensureConversation()
				set(chatState => ({
					pendingActions: [...chatState.pendingActions, actionItem],
					conversations: updateConversation(
						chatState.conversations,
						activeConversationId,
						conversation => appendMessageToConversation(conversation, createMessage('action', actionItem.label)),
					),
				}))
				persistStorage(get())
				break
			}
			case 'done': {
				const state = get()
				const activeConversationId = state.activeConversationId || state.ensureConversation()
				const streamingMessage = state.streamingText
				set(chatState => ({
					conversations: streamingMessage
						? updateConversation(chatState.conversations, activeConversationId, conversation => appendMessageToConversation(conversation, createMessage('assistant', streamingMessage)))
						: chatState.conversations,
					isStreaming: false,
					streamingText: '',
					lastWeaknesses: Array.isArray(data.weaknesses) ? data.weaknesses : null,
					pendingActions: [],
					hasUnread: !chatState.isOpen ? true : chatState.hasUnread,
				}))
				persistStorage(get())
				break
			}
			case 'error': {
				const state = get()
				const activeConversationId = state.activeConversationId || state.ensureConversation()
				set(chatState => ({
					conversations: updateConversation(chatState.conversations, activeConversationId, conversation => appendMessageToConversation(conversation, createMessage('error', data.content ?? 'Something went wrong.'))),
					isStreaming: false,
					streamingText: '',
				}))
				persistStorage(get())
				break
			}
			default:
				console.warn('[chat] Unknown socket message type', data?.type)
		}
	},

	sendChatMessage: async (messageText) => {
		const trimmed = messageText.trim()
		if (!trimmed || get().isStreaming) return

		const state = get()
		const conversationId = state.ensureConversation(trimmed)
		const currentConversation = state.conversations.find(conversation => conversation.id === conversationId) || null
		const history = currentConversation ? currentConversation.messages.filter(message => message.role === 'user' || message.role === 'assistant') : []
		const userMessage = createMessage('user', trimmed)

		set(chatState => ({
			conversations: updateConversation(chatState.conversations, conversationId, conversation => {
				const appendedConversation = appendMessageToConversation(conversation, userMessage)
				return updateConversationTitle(appendedConversation, trimmed)
			}),
			draft: '',
			isStreaming: true,
			streamingText: '',
		}))
		persistStorage(get())

		const payload = {
			user_id: state.chatConfig.userId || 'anonymous',
			message: trimmed,
			history,
		}
		const transport = state.chatConfig.transport || DEFAULT_CHAT_TRANSPORT

		if (transport !== 'webhook' && chatSocket && chatSocket.readyState === WebSocket.OPEN) {
			chatSocket.send(JSON.stringify(payload))
			return
		}

		try {
			const data = await fallbackRequest(
				state.chatConfig.serverUrl || DEFAULT_SERVER_URL,
				payload,
				state.chatConfig.chatMode || DEFAULT_CHAT_MODE,
			)
			if (data?.content) {
				set(chatState => {
					const withAssistant = updateConversation(
						chatState.conversations,
						conversationId,
						conversation => appendMessageToConversation(conversation, createMessage('assistant', data.content)),
					)
					const withActions = Array.isArray(data.actions) && data.actions.length > 0
						? updateConversation(
							withAssistant,
							conversationId,
							conversation => ({
								...conversation,
								messages: [
									...conversation.messages,
									...data.actions.map(actionItem => createMessage('action', actionItem.label || actionItem.action || 'Action')),
								],
								updatedAt: now(),
							}),
						)
						: withAssistant

					return {
						conversations: withActions,
					isStreaming: false,
					streamingText: '',
					lastWeaknesses: Array.isArray(data.weaknesses) ? data.weaknesses : null,
					pendingActions: Array.isArray(data.actions) ? data.actions : [],
					hasUnread: !chatState.isOpen ? true : chatState.hasUnread,
					}
				})
				persistStorage(get())
			} else {
				set({ isStreaming: false, streamingText: '' })
			}
		} catch (error) {
			set(chatState => ({
				conversations: updateConversation(chatState.conversations, conversationId, conversation => appendMessageToConversation(conversation, createMessage('error', 'Failed to reach the server. Please try again.'))),
				isStreaming: false,
				streamingText: '',
			}))
			persistStorage(get())
		}
	},
})