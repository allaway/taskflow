package com.taskflow.android.data.model

import com.squareup.moshi.JsonClass

@JsonClass(generateAdapter = false)
data class Label(
    val id: String,
    val name: String,
    val color: String? = null,
)
