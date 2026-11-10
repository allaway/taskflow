package com.taskflow.android.ui.settings

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.taskflow.android.AppContainer
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch

class SettingsViewModel(private val container: AppContainer) : ViewModel() {
    val baseUrl = container.sessionManager.baseUrl.stateIn(
        viewModelScope,
        SharingStarted.WhileSubscribed(5_000),
        com.taskflow.android.data.prefs.SessionManager.DEFAULT_BASE_URL,
    )
    val userEmail = container.sessionManager.userEmail.stateIn(
        viewModelScope,
        SharingStarted.WhileSubscribed(5_000),
        null,
    )
    val userName = container.sessionManager.userName.stateIn(
        viewModelScope,
        SharingStarted.WhileSubscribed(5_000),
        null,
    )

    fun saveBaseUrl(url: String) {
        viewModelScope.launch { container.sessionManager.saveBaseUrl(url) }
    }

    fun logout(onComplete: () -> Unit) {
        viewModelScope.launch {
            val url = container.sessionManager.baseUrl.first()
            container.authRepository(url).logout()
            container.sessionManager.clearUser()
            onComplete()
        }
    }
}
