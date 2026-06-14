package com.taskflow.android.ui.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.taskflow.android.AppContainer
import com.taskflow.android.data.prefs.SessionManager
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch

sealed class AuthState {
    data object Idle : AuthState()
    data object Loading : AuthState()
    data object Success : AuthState()
    data class Error(val message: String) : AuthState()
}

class AuthViewModel(private val container: AppContainer) : ViewModel() {

    private val _state = MutableStateFlow<AuthState>(AuthState.Idle)
    val state: StateFlow<AuthState> = _state

    fun login(email: String, password: String) {
        viewModelScope.launch {
            _state.value = AuthState.Loading
            val baseUrl = container.sessionManager.baseUrl.first()
            val result = container.authRepository(baseUrl).login(email.trim(), password)
            if (result.isSuccess) {
                val session = container.authRepository(baseUrl).getSession().getOrNull()
                container.sessionManager.saveUser(
                    email = session?.user?.email ?: email.trim(),
                    name = session?.user?.name,
                )
                _state.value = AuthState.Success
            } else {
                _state.value = AuthState.Error(result.exceptionOrNull()?.message ?: "Login failed")
            }
        }
    }

    fun register(email: String, password: String, name: String) {
        viewModelScope.launch {
            _state.value = AuthState.Loading
            val baseUrl = container.sessionManager.baseUrl.first()
            val result = container.authRepository(baseUrl).register(
                email.trim(),
                password,
                name.trim().ifBlank { null },
            )
            if (result.isSuccess) {
                // Auto-login after registration
                login(email, password)
            } else {
                _state.value = AuthState.Error(
                    result.exceptionOrNull()?.message ?: "Registration failed"
                )
            }
        }
    }

    fun reset() { _state.value = AuthState.Idle }
}
