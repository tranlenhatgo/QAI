import { auth } from '@/helpers/auth/firebase'

const CHAT_STORAGE_KEY = 'qraft-chat-state'
const DEFAULT_SERVER_URL = process.env.NEXT_PUBLIC_STUDY_COACH_API_URL || 'http://localhost:8000'
const DEFAULT_HIDDEN_PATHS = ['/chat']
const DEFAULT_CHAT_MODE = 'simple'
const DEFAULT_CHAT_TRANSPORT = 'websocket'
const DEFAULT_COACH_TIER = process.env.NEXT_PUBLIC_STUDY_COACH_TIER === 'full' ? 'full' : 'lite'
const PUBLIC_STUDY_COACH_API_KEY = process.env.NEXT_PUBLIC_STUDY_COACH_API_KEY || process.env.NEXT_PUBLIC_COACH_API_KEY || ''

let chatSocket = null
let reconnectTimer = null
let webhookAbortController = null

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
			chatMode: state.chatConfig.chatMode,
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
		.replace(/\/ws$/i, '')
		.replace(/\/chat\/agentic$/i, '')
		.replace(/\/chat$/i, '')
}

function appendQueryParam(url, key, value) {
	if (!value) return url
	const separator = url.includes('?') ? '&' : '?'
	return `${url}${separator}${encodeURIComponent(key)}=${encodeURIComponent(value)}`
}

function resolveWsUrl(serverUrl = DEFAULT_SERVER_URL) {
	const root = normalizeServerRoot(serverUrl)
	let wsUrl = ''

	if (/^ws(s)?:\/\//i.test(root)) {
		wsUrl = `${root}/ws`
	} else if (/^http(s)?:\/\//i.test(root)) {
		const wsRoot = root.replace(/^http:\/\//i, 'ws://').replace(/^https:\/\//i, 'wss://')
		wsUrl = `${wsRoot}/ws`
	} else {
		wsUrl = `ws://${root}/ws`
	}

	return appendQueryParam(wsUrl, 'api_key', PUBLIC_STUDY_COACH_API_KEY)
}

function toServerMode(chatMode = DEFAULT_CHAT_MODE) {
	return chatMode === 'agentic' ? 'agentic' : 'chat'
}

function toClientMode(mode = 'chat') {
	return mode === 'agentic' ? 'agentic' : DEFAULT_CHAT_MODE
}

function normalizeTier(tier = DEFAULT_COACH_TIER) {
	return tier === 'lite' ? 'lite' : 'full'
}

function buildSessionStartMessage(state) {
	const config = state.chatConfig || {}
	return {
		type: 'session_start',
		tier: normalizeTier(config.tier),
		mode: toServerMode(config.chatMode),
		user_id: config.userId || 'anonymous',
		kb_id: config.kbId || '',
		conversation_id: state.activeConversationId || '',
	}
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

async function fallbackRequest(payload, chatMode, signal) {
	const bearerToken = await auth.currentUser?.getIdToken().catch(() => null)
	const response = await fetch('/api/coach/chat', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			...(bearerToken ? { Authorization: `Bearer ${bearerToken}` } : {}),
		},
		body: JSON.stringify({
			message: payload.message,
			history: payload.history,
			chatMode,
		}),
		signal,
	})

	const data = await response.json().catch(() => ({}))
	if (!response.ok) {
		const error = new Error(data?.message || 'Failed to reach coach API')
		error.status = response.status
		throw error
	}

	return data
}

export const useChatStore = (set, get) => ({
	chatReady: false,
	chatConfig: {
		userId: 'anonymous',
		serverUrl: DEFAULT_SERVER_URL,
		hiddenPaths: DEFAULT_HIDDEN_PATHS,
		chatMode: DEFAULT_CHAT_MODE,
		transport: DEFAULT_CHAT_TRANSPORT,
		tier: DEFAULT_COACH_TIER,
		kbId: '',
	},
	chatSessionActive: false,
	isOpen: false,
	isConnected: false,
	isStreaming: false,
	hasUnread: false,
	serviceHealthy: null,
	chatHealthy: null,
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
				tier: nextConfig.tier || state.chatConfig.tier || DEFAULT_COACH_TIER,
				kbId: nextConfig.kbId ?? state.chatConfig.kbId ?? '',
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
				chatConfig: {
					...state.chatConfig,
					chatMode: hydrated.chatMode === 'agentic' ? 'agentic' : DEFAULT_CHAT_MODE,
				},
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
	setChatMode: (chatMode) => {
		const nextMode = chatMode === 'agentic' ? 'agentic' : DEFAULT_CHAT_MODE
		set(state => ({
			chatConfig: {
				...state.chatConfig,
				chatMode: nextMode,
			},
		}))
		if ((get().chatConfig.transport || DEFAULT_CHAT_TRANSPORT) !== 'webhook' && get().isConnected && typeof WebSocket !== 'undefined' && chatSocket?.readyState === WebSocket.OPEN) {
			chatSocket.send(JSON.stringify({ type: 'mode_switch', mode: toServerMode(nextMode) }))
		}
		persistStorage(get())
	},
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

	clearAllConversations: () => {
		const freshConversation = createConversation()
		set({
			conversations: [freshConversation],
			activeConversationId: freshConversation.id,
			streamingText: '',
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

	stopStreaming: () => {
		const state = get()
		if (!state.isStreaming) return

		// Abort webhook fetch if in progress
		if (webhookAbortController) {
			webhookAbortController.abort()
			webhookAbortController = null
		}

		// For WebSocket: send stop signal
		if (chatSocket && chatSocket.readyState === WebSocket.OPEN) {
			chatSocket.send(JSON.stringify({ type: 'stop' }))
		}

		// Save whatever was streamed so far as the assistant message
		const conversationId = state.activeConversationId
		const streamingMessage = state.streamingText
		if (streamingMessage && conversationId) {
			set(chatState => ({
				conversations: updateConversation(chatState.conversations, conversationId, conversation =>
					appendMessageToConversation(conversation, createMessage('assistant', streamingMessage + '\n\n*(stopped)*'))
				),
				isStreaming: false,
				streamingText: '',
			}))
			persistStorage(get())
		} else {
			set({ isStreaming: false, streamingText: '' })
		}
	},

	checkServiceHealth: async () => {
		const { chatConfig } = get()
		const root = normalizeServerRoot(chatConfig.serverUrl || DEFAULT_SERVER_URL)
		const httpRoot = /^ws(s)?:\/\//i.test(root)
			? root.replace(/^ws:\/\//i, 'http://').replace(/^wss:\/\//i, 'https://')
			: root
		try {
			const res = await fetch(`${httpRoot}/`, { method: 'GET' })
			set({ serviceHealthy: res.ok })
		} catch {
			set({ serviceHealthy: false })
		}
	},

	checkChatHealth: async () => {
		const { chatConfig } = get()
		const root = normalizeServerRoot(chatConfig.serverUrl || DEFAULT_SERVER_URL)
		const httpRoot = /^ws(s)?:\/\//i.test(root)
			? root.replace(/^ws:\/\//i, 'http://').replace(/^wss:\/\//i, 'https://')
			: root
		try {
			const res = await fetch(`${httpRoot}/health`, { method: 'GET' })
			set({ chatHealthy: res.ok })
		} catch {
			set({ chatHealthy: false })
		}
	},

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
				chatSocket.send(JSON.stringify(buildSessionStartMessage(get())))
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
			case 'session_ack':
				set(state => ({
					isConnected: true,
					chatConfig: {
						...state.chatConfig,
						chatMode: toClientMode(data.mode),
						tier: normalizeTier(data.tier),
					},
				}))
				break
			case 'content':
			case 'token':
				set(state => ({ isStreaming: true, streamingText: `${state.streamingText}${data.content ?? ''}` }))
				break
			case 'stage':
				if (data.status === 'start') {
					set({ isStreaming: true })
				}
				break
			case 'tool': {
				const toolName = data.tool_name || 'tool'
				const label = data.status === 'calling'
					? `Using ${toolName}`
					: data.status === 'error'
						? `${toolName} failed`
						: `${toolName} finished`
				const state = get()
				const activeConversationId = state.activeConversationId || state.ensureConversation()
				set(chatState => ({
					conversations: updateConversation(
						chatState.conversations,
						activeConversationId,
						conversation => appendMessageToConversation(conversation, createMessage('action', label)),
					),
				}))
				persistStorage(get())
				break
			}
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
					conversations: updateConversation(chatState.conversations, activeConversationId, conversation => appendMessageToConversation(conversation, createMessage('error', data.message || data.content || 'Something went wrong.'))),
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
			chatSocket.send(JSON.stringify({
				type: 'user_message',
				content: trimmed,
				history,
			}))
			return
		}

		if (transport !== 'webhook') {
			set(chatState => ({
				conversations: updateConversation(chatState.conversations, conversationId, conversation => appendMessageToConversation(conversation, createMessage('error', 'WebSocket is not connected. Reconnecting...'))),
				isStreaming: false,
				streamingText: '',
			}))
			get().connectChat()
			return
		}

		try {
			webhookAbortController = new AbortController()
			const data = await fallbackRequest(
				payload,
				state.chatConfig.chatMode || DEFAULT_CHAT_MODE,
				webhookAbortController.signal,
			)
			webhookAbortController = null
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
			const errorMessage = error?.status === 401
				? 'Please sign in to use AI Study Coach.'
				: 'Failed to reach the server. Please try again.'
			set(chatState => ({
				conversations: updateConversation(chatState.conversations, conversationId, conversation => appendMessageToConversation(conversation, createMessage('error', errorMessage))),
				isStreaming: false,
				streamingText: '',
			}))
			persistStorage(get())
		}
	},
})
