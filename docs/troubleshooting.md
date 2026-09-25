# Troubleshooting Guide

Common errors you may encounter when using StellarLock, with causes and fixes.
Every entry maps directly to an error case defined in `src/lib/errors.ts`.

---

## Table of Contents

- [Wallet errors](#wallet-errors)
  - [User rejected / User denied](#user-rejected--user-denied)
  - [Wrong network](#wrong-network)
  - [Insufficient balance](#insufficient-balance)
  - [Timeout / Transaction not found](#timeout--transaction-not-found)
- [Contract errors](#contract-errors)
  - [AmountMustBePositive](#amountmustbepositive)
  - [UnlockMustBeFuture](#unlockmustbefuture)
  - [StillLocked](#stilllocked)
  - [AlreadyWithdrawn](#alreadywithdrawn)
  - [CanOnlyExtend](#cononlyextend)
  - [LockDurationTooLong](#lockdurationtoolong)
  - [UnlockTooSoon](#unlocktooson)
  - [ExtensionLimitReached](#extensionlimitreached)
  - [UnlockExceedsMax](#unlockexceedsmax)
  - [NothingToRelease](#nothingtorerelease)
  - [VestingEndBeforeStart](#vestingendbeforestart)
  - [TooFewBeneficiaries](#toofewbeneficiaries)
  - [TooManyBeneficiaries](#toomanybeneficiaries)
  - [SharesMustSum10000](#sharesmustsum10000)
  - [RateLimitExceeded](#ratelimitexceeded)
  - [AmountOverflow](#amountoverflow)
  - [NotAdmin](#notadmin)
  - [NoPendingAdmin](#nopendingadmin)
  - [NotPendingAdmin](#notpendingadmin)
  - [ReentrancyDetected](#reentrancydetected)
  - [IdenticalTokens](#identicaltokens)
  - [NotInitialized](#notinitialized)
  - [LockNotFound](#locknotfound)
  - [ContractPaused](#contractpaused)
- [Connection issues](#connection-issues)
  - [Freighter not detected](#freighter-not-detected)
  - [Wallet disconnected mid-session](#wallet-disconnected-mid-session)
  - [RPC node unreachable](#rpc-node-unreachable)
- [Stuck or pending transactions](#stuck-or-pending-transactions)

---

## Wallet errors

### User rejected / User denied

**When it happens:** You clicked "Reject" or closed the Freighter popup without approving, or Freighter timed out waiting for a response.

**Fix:**
1. Click the action button again (Lock, Withdraw, Extend, etc.).
2. When the Freighter popup appears, click **Approve / Sign**.
3. If Freighter does not open a popup, click its browser-toolbar icon to unlock it first, then retry.

---

### Wrong network

**When it happens:** Your Freighter wallet is connected to a different network than the app (e.g. Freighter is on Mainnet but the app is configured for Testnet, or vice versa).

**Fix:**
1. Open the Freighter extension.
2. Click the network name in the top-right corner (e.g. "Mainnet").
3. Switch to **Testnet** if you are using the development/staging instance, or **Mainnet** for production.
4. Reload the page and try again.

The app's current network is shown in the navbar badge (`DEV` = Testnet, `STAGING` = Staging, no badge = Mainnet).

---

### Insufficient balance

**When it happens:** Your wallet does not hold enough of the token you are trying to lock, or does not have enough XLM to cover the transaction fee.

**Fix:**
- Check your token balance in Freighter or on [Stellar Expert](https://stellar.expert).
- Ensure you have at least **0.5 XLM** spare for network and resource fees on top of the lock amount.
- On Testnet, fund your account via the [Stellar Friendbot](https://friendbot.stellar.org).

---

### Timeout / Transaction not found

**When it happens:** The transaction was submitted to the Soroban RPC node but was not confirmed within ~60 seconds. This usually means the RPC node was congested or temporarily unreachable.

**Fix:**
1. Do **not** resubmit immediately — the transaction may still be in-flight.
2. Check the [Transaction History](/app/history) page; the status will update automatically once the network confirms it.
3. You can also look up the transaction hash on [Stellar Expert](https://stellar.expert/explorer/testnet) directly.
4. If the transaction is genuinely lost (not found after several minutes), retry the action — duplicate lock creations are safe because each lock gets a unique on-chain ID.

If timeouts are frequent, the RPC node may be having issues. Check the health indicator in the navbar, or try again later. The app will automatically retry reads up to 3 times with exponential backoff.

---

## Contract errors

### AmountMustBePositive

**Cause:** The amount entered is zero, negative, or was rounded to zero when converted to on-chain units (stroops).

**Fix:** Enter a positive amount. The minimum meaningful amount is `0.0000001` (1 stroop).

---

### UnlockMustBeFuture

**Cause:** The chosen unlock date is in the past, or is the current moment — the contract requires the unlock timestamp to be strictly after the current ledger time.

**Fix:** Pick an unlock date at least one day in the future. Use the date presets (30 days, 90 days, etc.) if you are unsure.

---

### StillLocked

**Cause:** You attempted to withdraw from a lock before its unlock date has been reached.

**Fix:** Check the unlock date on the lock detail page. The countdown timer shows exactly how long remains. You cannot withdraw early — this is by design and enforced on-chain.

---

### AlreadyWithdrawn

**Cause:** The lock has already been fully withdrawn. This can happen if:
- You withdrew previously and are visiting an old bookmark.
- Someone else is the beneficiary and they already claimed the tokens.

**Fix:** No action is needed. Check your [Transaction History](/app/history) for the prior withdrawal. The lock status on the detail page will show **Withdrawn**.

---

### CanOnlyExtend

**Cause:** You tried to extend a lock's unlock date to a date that is the same as, or earlier than, the current unlock date. The contract only allows moving the unlock date forward.

**Fix:** Choose a date that is strictly later than the lock's current unlock date. The date input on the extend panel already enforces the minimum — if it does not, clear the field and re-enter a future date.

---

### LockDurationTooLong

**Cause:** The requested lock duration exceeds the contract's maximum allowed duration (typically 10 years).

**Fix:** Choose an unlock date closer to the present. If you genuinely need a very long lock, consider creating multiple sequential locks.

---

### UnlockTooSoon

**Cause:** The unlock date is too close to the current time — the contract enforces a minimum lock duration (e.g. at least 1 day).

**Fix:** Choose an unlock date at least 24 hours in the future. The date presets all satisfy this requirement.

---

### ExtensionLimitReached

**Cause:** The lock has already been extended the maximum number of times the contract permits.

**Fix:** No further extensions are possible for this lock. If you need to keep funds locked beyond the current unlock date, withdraw and create a new lock.

---

### UnlockExceedsMax

**Cause:** The new unlock date you chose when extending is beyond the contract's absolute maximum allowed unlock timestamp.

**Fix:** Choose an earlier date. The contract's maximum is enforced globally regardless of the original lock duration.

---

### NothingToRelease

**Cause:** You triggered a release on a vesting lock, but no vested tranche has become claimable yet. This can happen if:
- The current ledger time is before the first vesting milestone.
- All already-vested tranches have been claimed in a prior transaction.

**Fix:** Check the lock's vesting schedule on the detail page and wait until the next tranche unlocks. The page shows the date of the next claimable release.

---

### VestingEndBeforeStart

**Cause:** The vesting schedule you submitted has an end date that is the same as, or earlier than, the start date. The contract requires the vesting period to have a positive duration.

**Fix:** Set the vesting end date to a time strictly after the vesting start date. The form inputs enforce a minimum gap — if you bypassed them (e.g. via direct API use), ensure `vesting_end > vesting_start`.

---

### TooFewBeneficiaries

**Cause:** The multi-beneficiary lock you tried to create listed fewer beneficiaries than the contract's minimum (at least 2 are required).

**Fix:** Add at least one more beneficiary address. If you only need one recipient, use a standard (single-beneficiary) lock instead.

---

### TooManyBeneficiaries

**Cause:** The multi-beneficiary lock you tried to create exceeded the contract's maximum beneficiary count.

**Fix:** Reduce the number of beneficiaries to the allowed maximum. If you need to distribute tokens to more recipients, split the amount across multiple separate locks.

---

### SharesMustSum10000

**Cause:** The per-beneficiary share values you provided do not add up to exactly `10000` (representing 100.00%). This is enforced by the contract to prevent rounding gaps or over-allocation.

**Fix:** Adjust the share percentages so they total exactly 100%. Each share is expressed in basis points (1 bp = 0.01%), so 100% = `10000`. Example: two equal beneficiaries should each have `5000`.

---

### RateLimitExceeded

**Cause:** Your account has submitted too many contract invocations within a short window. The contract enforces a per-account rate limit to protect the network from spam.

**Fix:**
1. Wait a few minutes before retrying.
2. If you are running automated scripts or tests, add a delay between calls.
3. On Mainnet, if you legitimately need a higher throughput, contact the StellarLock team to discuss options.

---

### AmountOverflow

**Cause:** An internal arithmetic overflow occurred while the contract was computing token amounts. This is most likely triggered by entering an extremely large value (close to the `i128` maximum).

**Fix:** Enter a smaller amount. If you believe your amount is reasonable and this error still appears, this may be a contract bug — please [open an issue](https://github.com/your-org/StellarLock/issues) with the exact amount and token you used.

---

### NotAdmin

**Cause:** The transaction was signed by a wallet that is not the current contract administrator. This operation is restricted to the admin account.

**Fix:** Ensure you are connected with the admin wallet. If you are a regular user and see this error, the action you attempted is not available to non-admin accounts. Contact the contract operator for assistance.

---

### NoPendingAdmin

**Cause:** An attempt was made to accept or cancel an admin transfer, but no admin transfer is currently in progress.

**Fix:** No action is needed if you are a regular user. If you are administering the contract, initiate a new admin transfer first before trying to accept or cancel one.

---

### NotPendingAdmin

**Cause:** You tried to accept an admin transfer but your wallet address is not the one nominated as the pending admin.

**Fix:** Connect with the wallet address that was designated as the pending admin, then retry the accept-admin action.

---

### ReentrancyDetected

**Cause:** The contract's reentrancy guard was triggered. This should never happen during normal usage — it indicates an attempt to call back into the contract during a transaction it is already executing.

**Fix:** This is not something end-users can trigger through the standard UI. If you see this error:
1. Do not retry the same transaction.
2. [Open a bug report](https://github.com/your-org/StellarLock/issues) with your transaction hash so the team can investigate.

---

### IdenticalTokens

**Cause:** You tried to create an LP (liquidity-pair) lock where both token addresses in the pair are the same. The LP locker contract requires two distinct tokens.

**Fix:** Select two different token addresses for the liquidity pair. If you want to lock a single token, use the standard token locker instead.

---

### NotInitialized

**Cause:** The contract deployment has not been initialized with an admin address yet, or an admin-only operation was invoked on an uninitialized contract instance.

**Fix:** If you are the contract deployer, call the `init(admin)` entry point once after deploying the contract. If you are an end user, the contract operator has not finalized the deployment — contact the contract operator or team.

---

### LockNotFound

**Cause:** The requested lock ID does not exist in the contract's storage. This can happen if an invalid ID was entered into the URL or explorer, or if the lock was created on a different contract deployment/network.

**Fix:** Double-check the lock ID and contract address. Confirm that you are connected to the correct network (Testnet vs. Mainnet).

---

### ContractPaused

**Cause:** The contract is currently paused by the administrator using the emergency circuit breaker mechanism (`pause()`). All lock creations, withdrawals, extensions, and beneficiary transfers are temporarily halted.

**Fix:** Wait for the contract administrator to resolve the maintenance/incident and call `unpause()`. Read queries remain operational during a pause. Check team communication channels or status updates for more details.

---

## Connection issues

### Freighter not detected

**Symptom:** Clicking "Connect Wallet" shows an error like "Freighter was not detected" or the wallet picker modal appears but Freighter is greyed out.

**Fix:**
1. Install [Freighter](https://www.freighter.app) from the Chrome Web Store or Firefox Add-ons.
2. If already installed, make sure it is **enabled** — go to `chrome://extensions` and check the toggle.
3. Unlock Freighter by clicking its icon and entering your password.
4. Reload the page and try connecting again.

---

### Wallet disconnected mid-session

**Symptom:** You were connected, navigated away, and came back to find the wallet is disconnected. Or a banner appears saying "Wallet disconnected".

**Cause:** Freighter's background session expired, the extension was updated, or the browser closed the extension process.

**Fix:** Click the **Connect** button in the navbar to reconnect. Your lock data and transaction history are stored locally and will be intact. The app polls the wallet every 10 seconds and will show an alert banner if it detects a disconnection.

---

### RPC node unreachable

**Symptom:** Pages fail to load lock data, the navbar shows a red RPC health indicator, or you see "Simulation error" messages without a specific contract error code.

**Cause:** The Soroban RPC node configured in `VITE_RPC_URL` is temporarily unavailable, rate-limiting requests, or your network connection is interrupted.

**Fix:**
1. Check your internet connection.
2. Wait 30–60 seconds and reload — the app retries failed RPC calls with exponential backoff automatically.
3. If the issue persists, check the [Stellar status page](https://status.stellar.org) or the Soroban Discord for network-wide incidents.
4. If you run your own deployment, update `VITE_RPC_URL` in your `.env` file to a different RPC provider and rebuild.

---

## Stuck or pending transactions

**Symptom:** A transaction has been in "Pending" status in the [Transaction History](/app/history) page for more than a few minutes.

**What to do:**
1. Go to **[Transaction History](/app/history)** — the app periodically polls Horizon for pending transaction statuses and will update automatically.
2. Click the external link icon next to the transaction to open it on [Stellar Expert](https://stellar.expert) and see the raw result.
3. If the transaction shows as `failed` on-chain but `pending` in the app, reload the History page to force a status refresh.
4. If the transaction is genuinely missing from the network (not found on Stellar Expert after 5 minutes), it was likely dropped. Retry the original action — lock creation is safe to retry since each call produces a new lock with a unique ID.

> **Note:** Withdrawal and extension transactions that were submitted but are in an unknown state should **not** be retried blindly — verify on Stellar Expert first to avoid double-spending or double-extending.
