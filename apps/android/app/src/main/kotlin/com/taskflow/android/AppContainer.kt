package com.taskflow.android

import android.content.Context
import com.taskflow.android.data.api.ApiClient
import com.taskflow.android.data.api.InMemoryCookieJar
import com.taskflow.android.data.prefs.SessionManager
import com.taskflow.android.data.repository.AuthRepository
import com.taskflow.android.data.repository.TaskRepository

class AppContainer(context: Context) {
    val sessionManager = SessionManager(context)
    val cookieJar = InMemoryCookieJar()

    // Lazily recreated whenever the base URL changes
    private var _baseUrl: String = SessionManager.DEFAULT_BASE_URL
    private var _apiClient: ApiClient = ApiClient(_baseUrl, cookieJar)

    fun getOrCreateApiClient(baseUrl: String): ApiClient {
        if (baseUrl != _baseUrl) {
            _baseUrl = baseUrl
            cookieJar.clear()
            _apiClient = ApiClient(baseUrl, cookieJar)
        }
        return _apiClient
    }

    fun authRepository(baseUrl: String): AuthRepository {
        val client = getOrCreateApiClient(baseUrl)
        return AuthRepository(client.api, cookieJar)
    }

    fun taskRepository(baseUrl: String): TaskRepository {
        val client = getOrCreateApiClient(baseUrl)
        return TaskRepository(client.api)
    }
}
