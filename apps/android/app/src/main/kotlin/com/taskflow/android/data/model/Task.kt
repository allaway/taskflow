package com.taskflow.android.data.model

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

enum class TaskStatus { INBOX, SCHEDULED, COMPLETED, CANCELLED }
enum class Priority { LOW, MEDIUM, HIGH }

/**
 * Mirrors the Task row returned by the API (GET /api/tasks, POST/PATCH /api/tasks/:id).
 *
 * Contract invariants (verified by TaskContractTest and web android-contract tests):
 *  - `labels` is a server-side JSON-encoded string (e.g. '["work","urgent"]') or null,
 *    NOT a parsed List. Decode with Moshi when you need the individual values.
 *  - All datetime fields are UTC ISO 8601 strings ("2024-01-01T00:00:00.000Z").
 *  - `id`, `userId`, `createdAt`, `updatedAt` are always non-null.
 */
@JsonClass(generateAdapter = false)
data class Task(
    val id: String,
    val title: String,
    val description: String? = null,
    val notes: String? = null,
    val status: String = "INBOX",           // TaskStatus enum values
    val priority: String = "MEDIUM",        // Priority enum values
    val source: String = "MANUAL",
    val scheduledDate: String? = null,      // UTC ISO 8601 or null
    val startTime: String? = null,          // "HH:MM" or null
    val duration: Int? = null,              // minutes or null
    val recurringRule: String? = null,
    val externalId: String? = null,
    val labels: String? = null,             // JSON-encoded string array or null
    val userId: String = "",
    val completedAt: String? = null,        // UTC ISO 8601 or null
    val daysOverdue: Int = 0,
    val agentQueued: Boolean = false,
    val createdAt: String = "",             // UTC ISO 8601
    val updatedAt: String = "",             // UTC ISO 8601
)

@JsonClass(generateAdapter = false)
data class CreateTaskRequest(
    val title: String,
    val description: String? = null,
    val priority: String = "MEDIUM",
    val scheduledDate: String? = null,      // UTC ISO 8601
    val startTime: String? = null,
    val duration: Int? = null,
    val labels: List<String>? = null,
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

