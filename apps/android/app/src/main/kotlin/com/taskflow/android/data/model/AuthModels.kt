package com.taskflow.android.data.model

import com.squareup.moshi.JsonClass

@JsonClass(generateAdapter = false)
data class CsrfResponse(val csrfToken: String)

@JsonClass(generateAdapter = false)
data class LoginRequest(
    val email: String,
    val password: String,
    val csrfToken: String,
    val json: Boolean = true,
)

@JsonClass(generateAdapter = false)
data class RegisterRequest(
    val email: String,
    val password: String,
    val name: String? = null,
)

@JsonClass(generateAdapter = false)
data class SessionUser(
    val id: String? = null,
    val email: String? = null,
    val name: String? = null,
)

@JsonClass(generateAdapter = false)
data class SessionResponse(val user: SessionUser? = null)
