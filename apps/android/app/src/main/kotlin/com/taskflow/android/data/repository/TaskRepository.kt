package com.taskflow.android.data.repository

import com.taskflow.android.data.api.TaskFlowApi
import com.taskflow.android.data.model.CreateTaskRequest
import com.taskflow.android.data.model.Task
import com.taskflow.android.data.model.UpdateTaskRequest

class TaskRepository(private val api: TaskFlowApi) {

    suspend fun getInboxTasks(): Result<List<Task>> = runCatching {
        val response = api.getTasks(status = "INBOX")
        response.body() ?: error("Failed to load inbox tasks")
    }

    suspend fun getTodayTasks(date: String): Result<List<Task>> = runCatching {
        val response = api.getTasks(status = "SCHEDULED", date = date)
        response.body() ?: error("Failed to load today's tasks")
    }

    suspend fun getWeekTasks(dates: List<String>): Result<List<Task>> = runCatching {
        // Fetch all scheduled tasks and filter by the week's date range client-side
        val allDated = dates.flatMap { date ->
            api.getTasks(status = "SCHEDULED", date = date).body() ?: emptyList()
        }
        allDated.distinctBy { it.id }
    }

    suspend fun createTask(request: CreateTaskRequest): Result<Task> = runCatching {
        val response = api.createTask(request)
        response.body() ?: error("Failed to create task")
    }

    suspend fun completeTask(id: String): Result<Task> = runCatching {
        val response = api.updateTask(id, UpdateTaskRequest(status = "COMPLETED"))
        response.body() ?: error("Failed to complete task")
    }

    suspend fun updateTask(id: String, request: UpdateTaskRequest): Result<Task> = runCatching {
        val response = api.updateTask(id, request)
        response.body() ?: error("Failed to update task")
    }

    suspend fun deleteTask(id: String): Result<Unit> = runCatching {
        api.deleteTask(id)
    }

    suspend fun getLabels() = runCatching {
        api.getLabels().body() ?: emptyList()
    }
}
