package com.taskflow.android.data.repository

import com.taskflow.android.data.api.InMemoryCookieJar
import com.taskflow.android.data.api.TaskFlowApi
import com.taskflow.android.data.model.RegisterRequest

class AuthRepository(
    private val api: TaskFlowApi,
    private val cookieJar: InMemoryCookieJar,
) {
    suspend fun login(email: String, password: String): Result<Unit> = runCatching {
        val csrfResponse = api.getCsrfToken()
        val csrf = csrfResponse.body()?.csrfToken
            ?: error("Failed to fetch CSRF token")

        val response = api.signIn(
            csrfToken = csrf,
            email = email,
            password = password,
        )
        if (!response.isSuccessful && response.code() != 302) {
            error("Login failed: ${response.code()}")
        }

        // Verify we actually have a session cookie
        val session = api.getSession()
        if (session.body()?.user == null) {
            cookieJar.clear()
            error("Invalid credentials")
        }
    }

    suspend fun register(email: String, password: String, name: String?): Result<Unit> =
        runCatching {
            val response = api.register(RegisterRequest(email, password, name))
            if (!response.isSuccessful) error("Registration failed: ${response.code()}")
        }

    suspend fun getSession() = runCatching { api.getSession().body() }

    suspend fun logout(): Result<Unit> = runCatching {
        val csrf = api.getCsrfToken().body()?.csrfToken ?: ""
        api.signOut(csrf)
        cookieJar.clear()
    }

    fun isLoggedIn(): Boolean = cookieJar.hasSession()
}
