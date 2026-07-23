package com.financeflow.pocket.notifications

/**
 * Result of parsing a single bank/payment app notification.
 * `amount` is in the notification's currency (usually MXN). `type` uses the
 * same vocabulary as the `detected_transactions.type` column in Supabase:
 *   charge   → outgoing purchase / card charge
 *   credit   → incoming payment / deposit
 *   transfer → outgoing / incoming transfer (SPEI, etc.)
 *   payment  → bill or loan payment
 *   unknown  → matched the app but couldn't parse an amount
 */
data class ParsedNotification(
    val packageName: String,
    val title: String?,
    val text: String,
    val amount: Double?,
    val currency: String,
    val merchant: String?,
    val type: String,
    val rawText: String,
    val timestamp: Long,
)
