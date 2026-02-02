import User from '../models/User.js';

/**
 * Credit (add) amount to user's wallet
 * @param {ObjectId|string} userId - User ID
 * @param {number} amount - Amount to credit
 * @param {MongoSession} session - MongoDB session for transaction
 * @returns {Promise<number>} New wallet balance
 */
export async function creditWallet(userId, amount, session = null) {
  if (amount <= 0) {
    throw new Error('Credit amount must be positive');
  }

  const options = session ? { session } : {};

  const user = await User.findByIdAndUpdate(
    userId,
    { $inc: { walletBalance: amount } },
    { new: true, ...options }
  );

  if (!user) {
    throw new Error('User not found');
  }

  return user.walletBalance;
}

/**
 * Debit (subtract) amount from user's wallet
 * @param {ObjectId|string} userId - User ID
 * @param {number} amount - Amount to debit
 * @param {MongoSession} session - MongoDB session for transaction
 * @param {boolean} allowNegative - Allow negative balance (default: false)
 * @returns {Promise<number>} New wallet balance
 */
export async function debitWallet(userId, amount, session = null, allowNegative = false) {
  if (amount <= 0) {
    throw new Error('Debit amount must be positive');
  }

  const options = session ? { session } : {};

  // Check current balance first if we don't allow negative
  if (!allowNegative) {
    const user = await User.findById(userId).session(session);
    if (!user) {
      throw new Error('User not found');
    }
    if (user.walletBalance < amount) {
      throw new Error(`Insufficient wallet balance. Available: ${user.walletBalance.toFixed(2)}, Required: ${amount.toFixed(2)}`);
    }
  }

  const user = await User.findByIdAndUpdate(
    userId,
    { $inc: { walletBalance: -amount } },
    { new: true, ...options }
  );

  if (!user) {
    throw new Error('User not found');
  }

  return user.walletBalance;
}

/**
 * Get user's current wallet balance
 * @param {ObjectId|string} userId - User ID
 * @returns {Promise<number>} Current wallet balance
 */
export async function getWalletBalance(userId) {
  const user = await User.findById(userId).select('walletBalance');

  if (!user) {
    throw new Error('User not found');
  }

  return user.walletBalance || 0;
}

/**
 * Transfer amount from one user's wallet to another
 * @param {ObjectId|string} fromUserId - Sender user ID
 * @param {ObjectId|string} toUserId - Receiver user ID
 * @param {number} amount - Amount to transfer
 * @param {MongoSession} session - MongoDB session for transaction
 * @returns {Promise<{fromBalance: number, toBalance: number}>} New balances
 */
export async function transferWallet(fromUserId, toUserId, amount, session = null) {
  if (amount <= 0) {
    throw new Error('Transfer amount must be positive');
  }

  // Debit from sender
  const fromBalance = await debitWallet(fromUserId, amount, session, false);

  // Credit to receiver
  const toBalance = await creditWallet(toUserId, amount, session);

  return { fromBalance, toBalance };
}
