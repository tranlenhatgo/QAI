# QRAFT Rewards System Architecture

## Overview
Single token contract (`QraftToken`) manages ALL rewards across the entire app.

---

## 1. Reward Distribution Flow

```
User Completes Quiz
       ↓
GameOver.jsx calculates score
       ↓
Call /api/rewards/distribute
       ↓
Backend validates & signs transaction
       ↓
QRAFT tokens sent from backend wallet
       ↓
User's balance updated on blockchain
       ↓
Cache updated in Firebase
```

---

## 2. Contract Architecture

### ✅ CORRECT: One Contract for All
```
QraftToken Contract (0x9fE...6e0)
├── Deployed once
├── Backend wallet distributes rewards
├── All users receive from same contract
└── Stored in Firebase config (one time)
```

### ❌ WRONG: Contract Per Quiz
```
Don't create new contracts per quiz!
- Expensive gas fees
- Unnecessary complexity
- Hard to manage
```

---

## 3. Database Structure

### Contract Configuration (Global)
```javascript
config/blockchain:
  tokenContractAddress: "0x9fE..."
  network: "localhost"
  deployer: "0xf39..."
```

### User Data
```javascript
users/{userId}:
  walletAddress: "0xABC...123"
  
  // Cached balance (not authoritative)
  cachedBalance:
    amount: 150
    lastUpdated: timestamp
  
  // Transaction history
  transactions: [
    { txHash, amount, reason, timestamp }
  ]
```

### Quiz Rewards (Metadata Only)
```javascript
quizzes/{quizId}:
  title: "JavaScript Quiz"
  createdBy: userId
  
  // Reward settings (NOT a contract!)
  rewards:
    enabled: true
    amount: 25              // QRAFT for completion
    bonusForPerfectScore: 50
    requiresStake: false    // Future feature
```

---

## 4. Balance Display Strategy

### Smart Caching Approach

**Benefits:**
- ✅ Instant display (cached)
- ✅ Automatic updates (stale cache)
- ✅ Manual refresh (user request)
- ✅ Minimal blockchain queries

**When to Query Blockchain:**
1. Cache is > 5 minutes old
2. User clicks refresh button
3. After receiving rewards
4. After sending tokens (future feature)

**When to Use Cache:**
1. Initial page load
2. Navigation between pages
3. Frequent checks

### Implementation
```javascript
// Profile page uses cached balance
const { balance, loading, refresh } = useQraftBalance(user);

// Automatically refreshes if cache is stale
// User can manually refresh with button
```

---

## 5. Reward Amounts

### Default Rewards
```javascript
Infinity Mode: 2 QRAFT per question
Perfect Score (90%+): 50 QRAFT
Good Score (70-89%): 20 QRAFT
Passing (50-69%): 10 QRAFT
Participation (<50%): 5 QRAFT
```

### Custom Quiz Rewards (Future)
```javascript
quizzes/{quizId}/rewards:
  amount: 25  // Creator sets custom amount
```

---

## 6. Advantages of This Architecture

### Single Contract Benefits:
1. **Cost Efficient**: One deployment, not hundreds
2. **Easy Management**: One address to track
3. **Unified Economy**: All tokens interchangeable
4. **Simple Integration**: Same contract everywhere

### Caching Benefits:
1. **Fast UX**: Instant balance display
2. **Low Cost**: Fewer blockchain queries
3. **Scalable**: Handles many users
4. **Reliable**: Works even if RPC is slow

---

## 7. Flow Diagrams

### Reward Distribution
```
┌──────────────┐
│  User Wins   │
│    Quiz      │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│  Calculate   │
│    Score     │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│   Backend    │
│  Signs Tx    │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│   QRAFT      │
│  Contract    │
│  .transfer() │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│  User Gets   │
│   Tokens!    │
└──────────────┘
```

### Balance Check
```
┌──────────────┐
│ Profile Page │
│    Loads     │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│  Check Cache │
│  in Firebase │
└──────┬───────┘
       │
       ├─→ Fresh? → Display cached balance ✅
       │
       └─→ Stale? → Query blockchain
                        ↓
                  Update cache
                        ↓
                  Display new balance ✅
```

---

## 8. Security Considerations

### Backend Wallet
- ✅ Private key stored server-side only
- ✅ Never exposed to frontend
- ✅ Controls reward distribution
- ✅ Can be funded periodically

### User Wallets
- ✅ Stored in Firebase (address only)
- ✅ Users can receive tokens
- ✅ No private key needed to receive
- ❌ Cannot send tokens (no private key)

### Firebase vs Blockchain
- **Firebase**: Fast reads, metadata
- **Blockchain**: Source of truth for balances
- **Cache**: Performance optimization

---

## 9. Future Enhancements

### Phase 2 Features:
1. **Token Staking**: Players stake tokens to play high-reward quizzes
2. **Leaderboards**: Top scorers get bonus rewards
3. **Quiz Creator Rewards**: Share rewards with quiz creators
4. **Token Marketplace**: Use tokens to unlock premium features
5. **Withdrawal**: Allow users to send tokens to external wallets

---

## 10. For Your Exam

**You can explain:**

> "We use a single ERC20 token contract deployed once on the blockchain. When users complete quizzes, our backend wallet signs transactions to distribute QRAFT tokens as rewards. We cache balances in Firebase for performance, but the blockchain remains the authoritative source. This architecture minimizes gas costs while maintaining decentralization principles. Each quiz's reward settings are stored as metadata in Firebase, not as separate contracts, which is far more efficient and scalable."

**This demonstrates:**
- ✅ Understanding of smart contracts
- ✅ Token economics design
- ✅ Performance optimization
- ✅ Cost-efficient architecture
- ✅ Caching strategies
- ✅ Security best practices

---

## Summary

| Aspect | Approach |
|--------|----------|
| **Contracts** | ONE for all |
| **Contract Storage** | Firebase config (once) |
| **Balance Source** | Blockchain (authoritative) |
| **Balance Display** | Cached (Firebase) |
| **Balance Updates** | Automatic (stale cache) |
| **Reward Distribution** | Backend API |
| **Quiz Rewards** | Metadata (Firebase) |
| **Blockchain Queries** | Minimal (smart caching) |

This architecture is production-ready, cost-effective, and scalable! 🚀
