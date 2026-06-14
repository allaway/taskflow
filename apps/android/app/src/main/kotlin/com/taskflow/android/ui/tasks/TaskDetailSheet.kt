package com.taskflow.android.ui.tasks

import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CalendarToday
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.taskflow.android.data.model.Task
import com.taskflow.android.ui.theme.PriorityHigh
import com.taskflow.android.ui.theme.PriorityLow
import com.taskflow.android.ui.theme.PriorityMedium

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TaskDetailSheet(
    task: Task,
    onDismiss: () -> Unit,
    onComplete: () -> Unit,
    onDelete: () -> Unit,
    onScheduleToday: (() -> Unit)?,
) {
    val priorityColor = when (task.priority) {
        "HIGH" -> PriorityHigh
        "MEDIUM" -> PriorityMedium
        else -> PriorityLow
    }

    ModalBottomSheet(onDismissRequest = onDismiss) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp)
                .padding(bottom = 32.dp),
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Badge(containerColor = priorityColor) {
                    Text(task.priority.lowercase().replaceFirstChar { it.uppercase() })
                }
                Text(
                    text = task.status.lowercase().replaceFirstChar { it.uppercase() },
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }

            Spacer(Modifier.height(12.dp))
            Text(task.title, style = MaterialTheme.typography.titleLarge)

            if (!task.description.isNullOrBlank()) {
                Spacer(Modifier.height(8.dp))
                Text(
                    task.description,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }

            if (!task.notes.isNullOrBlank()) {
                Spacer(Modifier.height(8.dp))
                HorizontalDivider()
                Spacer(Modifier.height(8.dp))
                Text(task.notes, style = MaterialTheme.typography.bodySmall)
            }

            if (task.scheduledDate != null) {
                Spacer(Modifier.height(8.dp))
                Text(
                    "Scheduled: ${task.scheduledDate.take(10)}" +
                            (task.startTime?.let { " at $it" } ?: ""),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }

            if (task.labelList.isNotEmpty()) {
                Spacer(Modifier.height(8.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    task.labelList.forEach { label ->
                        SuggestionChip(onClick = {}, label = { Text(label) })
                    }
                }
            }

            Spacer(Modifier.height(20.dp))
            HorizontalDivider()
            Spacer(Modifier.height(12.dp))

            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                if (task.status != "COMPLETED") {
                    Button(onClick = onComplete, modifier = Modifier.weight(1f)) {
                        Icon(Icons.Default.CheckCircle, null, modifier = Modifier.size(18.dp))
                        Spacer(Modifier.width(4.dp))
                        Text("Complete")
                    }
                }
                if (onScheduleToday != null && task.status == "INBOX") {
                    OutlinedButton(onClick = onScheduleToday, modifier = Modifier.weight(1f)) {
                        Icon(Icons.Default.CalendarToday, null, modifier = Modifier.size(18.dp))
                        Spacer(Modifier.width(4.dp))
                        Text("Today")
                    }
                }
                IconButton(onClick = onDelete) {
                    Icon(
                        Icons.Default.Delete,
                        contentDescription = "Delete",
                        tint = MaterialTheme.colorScheme.error,
                    )
                }
            }
        }
    }
}
