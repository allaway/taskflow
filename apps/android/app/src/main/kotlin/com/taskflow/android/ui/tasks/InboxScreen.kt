package com.taskflow.android.ui.tasks

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.taskflow.android.data.model.Task
import java.time.LocalDate
import java.time.format.DateTimeFormatter

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun InboxScreen(viewModel: TasksViewModel) {
    val state by viewModel.inbox.collectAsStateWithLifecycle()
    var showAdd by remember { mutableStateOf(false) }
    var editTask by remember { mutableStateOf<Task?>(null) }

    LaunchedEffect(Unit) { viewModel.loadInbox() }

    Scaffold(
        topBar = { TopAppBar(title = { Text("Inbox") }) },
        floatingActionButton = {
            FloatingActionButton(onClick = { showAdd = true }) {
                Icon(Icons.Default.Add, contentDescription = "Add task")
            }
        },
    ) { padding ->
        Box(Modifier.fillMaxSize().padding(padding)) {
            when {
                state.isLoading -> CircularProgressIndicator(Modifier.align(Alignment.Center))
                state.error != null -> Text(
                    state.error!!,
                    color = MaterialTheme.colorScheme.error,
                    modifier = Modifier.align(Alignment.Center).padding(16.dp),
                )
                state.tasks.isEmpty() -> Text(
                    "Your inbox is empty",
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.align(Alignment.Center),
                )
                else -> LazyColumn(
                    contentPadding = PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    items(state.tasks, key = { it.id }) { task ->
                        TaskCard(
                            task = task,
                            onComplete = { viewModel.completeTask(task) },
                            onClick = { editTask = task },
                        )
                    }
                }
            }
        }
    }

    if (showAdd) {
        AddEditTaskSheet(
            onDismiss = { showAdd = false },
            onSave = { title, description, priority, status ->
                viewModel.createTask(title, description, priority, status, null)
            },
        )
    }

    editTask?.let { task ->
        TaskDetailSheet(
            task = task,
            onDismiss = { editTask = null },
            onComplete = {
                viewModel.completeTask(task)
                editTask = null
            },
            onDelete = {
                viewModel.deleteTask(task)
                editTask = null
            },
            onScheduleToday = {
                val today = LocalDate.now().format(DateTimeFormatter.ISO_LOCAL_DATE)
                viewModel.updateTask(
                    task.id,
                    com.taskflow.android.data.model.UpdateTaskRequest(
                        status = "SCHEDULED",
                        scheduledDate = today,
                    ),
                    refreshInbox = true,
                )
                editTask = null
            },
        )
    }
}
