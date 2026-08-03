package com.financeflow.pocket.notifications

/**
 * Registry of per-bank notification parsers.
 *
 * Each parser is a function that receives the notification title + body and
 * returns a filled `ParsedNotification` when it matches, or `null` when it
 * doesn't. A single package can have multiple parsers (one per event type);
 * the first non-null result wins.
 *
 * To add a new bank:
 *   1. Trigger a real notification on your device and inspect the text
 *      (Logcat filter `NotificationCapture`).
 *   2. Add a new entry below with a regex targeting that text.
 *
 * Notification formats change occasionally — when a parser stops matching,
 * the raw notification still lands in the "detected" inbox with type
 * `unknown` so nothing is silently lost.
 */
object BankParsers {

    /** Default allowlist of package names the service watches. */
    val DEFAULT_WATCHED_PACKAGES: Set<String> = setOf(
        "com.bbva.bbvacontigo",
        "mx.com.santander.appsantander",
        "com.banorte.rmb.movil",
        "com.nu.production",
        "com.mercadopago.wallet",
        "com.bancoazteca.bazdigitalmovil",
        "com.hsbc.hsbcnetmobile",
        "com.citibanamex.banamexmovil",
        "com.revolut.revolut",
        "com.klar.consumer",
        "com.storicard.stori",
    )

    private val PARSERS: Map<String, List<(String?, String) -> ParsedNotification?>> = mapOf(
        "com.bbva.bbvacontigo" to listOf(::parseBbvaCharge, ::parseBbvaTransfer),
        "mx.com.santander.appsantander" to listOf(::parseSantander),
        "com.nu.production" to listOf(::parseNu),
        "com.mercadopago.wallet" to listOf(::parseMercadoPago),
        "com.revolut.revolut" to listOf(::parseRevolut),
    )

    fun parse(packageName: String, title: String?, text: String, timestamp: Long): ParsedNotification {
        val specific = PARSERS[packageName]
        if (specific != null) {
            for (parser in specific) {
                val result = parser(title, text)
                if (result != null) {
                    return result.copy(packageName = packageName, timestamp = timestamp)
                }
            }
        }
        // Generic fallback: try to at least extract an amount.
        val generic = parseGeneric(title, text)
        return generic.copy(packageName = packageName, timestamp = timestamp)
    }

    // ---- Amount helpers -----------------------------------------------------

    /** Matches `$1,234.56`, `$ 1234`, `MXN 1,234.56`, etc. */
    private val AMOUNT_REGEX = Regex("""(?:MXN|USD|\\$)\s*([\d,]+(?:\.\d{1,2})?)""", RegexOption.IGNORE_CASE)

    private fun extractAmount(text: String): Double? {
        val m = AMOUNT_REGEX.find(text) ?: return null
        return m.groupValues[1].replace(",", "").toDoubleOrNull()
    }

    private fun inferCurrency(text: String): String = when {
        text.contains("USD", ignoreCase = true) -> "USD"
        text.contains("EUR", ignoreCase = true) || text.contains("€") -> "EUR"
        text.contains("GBP", ignoreCase = true) || text.contains("£") -> "GBP"
        else -> "MXN"
    }

    /**
     * Parses an amount string that may use either US (`1,234.56`) or European
     * (`1.234,56`) grouping. The last of `.`/`,` is treated as the decimal
     * separator. (The TS classifier re-derives the amount on insert; this is a
     * best-effort first pass for offline/native use.)
     */
    private fun normalizeAmount(raw: String): Double? {
        var s = raw.trim()
        val lastComma = s.lastIndexOf(',')
        val lastDot = s.lastIndexOf('.')
        s = when {
            lastComma > lastDot -> s.replace(".", "").replace(',', '.')
            else -> s.replace(",", "")
        }
        return s.toDoubleOrNull()
    }

    // ---- Per-bank parsers ---------------------------------------------------

    private fun parseBbvaCharge(title: String?, text: String): ParsedNotification? {
        val re = Regex("""Cargo\s+por\s+\$?([\d,]+(?:\.\d{2})?)\s+en\s+(.+?)\.""", RegexOption.IGNORE_CASE)
        val m = re.find(text) ?: return null
        val amount = m.groupValues[1].replace(",", "").toDoubleOrNull() ?: return null
        return ParsedNotification(
            packageName = "",
            title = title,
            text = text,
            amount = amount,
            currency = "MXN",
            merchant = m.groupValues[2].trim(),
            type = "charge",
            rawText = text,
            timestamp = 0L,
        )
    }

    private fun parseBbvaTransfer(title: String?, text: String): ParsedNotification? {
        if (!text.contains("transfer", ignoreCase = true) && !text.contains("SPEI", ignoreCase = true)) return null
        val amount = extractAmount(text) ?: return null
        val incoming = text.contains("recibiste", ignoreCase = true) || text.contains("recibida", ignoreCase = true)
        val merchantRe = Regex("""(?:de|a)\s+([A-ZÁÉÍÓÚÑ][\w\s\.\-]{2,40})""")
        val merchant = merchantRe.find(text)?.groupValues?.get(1)?.trim()
        return ParsedNotification(
            packageName = "",
            title = title,
            text = text,
            amount = amount,
            currency = "MXN",
            merchant = merchant,
            type = "transfer",
            rawText = text,
            timestamp = 0L,
        )
    }

    private fun parseSantander(title: String?, text: String): ParsedNotification? {
        val amount = extractAmount(text) ?: return null
        val type = when {
            text.contains("compra", ignoreCase = true) || text.contains("cargo", ignoreCase = true) -> "charge"
            text.contains("abono", ignoreCase = true) || text.contains("depósito", ignoreCase = true) -> "credit"
            text.contains("transfer", ignoreCase = true) -> "transfer"
            text.contains("pago", ignoreCase = true) -> "payment"
            else -> "unknown"
        }
        val merchantRe = Regex("""en\s+(.+?)(?:\.|,|$)""", RegexOption.IGNORE_CASE)
        val merchant = merchantRe.find(text)?.groupValues?.get(1)?.trim()
        return ParsedNotification(
            packageName = "",
            title = title,
            text = text,
            amount = amount,
            currency = "MXN",
            merchant = merchant,
            type = type,
            rawText = text,
            timestamp = 0L,
        )
    }

    private fun parseNu(title: String?, text: String): ParsedNotification? {
        val amount = extractAmount(text) ?: return null
        val type = when {
            text.contains("compra", ignoreCase = true) -> "charge"
            text.contains("recibiste", ignoreCase = true) -> "credit"
            text.contains("enviaste", ignoreCase = true) -> "transfer"
            text.contains("pago", ignoreCase = true) -> "payment"
            else -> "unknown"
        }
        val merchantRe = Regex("""en\s+([^\n]+?)(?:\.|$)""", RegexOption.IGNORE_CASE)
        val merchant = merchantRe.find(text)?.groupValues?.get(1)?.trim()
        return ParsedNotification(
            packageName = "",
            title = title,
            text = text,
            amount = amount,
            currency = "MXN",
            merchant = merchant,
            type = type,
            rawText = text,
            timestamp = 0L,
        )
    }

    private fun parseMercadoPago(title: String?, text: String): ParsedNotification? {
        val amount = extractAmount(text) ?: return null
        val type = when {
            text.contains("pagaste", ignoreCase = true) || text.contains("compraste", ignoreCase = true) -> "charge"
            text.contains("recibiste", ignoreCase = true) || text.contains("cobraste", ignoreCase = true) -> "credit"
            text.contains("transfer", ignoreCase = true) -> "transfer"
            else -> "unknown"
        }
        val merchantRe = Regex("""(?:en|de|a)\s+([^\n]+?)(?:\.|$)""", RegexOption.IGNORE_CASE)
        val merchant = merchantRe.find(text)?.groupValues?.get(1)?.trim()
        return ParsedNotification(
            packageName = "",
            title = title,
            text = text,
            amount = amount,
            currency = inferCurrency(text),
            merchant = merchant,
            type = type,
            rawText = text,
            timestamp = 0L,
        )
    }

    /** Matches Revolut amounts like `€20.00`, `£5`, `$1,234.56`, `MXN 300`. */
    private val REVOLUT_AMOUNT = Regex("""(?:€|£|\\$|MXN|USD|EUR|GBP)\s?([\d.,]+)""", RegexOption.IGNORE_CASE)

    private fun parseRevolut(title: String?, text: String): ParsedNotification? {
        val hay = "${title ?: ""} $text"
        val m = REVOLUT_AMOUNT.find(hay) ?: return null
        val amount = normalizeAmount(m.groupValues[1]) ?: return null
        val lower = hay.lowercase()
        val type = when {
            lower.contains("received") || lower.contains("refund") ||
                lower.contains("topped up") || lower.contains("top-up") ||
                lower.contains("added") || lower.contains("cashback") -> "credit"
            lower.contains("you sent") || lower.contains("you paid") ||
                lower.contains("payment to") || lower.contains("spent") ||
                lower.contains("withdrew") || lower.contains("withdrawal") -> "charge"
            else -> "unknown"
        }
        val merchantRe = Regex("""(?:to|at|from)\s+([^\n.,]{2,40})""", RegexOption.IGNORE_CASE)
        val merchant = merchantRe.find(hay)?.groupValues?.get(1)?.trim()
        return ParsedNotification(
            packageName = "",
            title = title,
            text = text,
            amount = amount,
            currency = inferCurrency(hay),
            merchant = merchant,
            type = type,
            rawText = text,
            timestamp = 0L,
        )
    }

    private fun parseGeneric(title: String?, text: String): ParsedNotification {
        val amount = extractAmount(text)
        val type = when {
            text.contains("cargo", true) || text.contains("compra", true) -> "charge"
            text.contains("abono", true) || text.contains("depósito", true) || text.contains("recibiste", true) -> "credit"
            text.contains("transfer", true) || text.contains("SPEI", true) -> "transfer"
            text.contains("pago", true) -> "payment"
            else -> "unknown"
        }
        return ParsedNotification(
            packageName = "",
            title = title,
            text = text,
            amount = amount,
            currency = inferCurrency(text),
            merchant = null,
            type = if (amount == null) "unknown" else type,
            rawText = text,
            timestamp = 0L,
        )
    }
}
