import { useEffect } from 'react'
import { useBoundStore } from '@/store/useBoundStore'

/**
 * NotificationBell — shows unread notification count badge and dropdown list.
 * Fetches notifications from Firestore via Spring Boot on mount.
 */
export default function NotificationBell() {
	const user = useBoundStore(state => state.user)
	const notifications = useBoundStore(state => state.notifications)
	const fetchNotifications = useBoundStore(state => state.fetchNotifications)
	const markNotificationRead = useBoundStore(state => state.markNotificationRead)

	useEffect(() => {
		if (user?.uid) {
			fetchNotifications(user.uid)
		}
	}, [user?.uid, fetchNotifications])

	const unread = notifications.filter(n => !n.read)

	if (unread.length === 0) return null

	return (
		<div className="relative mb-4">
			<div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg">
				<span className="flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-blue-600 rounded-full">
					{unread.length}
				</span>
				<span className="text-sm font-medium text-blue-800">
					{unread.length === 1 ? '1 notification' : `${unread.length} notifications`}
				</span>
			</div>

			<div className="mt-2 space-y-2">
				{unread.slice(0, 5).map(notification => (
					<div
						key={notification.id}
						className="flex items-start justify-between gap-2 px-3 py-2 bg-white border border-gray-200 rounded-md"
					>
						<div className="flex-1 min-w-0">
							<p className="text-sm font-medium text-gray-900 truncate">
								{notification.title}
							</p>
							{notification.message && (
								<p className="text-xs text-gray-500 line-clamp-2">
									{notification.message}
								</p>
							)}
						</div>
						<button
							onClick={() => markNotificationRead(notification.id)}
							className="text-xs text-blue-600 hover:text-blue-800 whitespace-nowrap"
						>
							Dismiss
						</button>
					</div>
				))}
			</div>
		</div>
	)
}
