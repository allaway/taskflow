package com.taskflow.android.ui.tasks

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.dp
import com.taskflow.android.data.model.Task

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AddEditTaskSheet(
    task: Task? = null,
    onDismiss: () -> Unit,
    onSave: (title: String, description: String?, priority: String, status: String) -> Unit,
) {
    val isEdit = task != null
    var title by remember { mutableStateOf(task?.title ?: "") }
    var description by remember { mutableStateOf(task?.description ?: "") }
    var priority by remember { mutableStateOf(task?.priority ?: "MEDIUM") }
    var addToday by remember { mutableStateOf(task?.status == "SCHEDULED") }

    ModalBottomSheet(onDismissRequest = onDismiss) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp)
                .padding(bottom = 32.dp),
        ) {
            Text(
                text = if (isEdit) "Edit Task" else "Add Task",
                style = MaterialTheme.typography.titleLarge,
            )
            Spacer(Modifier.height(16.dp))

            OutlinedTextField(
                value = title,
                onValueChange = { title = it },
                label = { Text("Title") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
            )
            Spacer(Modifier.height(12.dp))
            OutlinedTextField(
                value = description,
                onValueChange = { description = it },
                label = { Text("Description (optional)") },
                modifier = Modifier.fillMaxWidth(),
                minLines = 2,
                maxLines = 4,
            )
            Spacer(Modifier.height(16.dp))

            Text("Priority", style = MaterialTheme.typography.labelLarge)
            Spacer(Modifier.height(8.dp))
            Row(
                Modifier.selectableGroup(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                listOf("LOW", "MEDIUM", "HIGH").forEach { p ->
                    FilterChip(
                        selected = priority == p,
                        onClick = { priority = p },
                        label = { Text(p.lowercase().replaceFirstChar { it.uppercase() }) },
                    )
                }
            }
            Spacer(Modifier.height(12.dp))

            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier
                    .selectable(
                        selected = addToday,
                        onClick = { addToday = !addToday },
                        role = Role.Checkbox,
                    )
                    .fillMaxWidth(),
            ) {
                Checkbox(checked = addToday, onCheckedChange = { addToday = it })
                Spacer(Modifier.width(8.dp))
                Text("Schedule for today")
            }

            Spacer(Modifier.height(24.dp))
            Button(
                onClick = {
                    if (title.isNotBlank()) {
                        onSave(
                            title.trim(),
                            description.trim().ifBlank { null },
                            priority,
                            if (addToday) "SCHEDULED" else "INBOX",
                        )
                        onDismiss()
                    }
                },
                enabled = title.isNotBlank(),
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text(if (isEdit) "Save Changes" else "Add Task")
            }
        }
    }
}
