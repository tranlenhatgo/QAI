export async function getSubscriptionForRequest(req) {
  const apiRoot = process.env.REST_API_URL?.replace(/\/+$/, '')
  if (!apiRoot || !req.idToken) {
    return { plan: 'lite', fullAccess: false, subscriptionStatus: 'unavailable' }
  }

  const response = await fetch(`${apiRoot}/subscription/current`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${req.idToken}`,
    },
  })

  if (!response.ok) {
    console.error('[subscription] Backend read failed', response.status)
    return { plan: 'lite', fullAccess: false, subscriptionStatus: 'unavailable' }
  }

  const subscription = await response.json().catch(() => ({}))
  return {
    ...subscription,
    fullAccess: subscription.fullAccess === true,
  }
}

export async function resolveCoachTierForRequest(req, requestedTier) {
  if (requestedTier !== 'full') return 'lite'

  const subscription = await getSubscriptionForRequest(req)
  return subscription.fullAccess ? 'full' : 'lite'
}

export async function userHasFullAccess(req) {
  const subscription = await getSubscriptionForRequest(req)
  return subscription.fullAccess === true
}
