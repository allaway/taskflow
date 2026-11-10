package com.taskflow.android.ui.tasks

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.taskflow.android.AppContainer
import com.taskflow.android.data.model.CreateTaskRequest
import com.taskflow.android.data.model.Label
import com.taskflow.android.data.model.Task
import com.taskflow.android.data.model.UpdateTaskRequest
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.format.DateTimeFormatter

data class TasksUiState(
    val tasks: List<Task> = emptyList(),
    val labels: List<Label> = emptyList(),
    val isLoading: Boolean = false,
    val error: String? = null,
)

class TasksViewModel(private val container: AppContainer) : ViewModel() {

    private val _inbox = MutableStateFlow(TasksUiState())
    val inbox: StateFlow<TasksUiState> = _inbox

    private val _today = MutableStateFlow(TasksUiState())
    val today: StateFlow<TasksUiState> = _today

    private val _week = MutableStateFlow(TasksUiState())
    val week: StateFlow<TasksUiState> = _week

    private val dateFormatter = DateTimeFormatter.ISO_LOCAL_DATE

    fun loadInbox() {
        viewModelScope.launch {
            _inbox.value = _inbox.value.copy(isLoading = true, error = null)
            val baseUrl = container.sessionManager.baseUrl.first()
            val repo = container.taskRepository(baseUrl)
            val result = repo.getInboxTasks()
            _inbox.value = if (result.isSuccess) {
                _inbox.value.copy(tasks = result.getOrThrow(), isLoading = false)
            } else {
                _inbox.value.copy(isLoading = false, error = result.exceptionOrNull()?.message)
            }
        }
    }

    fun loadToday() {
        viewModelScope.launch {
            _today.value = _today.value.copy(isLoading = true, error = null)
            val baseUrl = container.sessionManager.baseUrl.first()
            val repo = container.taskRepository(baseUrl)
            val today = LocalDate.now().format(dateFormatter)
            val result = repo.getTodayTasks(today)
            _today.value = if (result.isSuccess) {
                _today.value.copy(tasks = result.getOrThrow(), isLoading = false)
            } else {
                _today.value.copy(isLoading = false, error = result.exceptionOrNull()?.message)
            }
        }
    }

    fun loadWeek() {
        viewModelScope.launch {
            _week.value = _week.value.copy(isLoading = true, error = null)
            val baseUrl = container.sessionManager.baseUrl.first()
            val repo = container.taskRepository(baseUrl)
            val start = LocalDate.now()
            val dates = (0..6).map { start.plusDays(it.toLong()).format(dateFormatter) }
            val result = repo.getWeekTasks(dates)
            _week.value = if (result.isSuccess) {
                _week.value.copy(tasks = result.getOrThrow(), isLoading = false)
            } else {
                _week.value.copy(isLoading = false, error = result.exceptionOrNull()?.message)
            }
        }
    }

    fun createTask(
        title: String,
        description: String?,
        priority: String,
        status: String,
        scheduledDate: String?,
    ) {
        viewModelScope.launch {
            val baseUrl = container.sessionManager.baseUrl.first()
            val repo = container.taskRepository(baseUrl)
            repo.createTask(
                CreateTaskRequest(
                    title = title.trim(),
                    description = description?.trim()?.ifBlank { null },
                    priority = priority,
                    status = status,
                    scheduledDate = scheduledDate,
                )
            )
            // Reload whichever view is relevant
            if (status == "SCHEDULED" && scheduledDate != null) loadToday() else loadInbox()
        }
    }

    fun completeTask(task: Task) {
        viewModelScope.launch {
            val baseUrl = container.sessionManager.baseUrl.first()
            container.taskRepository(baseUrl).completeTask(task.id)
            // Remove from all local state immediately for responsiveness
            _inbox.value = _inbox.value.copy(tasks = _inbox.value.tasks.filter { it.id != task.id })
            _today.value = _today.value.copy(tasks = _today.value.tasks.filter { it.id != task.id })
            _week.value = _week.value.copy(tasks = _week.value.tasks.filter { it.id != task.id })
        }
    }

    fun updateTask(id: String, request: UpdateTaskRequest, refreshInbox: Boolean = false) {
        viewModelScope.launch {
            val baseUrl = container.sessionManager.baseUrl.first()
            container.taskRepository(baseUrl).updateTask(id, request)
            if (refreshInbox) loadInbox() else loadToday()
        }
    }

    fun deleteTask(task: Task) {
        viewModelScope.launch {
            val baseUrl = container.sessionManager.baseUrl.first()
            container.taskRepository(baseUrl).deleteTask(task.id)
            _inbox.value = _inbox.value.copy(tasks = _inbox.value.tasks.filter { it.id != task.id })
            _today.value = _today.value.copy(tasks = _today.value.tasks.filter { it.id != task.id })
            _week.value = _week.value.copy(tasks = _week.value.tasks.filter { it.id != task.id })
        }
    }
}
