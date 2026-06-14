export function resolveVisibleCoachTier(subscription) {
	return subscription?.fullAccess === true ? 'full' : 'lite'
}
