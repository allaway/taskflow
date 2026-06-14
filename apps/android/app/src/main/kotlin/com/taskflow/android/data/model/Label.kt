package com.taskflow.android.data.model

import com.squareup.moshi.JsonClass

/**
 * Mirrors the label entry returned by GET /api/labels.
 * The API returns { name, color } — there is no server-side id.
 */
@JsonClass(generateAdapter = false)
data class Label(
    val name: String,
    val color: String,    // always a 7-char hex string "#RRGGBB"
)
