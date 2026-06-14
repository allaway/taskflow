package com.taskflow.android.data.model

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

enum class TaskStatus { INBOX, SCHEDULED, COMPLETED, CANCELLED }
enum class Priority { LOW, MEDIUM, HIGH }

@JsonClass(generateAdapter = false)
data class Task(
    val id: String,
    val title: String,
    val description: String? = null,
    val notes: String? = null,
    val status: String = "INBOX",
    val priority: String = "MEDIUM",
    @Json(name = "scheduledDate") val scheduledDate: String? = null,
    @Json(name = "startTime") val startTime: String? = null,
    val duration: Int? = null,
    val labels: List<String> = emptyList(),
    @Json(name = "completedAt") val completedAt: String? = null,
    @Json(name = "daysOverdue") val daysOverdue: Int = 0,
    @Json(name = "agentQueued") val agentQueued: Boolean = false,
    val source: String = "MANUAL",
)

@JsonClass(generateAdapter = false)
data class CreateTaskRequest(
    val title: String,
    val description: String? = null,
    val priority: String = "MEDIUM",
    val status: String = "INBOX",
    @Json(name = "scheduledDate") val scheduledDate: String? = null,
    @Json(name = "startTime") val startTime: String? = null,
    val duration: Int? = null,
    val labels: List<String> = emptyList(),
)

@JsonClass(generateAdapter = false)
data class UpdateTaskRequest(
    val title: String? = null,
    val description: String? = null,
    val notes: String? = null,
    val priority: String? = null,
    val status: String? = null,
    @Json(name = "scheduledDate") val scheduledDate: String? = null,
    @Json(name = "startTime") val startTime: String? = null,
    val duration: Int? = null,
    val labels: List<String>? = null,
)

@JsonClass(generateAdapter = false)
data class TasksResponse(
    val tasks: List<Task>,
    val total: Int? = null,
)
